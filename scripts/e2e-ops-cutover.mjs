/**
 * New Revisions ops cutover smoke — live Supabase + server seams.
 * Covers checklist items automatable without browser.
 *
 * Usage: node scripts/e2e-ops-cutover.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  getOperationsNav,
} from '../src/auth/permissions.js'
import {
  filterFinanceBranchOptions,
  canAccessCorporateFinance,
  CORPORATE_BRANCH_SLUG,
} from '../src/lib/financeCorporate.js'
import { customerNotifyAllowed } from '../src/lib/ownerRevisionsPhase7.js'
import { notifyBookingStatus } from '../server/notifyBooking.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, '')
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
const warnings = []

// ── 1. Investor scope ─────────────────────────────────────────────────────
const investorProfile = { role: ROLES.INVESTOR }
const nav = getOperationsNav(investorProfile)
assert(nav.length === 1 && nav[0].to === '/operations/finance', 'investor nav is Finance only')
assert(!canAccessCorporateFinance(investorProfile), 'investor cannot access corporate finance')

const { data: branches } = await admin.from('branches').select('slug, name').limit(20)
const filtered = filterFinanceBranchOptions(branches || [], investorProfile)
assert(!filtered.some((b) => b.slug === CORPORATE_BRANCH_SLUG), 'investor branch list hides HQ')
results.push('investor.nav_and_branches: ok')

const invClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: invAuth, error: invErr } = await invClient.auth.signInWithPassword({
  email: 'investor@hakumautocare.com',
  password: 'HakumInvest2026!',
})
assert(!invErr && invAuth.session, `investor login: ${invErr?.message}`)

const { data: invCorp, error: invCorpErr } = await invClient.from('corporate_balances').select('id').limit(1)
if (invCorp?.length) {
  throw new Error('investor RLS leak: corporate_balances returned rows')
}
if (invCorpErr && !/permission|RLS|denied|JWT|42501/i.test(invCorpErr.message || '')) {
  throw new Error(`investor corporate_balances unexpected: ${invCorpErr.message}`)
}
results.push('investor.rls_corporate: denied')

const financePage = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
assert(financePage.includes('canAccessCorporateFinance'), 'FinancePage corporate gate present')
await invClient.auth.signOut()

// ── 2. BA blocked from payroll confirm ────────────────────────────────────
const baClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: baAuth, error: baErr } = await baClient.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
assert(!baErr && baAuth.session, `BA login: ${baErr?.message}`)
const { data: baStaff } = await baClient
  .from('staff_profiles')
  .select('role')
  .eq('id', baAuth.user.id)
  .maybeSingle()
assert(baStaff?.role === ROLES.ADMIN, 'admin demo is branch admin role')
const { error: baRpcErr } = await baClient.rpc('run_payroll', { payload: {} })
assert(baRpcErr, 'BA rpc run_payroll must fail')
results.push(`ba.run_payroll_blocked: ${baRpcErr.message.slice(0, 60)}`)
await baClient.auth.signOut()

// ── 3. Branch stock (POS fail-closed) ─────────────────────────────────────
const { count: stockCount, error: stockErr } = await admin
  .from('product_branch_stock')
  .select('id', { count: 'exact', head: true })
  .eq('branch_slug', 'bacoor')
assert(!stockErr, stockErr?.message)
assert(stockCount > 0, 'bacoor product_branch_stock empty — run scripts/seed-branch-stock.sql')
results.push(`stock.bacoor_rows: ${stockCount}`)

// ── 4. Customer mute → notify skipped ─────────────────────────────────────
const { data: demoCust } = await admin
  .from('customers')
  .select('id, notify_sms, notify_push, is_disabled')
  .eq('email', 'demo.customer@hakumautocare.com')
  .maybeSingle()

if (demoCust?.id) {
  const prev = { notify_sms: demoCust.notify_sms, notify_push: demoCust.notify_push, is_disabled: demoCust.is_disabled }
  await admin.from('customers').update({ notify_sms: false, notify_push: false }).eq('id', demoCust.id)
  assert(!customerNotifyAllowed({ notify_sms: false, is_disabled: false }, 'sms'))
  const muted = await notifyBookingStatus(
    { id: '00000000-0000-0000-0000-000000000099', status: 'in_progress', customer_id: demoCust.id, customer_phone: '09180000001' },
    'in_progress',
  )
  assert(muted?.skipped || muted?.sms?.status === 'muted', 'muted customer must skip or mute SMS')
  await admin.from('customers').update(prev).eq('id', demoCust.id)
  results.push('customer.mute_notify: skipped')
} else {
  warnings.push('customer.mute_notify: demo customer row not found — skipped')
}

// ── 5. Sunday recon + floor chemical data ─────────────────────────────────
const { count: reconApproved, error: reconErr } = await admin
  .from('inventory_recons')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'approved')
assert(!reconErr, reconErr?.message)
if (reconApproved > 0) {
  results.push(`recon.approved_count: ${reconApproved}`)
} else {
  warnings.push('recon.approved_count: 0 — floor chemical chart stays stub until first BA→SA approve')
}

// ── 6. Experience investigation cards ───────────────────────────────────
const { count: expCards, error: expErr } = await admin
  .from('plan_cards')
  .select('id', { count: 'exact', head: true })
  .ilike('title', '%experience%')
assert(!expErr, expErr?.message)
if (expCards > 0) {
  results.push(`detailing.experience_cards: ${expCards}`)
} else {
  warnings.push('detailing.experience_cards: 0 — complete outcome 2/3 in UI to seed')
}

// ── 7. Performance: lazy routes present ─────────────────────────────────
const appSrc = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert(appSrc.includes('lazy('), 'App.jsx must lazy-load heavy routes')
results.push('perf.lazy_routes: ok')

console.log(results.join('\n'))
if (warnings.length) {
  console.log('\nWARNINGS (manual demo still needed):')
  console.log(warnings.join('\n'))
}
console.log('\ne2e-ops-cutover: PASS')
