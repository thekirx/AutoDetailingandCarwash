/**
 * Reopen the accepted Bacoor close and resubmit the drawer at paid POS.
 * Does not create a sale and does not touch payroll.
 *   node scripts/e2e-shift-close-reopen.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    if (!process.env[k]) process.env[k] = line.slice(i + 1)
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !anon) throw new Error('missing supabase url/anon key')

if (process.argv.includes('--ui')) {
  const { default: puppeteer } = await import('puppeteer')
  const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
  const bossAcct = account('boss')
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 120000, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.type('input[type="email"], input[name="email"]', bossAcct.email, { delay: 4 })
  await page.type('input[type="password"]', bossAcct.password, { delay: 4 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(
    () => location.pathname.startsWith('/operations') && !location.pathname.includes('login'),
    { timeout: 60000 },
  )
  await page.goto(
    `${base}/operations/finance?tab=shift-close&period=custom&from=2026-09-23&to=2026-09-23`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await page.waitForFunction(() => {
    const text = document.body.innerText
    return text.includes('Shift reviews') && !text.includes('Loading…') && !text.includes('Loading...')
  }, { timeout: 30000 })
  const reviewButtons = await page.$$('button')
  let clicked = false
  for (const button of reviewButtons) {
    const label = await page.evaluate((el) => el.textContent || '', button)
    if (label.trim() === 'Review') {
      await button.click()
      clicked = true
      break
    }
  }
  if (!clicked) {
    const labels = await page.$$eval('button', (nodes) => nodes.map((n) => (n.textContent || '').trim()).slice(0, 40))
    const text = await page.evaluate(() => document.body.innerText.slice(0, 1500))
    throw new Error(`Review button not on the shift close tab\nbuttons: ${labels.join(' | ')}\n---\n${text}`)
  }
  await page.waitForFunction(() => document.body.innerText.includes('Reopen for a new count'), { timeout: 15000 })
  const text = await page.evaluate(() => document.body.innerText)
  if (!text.includes('Lock day')) throw new Error('Lock day missing beside reopen')
  if (!/4,501|4501/.test(text)) throw new Error('accepted drawer does not show ₱4,501')
  await page.screenshot({
    path: join(root, 'e2e-evidence', 'lifecycle-day', 'shift-close-reopen.png'),
    fullPage: false,
    timeout: 15000,
  })
  await browser.close()
  console.log('✔ ui.reopen_button BossMich sees reopen on the accepted ₱4,501 close')
  process.exit(0)
}

const guardsOnly = process.argv.includes('--guards')
const CLOSE_ID = 'fe49d6fb-b7f9-4979-9ef1-7305a1c17ef4'
const BRANCH = 'bacoor'
const DATE = '2026-09-23'
const DRAWER = 450100
const PAYROLL_ID = 'c2b5f7de-9349-4e8f-bd55-b9b3f9815a8c'

function account(id) {
  return OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
}

async function asUser(id) {
  const acct = account(id)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`${id} login: ${error.message}`)
  return client
}

const boss = await asUser('boss')
const asa = await asUser('asa')
const { error: asaErr } = await asa.rpc('review_shift_close', {
  payload: { id: CLOSE_ID, action: 'reopen', review_note: 'ASA must not reopen' },
})
if (!asaErr || !/Only Super Admin may reopen/i.test(asaErr.message)) {
  throw new Error(`asa guard: ${asaErr?.message || 'ASA reopen succeeded'}`)
}
console.log('✔ reopen.asa_refused')
const { error: missingNote } = await boss.rpc('review_shift_close', {
  payload: { id: CLOSE_ID, action: 'reopen' },
})
if (!missingNote || !/Reopen requires a review note/i.test(missingNote.message)) {
  throw new Error(`missing-note guard: ${missingNote?.message || 'reopen without a note succeeded'}`)
}
console.log('✔ reopen.note_required')

const { data: locked } = await boss
  .from('shift_close_reports')
  .select('id')
  .eq('status', 'locked')
  .limit(1)
  .maybeSingle()
if (locked?.id) {
  const { error: lockedErr } = await boss.rpc('review_shift_close', {
    payload: { id: locked.id, action: 'reopen', review_note: 'QA locked probe' },
  })
  if (!lockedErr || !/locked/i.test(lockedErr.message)) {
    throw new Error(`locked guard: ${lockedErr?.message || 'locked reopen succeeded'}`)
  }
  console.log('✔ reopen.locked_refused', locked.id)
} else {
  console.log('✔ reopen.locked_refused skipped — no locked row')
}
if (guardsOnly) {
  console.log('✔ guards.only')
  process.exit(0)
}

const { data: reopened, error: reopenErr } = await boss.rpc('review_shift_close', {
  payload: { id: CLOSE_ID, action: 'reopen', review_note: 'Drawer was ₱1; paid POS is ₱4,501' },
})
if (reopenErr) throw new Error(reopenErr.message)
if (reopened?.status !== 'rejected') throw new Error(`reopen status ${reopened?.status}`)
console.log('✔ reopen.accepted_to_rejected', reopened.status)

const admin = await asUser('admin')
const baseline = {
  square_sales_minor: DRAWER,
  cash_sales_minor: DRAWER,
  total_gcash_minor: 0,
  credit_card_minor: 0,
  total_expenses_minor: 0,
  ca_collected_minor: 0,
  downpayments_minor: 0,
  total_cash_left_minor: DRAWER,
}
const { error: submitErr } = await admin.rpc('submit_shift_close', {
  payload: {
    branch: BRANCH,
    business_date: DATE,
    shift_ended_at: new Date().toISOString(),
    pos_baseline: baseline,
    submitted: baseline,
    override_reasons: {},
  },
})
if (submitErr) throw new Error(submitErr.message)
console.log('✔ submit.drawer', DRAWER)

const { error: acceptErr } = await boss.rpc('review_shift_close', {
  payload: { id: CLOSE_ID, action: 'accept', review_note: 'Drawer matches paid POS ₱4,501' },
})
if (acceptErr) throw new Error(acceptErr.message)

const { data: row, error: rowErr } = await boss
  .from('shift_close_reports')
  .select('id, status, submitted, pos_baseline')
  .eq('id', CLOSE_ID)
  .single()
if (rowErr) throw new Error(rowErr.message)
const submitted = Number(row.submitted?.square_sales_minor)
const baselineSales = Number(row.pos_baseline?.square_sales_minor)
if (row.status !== 'accepted' || submitted !== DRAWER || baselineSales !== DRAWER) {
  throw new Error(`close ${row.status} submitted ${submitted} baseline ${baselineSales}`)
}
console.log('✔ close.matches_paid_pos', row.status, submitted)

const { data: payroll, error: payErr } = await boss
  .from('payroll_runs')
  .select('id, status, total_payout_minor')
  .eq('id', PAYROLL_ID)
  .single()
if (payErr) throw new Error(payErr.message)
if (payroll.status !== 'confirmed' || Number(payroll.total_payout_minor) !== 157535) {
  throw new Error(`payroll ${payroll.status} ${payroll.total_payout_minor}`)
}
console.log('✔ payroll.unchanged', payroll.status, payroll.total_payout_minor)
