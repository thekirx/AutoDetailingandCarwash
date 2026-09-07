/**
 * BUG-007 residual: live RPC money path on QA sandbox date 2099-01-01.
 * BA submit_shift_close → Boss review_shift_close accept → status accepted
 * → payroll pending-floor + hard gate unlock → Boss run_payroll confirm
 *   (claims a sandbox sale + wash_pool line) → cleanup
 * CHEM-RECON: approved recon + at least one recon line (QA fixture).
 * OWNER SMS: reports phone-source gap (env / BossMich) — does not send live SMS.
 *
 * Re-runnable: deletes prior 2099-01-01 bacoor close + qa-sandbox payroll/sales first.
 * node scripts/e2e-shift-close-money.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyBacoorDailyReport } from '../src/lib/bacoorDailyReport.js'
import {
  buildPendingFloorPayrollQueue,
  floorConfirmBlockedByPendingCloses,
} from '../src/lib/payroll.js'
import { moneySnapshotFromReport } from '../src/lib/shiftClose.js'
import { listOwnerSmsPhones, notifyShiftCloseAccepted } from '../server/notifyShiftClose.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const QA_DATE = '2099-01-01'
const QA_BRANCH = 'bacoor'
const QA_RECON_NOTE = 'qa-seed-chem-recon-2099'
const QA_PAYROLL_NOTE = 'qa-sandbox-payroll-2099'
const QA_SALE_NOTE = 'qa-sandbox-sale-2099'

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
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anon && service, 'missing SUPABASE_URL / anon / SERVICE_ROLE_KEY')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}

async function wipeSandboxPayroll() {
  const { data: runs, error } = await admin
    .from('payroll_runs')
    .select('id')
    .eq('branch', QA_BRANCH)
    .eq('period_start', QA_DATE)
    .eq('period_end', QA_DATE)
    .ilike('notes', `%${QA_PAYROLL_NOTE}%`)
  assert(!error, `sandbox payroll list: ${error?.message}`)
  for (const run of runs || []) {
    await admin.from('payroll_run_lines').delete().eq('run_id', run.id)
    await admin.from('payroll_run_sales').delete().eq('run_id', run.id)
    await admin.from('expenses').delete().like('description', `payroll:${run.id}%`)
    const { error: delErr } = await admin.from('payroll_runs').delete().eq('id', run.id)
    assert(!delErr, `sandbox payroll delete: ${delErr?.message}`)
  }
}

async function wipeSandboxSales() {
  const { error } = await admin
    .from('sales')
    .delete()
    .eq('branch', QA_BRANCH)
    .ilike('notes', `%${QA_SALE_NOTE}%`)
  assert(!error, `sandbox sales delete: ${error?.message}`)
}

// ── Reset sandbox close + payroll so this script is idempotent ─────────────
{
  await wipeSandboxPayroll()
  await wipeSandboxSales()
  const { error } = await admin
    .from('shift_close_reports')
    .delete()
    .eq('branch', QA_BRANCH)
    .eq('business_date', QA_DATE)
  assert(!error, `sandbox delete: ${error?.message}`)
}

const snapshot = moneySnapshotFromReport(
  emptyBacoorDailyReport({ branchSlug: QA_BRANCH, branchDisplay: 'Bacoor', date: QA_DATE }),
)

// ── money.rpc.ba_submit ────────────────────────────────────────────────────
const ba = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: baAuth, error: baErr } = await ba.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
assert(!baErr && baAuth.session, `BA login: ${baErr?.message}`)

const { data: submitted, error: submitErr } = await ba.rpc('submit_shift_close', {
  payload: {
    branch: QA_BRANCH,
    business_date: QA_DATE,
    shift_ended_at: new Date(`${QA_DATE}T18:00:00+08:00`).toISOString(),
    pos_baseline: snapshot,
    submitted: snapshot,
    override_reasons: {},
  },
})
assert(!submitErr, `submit_shift_close: ${submitErr?.message}`)
const submitId = submitted?.id || submitted
assert(submitId, `money.rpc.ba_submit missing id: ${JSON.stringify(submitted)}`)
pass('money.rpc.ba_submit', String(submitId))
await ba.auth.signOut()

// ── money.rpc.boss_accept ──────────────────────────────────────────────────
const boss = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: bossAuth, error: bossErr } = await boss.auth.signInWithPassword({
  email: 'bossmich@hakumautocare.com',
  password: 'HakumBoss2026!',
})
assert(!bossErr && bossAuth.session, `Boss login: ${bossErr?.message}`)

const { data: reviewed, error: reviewErr } = await boss.rpc('review_shift_close', {
  payload: { id: submitId, action: 'accept', review_note: 'qa-sandbox-accept-2099' },
})
assert(!reviewErr, `review_shift_close: ${reviewErr?.message}`)
pass('money.rpc.boss_accept', JSON.stringify(reviewed))

// ── money.rpc.status_accepted ──────────────────────────────────────────────
const { data: row, error: rowErr } = await admin
  .from('shift_close_reports')
  .select('id, status, branch, business_date')
  .eq('id', submitId)
  .maybeSingle()
assert(!rowErr, rowErr?.message)
assert(row?.status === 'accepted', `expected accepted, got ${row?.status}`)
assert(row.business_date === QA_DATE, `sandbox date ${row.business_date}`)
pass('money.rpc.status_accepted', `${row.branch} ${row.business_date}`)

// ── money.owner_sms (resolve always; live send only if SEND_LIVE_OWNER_SMS=1) ─
{
  const phones = await listOwnerSmsPhones(admin)
  assert(Array.isArray(phones), 'listOwnerSmsPhones failed')
  if (!phones.length) {
    pass(
      'money.owner_sms.phone_gap',
      'OWNER_SMS_PHONE unset and BossMich.phone null — accept SMS would skip (ops)',
    )
  } else {
    pass('money.owner_sms.phone_sources', phones.map((p) => `${String(p).slice(0, 4)}…`).join(','))
  }

  // ponytail: default e2e must not burn BusyBee credits / spam the test handset
  if (process.env.SEND_LIVE_OWNER_SMS === '1') {
    assert(phones.length > 0, 'SEND_LIVE_OWNER_SMS=1 but no owner phone sources')
    const notify = await notifyShiftCloseAccepted({
      branch: QA_BRANCH,
      businessDate: QA_DATE,
      closeId: submitId,
      actorId: bossAuth.user?.id || null,
    })
    assert(notify?.ownerSms, `notify missing ownerSms: ${JSON.stringify(notify)}`)
    if (notify.ownerSms.skipped === 'no_owner_phone') {
      assert(false, 'live send requested but skipped no_owner_phone')
    }
    assert(Number(notify.ownerSms.sent) > 0, `live owner SMS not sent: ${JSON.stringify(notify.ownerSms)}`)
    pass('money.owner_sms.notify_sent', `sent=${notify.ownerSms.sent}`)
  } else if (!phones.length) {
    const notify = await notifyShiftCloseAccepted({
      branch: QA_BRANCH,
      businessDate: QA_DATE,
      closeId: submitId,
      actorId: bossAuth.user?.id || null,
    })
    assert(notify?.ownerSms?.skipped === 'no_owner_phone', JSON.stringify(notify?.ownerSms))
    pass('money.owner_sms.notify_skip', 'no_owner_phone')
  } else {
    pass('money.owner_sms.notify_dry', 'phones ready; set SEND_LIVE_OWNER_SMS=1 to send')
  }
}

// ── money.payroll.pending_floor_after_accept ───────────────────────────────
{
  const { data: closes, error: closesErr } = await admin
    .from('shift_close_reports')
    .select('id, branch, business_date, status, submitted')
    .eq('branch', QA_BRANCH)
    .eq('business_date', QA_DATE)
  assert(!closesErr, closesErr?.message)
  const queue = buildPendingFloorPayrollQueue({ closes: closes || [], runs: [] })
  const hit = (queue || []).some(
    (d) => d.branch === QA_BRANCH && String(d.business_date).slice(0, 10) === QA_DATE && d.ready,
  )
  assert(hit, `pending floor missing ready ${QA_BRANCH} ${QA_DATE}: ${JSON.stringify(queue)}`)
  pass('money.payroll.pending_floor_after_accept', `${QA_BRANCH} ${QA_DATE}`)

  const gate = floorConfirmBlockedByPendingCloses({
    pendingFloorOptional: false,
    runKind: 'floor',
    branch: QA_BRANCH,
    periodStart: QA_DATE,
    periodEnd: QA_DATE,
    closes: closes || [],
  })
  assert(!gate.blocked, `hard gate still blocked: ${gate.reason}`)
  pass('money.payroll.hard_gate_unlocked', 'pending_floor_optional=false')
}

// ── money.rpc.run_payroll_confirm (+ sale claim) ───────────────────────────
{
  const { data: crew, error: crewErr } = await admin
    .from('staff_profiles')
    .select('id, full_name')
    .eq('branch_slug', QA_BRANCH)
    .eq('role', 'staff')
    .limit(1)
    .maybeSingle()
  assert(!crewErr && crew?.id, `need bacoor staff for payroll line: ${crewErr?.message}`)

  const { data: sale, error: saleErr } = await admin
    .from('sales')
    .insert({
      branch: QA_BRANCH,
      status: 'paid',
      payment_method: 'cash',
      subtotal_minor: 10000,
      total_minor: 10000,
      notes: QA_SALE_NOTE,
      occurred_at: new Date(`${QA_DATE}T10:00:00+08:00`).toISOString(),
    })
    .select('id, total_minor')
    .maybeSingle()
  assert(!saleErr && sale?.id, `sandbox sale: ${saleErr?.message}`)
  pass('money.rpc.sandbox_sale_seed', String(sale.id))

  const payload = {
    branch: QA_BRANCH,
    frequency: 'daily',
    period_start: QA_DATE,
    period_end: QA_DATE,
    wash_pool_pct: 35,
    notes: QA_PAYROLL_NOTE,
    run_kind: 'floor',
    sales: [
      {
        sale_id: sale.id,
        branch: QA_BRANCH,
        total_minor: sale.total_minor,
        wash_pool_minor: sale.total_minor,
      },
    ],
    lines: [
      {
        staff_id: crew.id,
        staff_name: crew.full_name || 'QA Crew',
        branch: QA_BRANCH,
        kind: 'wash_pool',
        direction: 'add',
        source_key: `qa:compensation:${QA_BRANCH}:${QA_DATE}`,
        amount_minor: 1000,
      },
    ],
  }

  const { data: runResult, error: payErr } = await boss.rpc('run_payroll', { payload })
  assert(!payErr, `run_payroll: ${payErr?.message}`)
  const runId = runResult?.id || runResult?.run_id || runResult
  assert(runId, `run_payroll missing id: ${JSON.stringify(runResult)}`)

  const { data: posted, error: postedErr } = await admin
    .from('payroll_runs')
    .select('id, status, branch, period_start, total_payout_minor, pos_sales_minor')
    .eq('id', runId)
    .maybeSingle()
  assert(!postedErr, postedErr?.message)
  assert(posted?.status === 'confirmed', `expected confirmed, got ${posted?.status}`)
  assert(Number(posted.total_payout_minor) >= 1000, `payout ${posted.total_payout_minor}`)
  assert(Number(posted.pos_sales_minor) >= 10000, `pos_sales_minor ${posted.pos_sales_minor}`)
  pass('money.rpc.run_payroll_confirm', String(runId))

  const { data: claimed, error: claimErr } = await admin
    .from('payroll_run_sales')
    .select('sale_id, total_minor')
    .eq('run_id', runId)
  assert(!claimErr, claimErr?.message)
  assert((claimed || []).some((r) => r.sale_id === sale.id), `sale not claimed: ${JSON.stringify(claimed)}`)
  pass('money.rpc.run_payroll_sale_claim', String(sale.id))

  await wipeSandboxPayroll()
  await wipeSandboxSales()
  const { count: left, error: leftErr } = await admin
    .from('payroll_runs')
    .select('id', { count: 'exact', head: true })
    .eq('branch', QA_BRANCH)
    .eq('period_start', QA_DATE)
    .ilike('notes', `%${QA_PAYROLL_NOTE}%`)
  assert(!leftErr, leftErr?.message)
  assert((left || 0) === 0, `sandbox payroll leftovers: ${left}`)
  const { count: salesLeft, error: salesLeftErr } = await admin
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('branch', QA_BRANCH)
    .ilike('notes', `%${QA_SALE_NOTE}%`)
  assert(!salesLeftErr, salesLeftErr?.message)
  assert((salesLeft || 0) === 0, `sandbox sale leftovers: ${salesLeft}`)
  pass('money.rpc.run_payroll_cleanup', 'sandbox wiped')
}

await boss.auth.signOut()

// ── chem.qa_seed_if_empty + chem.qa_recon_line ─────────────────────────────
{
  let { data: recon, error: reconErr } = await admin
    .from('inventory_recons')
    .select('id')
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()
  assert(!reconErr, reconErr?.message)

  if (!recon?.id) {
    const { data: inserted, error: seedErr } = await admin
      .from('inventory_recons')
      .insert({
        branch_slug: QA_BRANCH,
        week_of: QA_DATE,
        status: 'approved',
        notes: QA_RECON_NOTE,
        reviewed_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()
    assert(!seedErr && inserted?.id, `chem seed: ${seedErr?.message}`)
    recon = inserted
    pass('chem.qa_seed_if_empty', `inserted ${QA_RECON_NOTE}`)
  } else {
    pass('chem.qa_seed_if_empty', `already approved ${recon.id}`)
  }

  const { count: lineCount, error: lineCountErr } = await admin
    .from('inventory_recon_lines')
    .select('id', { count: 'exact', head: true })
    .eq('recon_id', recon.id)
  assert(!lineCountErr, lineCountErr?.message)

  if ((lineCount || 0) > 0) {
    pass('chem.qa_recon_line', `already ${lineCount} line(s)`)
  } else {
    const { data: product, error: prodErr } = await admin.from('products').select('id').limit(1).maybeSingle()
    assert(!prodErr && product?.id, `need a product for recon line: ${prodErr?.message}`)
    const { error: lineErr } = await admin.from('inventory_recon_lines').insert({
      recon_id: recon.id,
      product_id: product.id,
      previous_qty: 10,
      leftover_qty: 8,
    })
    assert(!lineErr, `chem line seed: ${lineErr?.message}`)
    pass('chem.qa_recon_line', `seeded product ${product.id}`)
  }
}

const failed = results.filter((r) => !r.ok)
console.log(`\ne2e-shift-close-money: ${failed.length ? 'FAIL' : 'PASS'} (${results.length} checks)`)
process.exit(failed.length ? 1 : 0)
