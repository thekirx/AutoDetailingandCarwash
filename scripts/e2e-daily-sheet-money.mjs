/**
 * Live Daily Sheet money path against the real Supabase project (sandbox day 2000-01-03, bacoor).
 * BA save → submit (server checks) → SA return → resubmit → SA approve (posts paid expenses once)
 * → re-approve is a no-op → SA reopen voids them. Plus role/branch refusals, receipts bucket,
 * daily-rate guard, and the retired payroll / End of shift RPCs.
 *
 * Creates no sales or tickets. Always deletes its sheet, posted expenses, audit rows and receipt.
 * node scripts/e2e-daily-sheet-money.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toSheetPayloadLines } from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const QA_DATE = '2000-01-03'
const QA_BRANCH = 'bacoor'
const OTHER_BRANCH = 'batangas'
const RECEIPT_PATH = `${QA_BRANCH}/${QA_DATE}/qa-e2e-receipt.png`

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1).replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anonKey && service, 'missing SUPABASE_URL / anon / SERVICE_ROLE_KEY')

const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const admin = createClient(url, service, opts)
let checks = 0

function pass(name, detail = '') {
  checks += 1
  console.log('✔', name, detail)
}

async function login(email, password) {
  const client = createClient(url, anonKey, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert(!error && data.session, `login ${email}: ${error?.message}`)
  return { client, userId: data.user.id }
}

async function rpc(client, name, payload) {
  const { data, error } = await client.rpc(name, { payload })
  return { data, error }
}

async function refused(name, promise, pattern) {
  const { error } = await promise
  assert(error, `${name}: expected refusal, got success`)
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error "${error.message}"`)
  pass(name, error.message.slice(0, 80))
}

async function cleanup() {
  const { data: sheets } = await admin.from('daily_sheets').select('id').eq('branch', QA_BRANCH).eq('business_date', QA_DATE)
  for (const s of sheets || []) {
    const { data: lines } = await admin.from('daily_sheet_lines').select('id').eq('sheet_id', s.id)
    const lineIds = (lines || []).map((l) => l.id)
    if (lineIds.length) {
      const { error } = await admin.from('expenses').delete().in('daily_sheet_line_id', lineIds)
      assert(!error, `cleanup expenses: ${error?.message}`)
    }
    await admin.from('audit_logs').delete().eq('entity_type', 'daily_sheets').eq('entity_id', s.id)
    const { error } = await admin.from('daily_sheets').delete().eq('id', s.id)
    assert(!error, `cleanup sheet: ${error?.message}`)
  }
  await admin.storage.from('daily-sheet-receipts').remove([RECEIPT_PATH])
}

async function postedExpenses(sheetId) {
  const { data: lines } = await admin.from('daily_sheet_lines').select('id').eq('sheet_id', sheetId)
  const ids = (lines || []).map((l) => l.id)
  if (!ids.length) return []
  const { data, error } = await admin
    .from('expenses')
    .select('id, status, expense_kind, total_minor, created_at, daily_sheet_line_id, expense_categories(code)')
    .in('daily_sheet_line_id', ids)
  assert(!error, `posted expenses: ${error?.message}`)
  return data || []
}

await cleanup()

try {
  const [ba, boss, tl, asa] = await Promise.all([
    login('admin@hakumautocare.com', 'HakumAdmin2026!'),
    login('bossmich@hakumautocare.com', 'HakumBoss2026!'),
    login('teamlead@hakumautocare.com', 'HakumTL2026!'),
    login('assistant@hakumautocare.com', 'HakumAsa2026!'),
  ])

  const { data: accounts, error: accErr } = await admin.from('expense_categories').select('id, code').in('code', ['14', '18'])
  assert(!accErr && accounts?.length === 2, `accounts 14/18: ${accErr?.message}`)
  const generalAccount = accounts.find((a) => a.code === '18').id
  const { data: detailer, error: detErr } = await admin
    .from('staff_profiles')
    .select('id, daily_rate_minor')
    .eq('branch_slug', QA_BRANCH)
    .eq('role', 'detailer')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  assert(!detErr && detailer?.id, `need an active bacoor detailer: ${detErr?.message}`)

  // Float 2000 + repay 50 − expense 500 − salary 900 − release 200 = 450 expected in the drawer.
  const lines = [
    { kind: 'expense', account_id: generalAccount, description: 'QA e2e load', amount_minor: 50000 },
    { kind: 'salary', staff_id: detailer.id, suggested_minor: 80000, amount_minor: 90000, reason: '' },
    { kind: 'ca_release', staff_id: detailer.id, amount_minor: 20000 },
    { kind: 'ca_repay', staff_id: detailer.id, amount_minor: 5000 },
  ]
  const sheetPayload = (overrides = {}) => ({
    branch: QA_BRANCH,
    business_date: QA_DATE,
    opening_float_minor: 200000,
    counted_cash_minor: 45000,
    notes: null,
    totals: {},
    lines: toSheetPayloadLines(lines),
    ...overrides,
  })

  // ── Access refusals before anything exists ────────────────────────────────
  await refused('sheet.anon_save_refused', rpc(createClient(url, anonKey, opts), 'save_daily_sheet', sheetPayload()))
  await refused('sheet.tl_save_refused', rpc(tl.client, 'save_daily_sheet', sheetPayload()), /limited to your branch/)
  await refused(
    'sheet.ba_other_branch_refused',
    rpc(ba.client, 'save_daily_sheet', sheetPayload({ branch: OTHER_BRANCH })),
    /limited to your branch/,
  )

  // ── BA save draft ─────────────────────────────────────────────────────────
  const { data: saved, error: saveErr } = await rpc(ba.client, 'save_daily_sheet', sheetPayload())
  assert(!saveErr && saved?.id, `save_daily_sheet: ${saveErr?.message}`)
  assert(saved.status === 'draft', `expected draft, got ${saved.status}`)
  const sheetId = saved.id
  pass('sheet.ba_save_draft', sheetId)

  const { data: baView } = await ba.client.from('daily_sheets').select('id, daily_sheet_lines(id)').eq('id', sheetId).maybeSingle()
  assert(baView?.daily_sheet_lines?.length === 4, `BA should read 4 lines, got ${baView?.daily_sheet_lines?.length}`)
  pass('sheet.ba_reads_own_sheet', '4 lines')
  const { data: tlView } = await tl.client.from('daily_sheets').select('id').eq('id', sheetId)
  assert((tlView || []).length === 0, 'TL must not read daily sheets')
  pass('sheet.tl_cannot_read')
  await refused('sheet.review_draft_refused', rpc(boss.client, 'review_daily_sheet', { id: sheetId, action: 'approve' }), /Only submitted/)
  await refused(
    'sheet.direct_insert_refused',
    ba.client.from('daily_sheets').insert({ branch: QA_BRANCH, business_date: '2000-01-04' }),
  )

  // ── Server-side submit checks ─────────────────────────────────────────────
  await refused('sheet.submit_needs_salary_reason', rpc(ba.client, 'submit_daily_sheet', { id: sheetId }), /Finish 1 line/)
  lines[1].reason = 'QA overtime'
  await rpc(ba.client, 'save_daily_sheet', sheetPayload({ counted_cash_minor: 44000 }))
  await refused('sheet.submit_needs_over_short_note', rpc(ba.client, 'submit_daily_sheet', { id: sheetId }), /over or short/)
  const { error: resaveErr } = await rpc(ba.client, 'save_daily_sheet', sheetPayload())
  assert(!resaveErr, `resave: ${resaveErr?.message}`)

  const { data: submitted, error: submitErr } = await rpc(ba.client, 'submit_daily_sheet', { id: sheetId })
  assert(!submitErr, `submit_daily_sheet: ${submitErr?.message}`)
  assert(submitted.status === 'submitted', `expected submitted, got ${submitted.status}`)
  assert(Number(submitted.totals.expectedCashMinor) === 45000, `expected cash ${submitted.totals.expectedCashMinor}`)
  assert(Number(submitted.totals.overShortMinor) === 0, `over/short ${submitted.totals.overShortMinor}`)
  assert(Number(submitted.totals.salariesMinor) === 90000, `salaries ${submitted.totals.salariesMinor}`)
  pass('sheet.ba_submit', 'expected ₱450, over/short 0')

  await refused('sheet.edit_after_submit_refused', rpc(ba.client, 'save_daily_sheet', sheetPayload()), /no longer be edited/)
  await refused('sheet.double_submit_refused', rpc(ba.client, 'submit_daily_sheet', { id: sheetId }), /Only draft or returned/)
  await refused('sheet.ba_cannot_approve', rpc(ba.client, 'review_daily_sheet', { id: sheetId, action: 'approve' }), /Only Super Admin/)
  await refused('sheet.tl_cannot_approve', rpc(tl.client, 'review_daily_sheet', { id: sheetId, action: 'approve' }), /Only Super Admin/)

  // ── SA return → BA resubmit ───────────────────────────────────────────────
  await refused('sheet.return_needs_note', rpc(boss.client, 'review_daily_sheet', { id: sheetId, action: 'return' }), /needs a note/)
  const { data: returned, error: returnErr } = await rpc(boss.client, 'review_daily_sheet', {
    id: sheetId,
    action: 'return',
    review_note: 'QA please recheck',
  })
  assert(!returnErr && returned.status === 'returned', `return: ${returnErr?.message}`)
  pass('sheet.sa_return')
  await refused('sheet.reopen_returned_refused', rpc(boss.client, 'reopen_daily_sheet', { id: sheetId, review_note: 'QA early reopen' }), /Only approved/)
  const { data: fixed, error: fixErr } = await rpc(ba.client, 'save_daily_sheet', sheetPayload({ notes: 'QA rechecked' }))
  assert(!fixErr && fixed.status === 'returned', `BA edit returned sheet: ${fixErr?.message} ${JSON.stringify(fixed)}`)
  pass('sheet.ba_edits_returned', 'stays returned until resubmit')
  const { data: resub, error: resubErr } = await rpc(ba.client, 'submit_daily_sheet', { id: sheetId })
  assert(!resubErr && resub.status === 'submitted', `resubmit: ${resubErr?.message}`)
  pass('sheet.ba_resubmit_after_return')

  // ── SA approve posts once ─────────────────────────────────────────────────
  const { data: approved, error: approveErr } = await rpc(boss.client, 'review_daily_sheet', { id: sheetId, action: 'approve' })
  assert(!approveErr, `approve: ${approveErr?.message}`)
  assert(approved.status === 'approved' && approved.posted === 2, `approve result ${JSON.stringify(approved)}`)
  pass('sheet.sa_approve', 'posted 2')

  const posted = await postedExpenses(sheetId)
  assert(posted.length === 2, `expected 2 posted expenses, got ${posted.length}`)
  assert(posted.every((e) => e.status === 'paid'), 'posted expenses must be paid')
  const salary = posted.find((e) => e.expense_kind === 'salary_detailer')
  const expense = posted.find((e) => e.expense_kind === 'daily')
  assert(salary && Number(salary.total_minor) === 90000 && salary.expense_categories?.code === '14', `salary row ${JSON.stringify(salary)}`)
  assert(expense && Number(expense.total_minor) === 50000 && expense.expense_categories?.code === '18', `expense row ${JSON.stringify(expense)}`)
  const manilaDay = new Date(new Date(salary.created_at).getTime() + 8 * 3600e3).toISOString().slice(0, 10)
  assert(manilaDay === QA_DATE, `posted on ${manilaDay}, want ${QA_DATE}`)
  pass('sheet.posted_paid_expenses', 'salary→14 salary_detailer, expense→18 daily, dated the sheet day')

  const { data: again, error: againErr } = await rpc(boss.client, 'review_daily_sheet', { id: sheetId, action: 'approve' })
  assert(!againErr && again.posted === 0, `re-approve: ${againErr?.message} ${JSON.stringify(again)}`)
  assert((await postedExpenses(sheetId)).length === 2, 're-approve must not double-post')
  pass('sheet.re_approve_posts_nothing')
  await refused(
    'sheet.return_approved_refused',
    rpc(boss.client, 'review_daily_sheet', { id: sheetId, action: 'return', review_note: 'QA late return' }),
    /Only submitted/,
  )

  const { data: inbox, error: inboxErr } = await boss.client
    .from('daily_sheets')
    .select('id, staff_profiles!daily_sheets_submitted_by_fkey(full_name)')
    .eq('id', sheetId)
    .maybeSingle()
  assert(!inboxErr && inbox?.id === sheetId, `Finance inbox embed: ${inboxErr?.message}`)
  pass('sheet.finance_inbox_query', inbox.staff_profiles?.full_name || '')

  const { data: audits } = await admin.from('audit_logs').select('action').eq('entity_type', 'daily_sheets').eq('entity_id', sheetId)
  const actions = (audits || []).map((a) => a.action).sort()
  assert(actions.filter((a) => a === 'daily_sheet.submit').length === 2 && actions.includes('daily_sheet.approve'), `audit ${actions}`)
  pass('sheet.audit_trail', actions.join(','))

  // ── Reopen (SA only) voids the posting ────────────────────────────────────
  await refused('sheet.ba_cannot_reopen', rpc(ba.client, 'reopen_daily_sheet', { id: sheetId, review_note: 'QA' }), /Only Super Admin/)
  await refused('sheet.reopen_needs_note', rpc(boss.client, 'reopen_daily_sheet', { id: sheetId }), /needs a note/)
  const { data: reopened, error: reopenErr } = await rpc(boss.client, 'reopen_daily_sheet', { id: sheetId, review_note: 'QA reopen' })
  assert(!reopenErr && reopened.status === 'returned' && reopened.voided === 2, `reopen ${reopenErr?.message} ${JSON.stringify(reopened)}`)
  assert((await postedExpenses(sheetId)).length === 0, 'reopen must void posted expenses')
  pass('sheet.sa_reopen_voids', 'voided 2')

  const { error: resub2Err } = await rpc(ba.client, 'submit_daily_sheet', { id: sheetId })
  assert(!resub2Err, `resubmit after reopen: ${resub2Err?.message}`)
  const { data: asaApproved, error: asaErr } = await rpc(asa.client, 'review_daily_sheet', { id: sheetId, action: 'approve' })
  assert(!asaErr && asaApproved.status === 'approved' && asaApproved.posted === 2, `ASA approve ${asaErr?.message} ${JSON.stringify(asaApproved)}`)
  assert((await postedExpenses(sheetId)).length === 2, 'approve after reopen must post exactly once again')
  pass('sheet.asa_approve_after_reopen_posts_once', 'posted 2')

  // ── Receipts bucket: own branch only ──────────────────────────────────────
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const { error: upErr } = await ba.client.storage.from('daily-sheet-receipts').upload(RECEIPT_PATH, png, { contentType: 'image/png' })
  assert(!upErr, `receipt upload: ${upErr?.message}`)
  pass('receipts.ba_upload_own_branch')
  const { error: otherUpErr } = await ba.client.storage
    .from('daily-sheet-receipts')
    .upload(`${OTHER_BRANCH}/${QA_DATE}/qa-e2e-receipt.png`, png, { contentType: 'image/png' })
  assert(otherUpErr, 'receipt upload to another branch must be refused')
  pass('receipts.ba_other_branch_refused', otherUpErr.message.slice(0, 60))

  // ── Daily rate: only SA / ASA finance write ───────────────────────────────
  {
    const { error } = await ba.client.from('staff_profiles').update({ daily_rate_minor: 123400 }).eq('id', detailer.id)
    const { data: after } = await admin.from('staff_profiles').select('daily_rate_minor').eq('id', detailer.id).maybeSingle()
    assert(Number(after?.daily_rate_minor) === Number(detailer.daily_rate_minor || 0), 'BA changed a daily rate')
    pass('rate.ba_cannot_set_daily_rate', error ? error.message.slice(0, 60) : 'no rows changed')
  }

  // ── Retired writes stay closed ────────────────────────────────────────────
  await refused('legacy.ba_run_payroll_denied', rpc(ba.client, 'run_payroll', {}), /permission denied/)
  await refused('legacy.sa_run_payroll_denied', rpc(boss.client, 'run_payroll', {}), /permission denied/)
  await refused('legacy.submit_shift_close_denied', rpc(ba.client, 'submit_shift_close', {}), /permission denied/)
  await refused('legacy.review_shift_close_denied', rpc(boss.client, 'review_shift_close', {}), /permission denied/)

  await Promise.all([ba, boss, tl, asa].map((u) => u.client.auth.signOut()))
} finally {
  await cleanup()
}

const { count: left } = await admin
  .from('daily_sheets')
  .select('id', { count: 'exact', head: true })
  .eq('branch', QA_BRANCH)
  .eq('business_date', QA_DATE)
assert((left || 0) === 0, `sandbox sheet leftovers: ${left}`)
pass('cleanup.sandbox_wiped')

console.log(`\ne2e-daily-sheet-money: PASS (${checks} checks)`)
