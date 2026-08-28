/**
 * Readiness smoke for AUDIT_CHECKLIST P4 (live Supabase + env).
 * Does not mutate production beyond auth session checks / reads.
 * Usage: node scripts/e2e-readiness.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { loadCustomerPortal } from '../server/customerPortal.mjs'
import { lookupCustomerAuthStatus } from '../server/customerAuthLookup.mjs'
import { redirectForRole, canAccessCrm, canAccessPos, canAccessFinance, ROLES } from '../src/auth/permissions.js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const results = []

assert(url, 'SUPABASE_URL missing')
assert(anon, 'ANON key missing')
assert(service, 'SUPABASE_SERVICE_ROLE_KEY missing')
assert(process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY, 'VAPID public key missing')
assert(process.env.VAPID_PRIVATE_KEY, 'VAPID_PRIVATE_KEY missing')
results.push('env.supabase+vapid: ok')

// Part 9+: cashier removed; sales is an active form-bookings demo role
assert(OPS_DEMO_ACCOUNTS.some((a) => a.id === 'sales' && a.email === 'sales@hakumautocare.com'), 'sales demo missing')
assert(!OPS_DEMO_ACCOUNTS.some((a) => /cashier/i.test(a.email + a.id)), 'demoAccounts still has cashier')
results.push('demo.sales_ok_no_cashier: ok')
assert(redirectForRole(ROLES.SALES) === '/operations/bookings', 'sales home')
results.push('rbac.sales_home: ok')

if (process.env.BUSYBEE_API_KEY && process.env.BUSYBEE_CLIENT_ID) {
  results.push('env.busybee: present')
} else {
  results.push('env.busybee: skipped (optional for SMS page)')
}

const accounts = [
  { email: 'demo.customer@hakumautocare.com', password: 'HakumCustomer2026!', role: 'customer', home: '/account' },
  { email: 'bossmich@hakumautocare.com', password: 'HakumBoss2026!', role: ROLES.SUPER_ADMIN, home: '/operations/console' },
  { email: 'admin@hakumautocare.com', password: 'HakumAdmin2026!', role: ROLES.ADMIN, home: '/operations/pos' },
  { email: 'teamlead@hakumautocare.com', password: 'HakumTL2026!', role: ROLES.TEAM_LEAD, home: '/operations/queue' },
  { email: 'sales@hakumautocare.com', password: 'HakumSales2026!', role: ROLES.SALES, home: '/operations/bookings' },
  { email: 'staff1@hakumautocare.com', password: 'HakumStaff2026!', role: ROLES.STAFF, home: '/operations/attendance' },
  { email: 'marketing@hakumautocare.com', password: 'HakumMkt2026!', role: ROLES.MARKETING, home: '/operations/crm' },
]

for (const a of accounts) {
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: a.email, password: a.password })
  assert(!error && data.session, `${a.email}: ${error?.message || 'no session'}`)

  if (a.role === 'customer') {
    const portal = await loadCustomerPortal({ accessToken: data.session.access_token })
    assert(portal.profile?.role === 'customer', 'portal role')
    assert(Array.isArray(portal.branches), 'portal branches')
    assert(Array.isArray(portal.history), 'portal history')
    assert(Array.isArray(portal.vehicles), 'portal vehicles')
    results.push(`customer.portal: ok (branches=${portal.branches.length})`)

    const { needsRefresh, ensureFreshAccessToken } = await import('../src/lib/session.js')
    const sess = data.session
    assert(typeof needsRefresh(sess) === 'boolean', 'needsRefresh returns boolean')
    const fakeAuth = {
      getSession: async () => ({ data: { session: sess }, error: null }),
      refreshSession: async () => ({ data: { session: sess }, error: null }),
    }
    const tok = await ensureFreshAccessToken(fakeAuth)
    assert(tok === sess.access_token, 'ensureFreshAccessToken returns access_token')
    results.push('session.fresh_token: ok')
  } else {
    const { data: staff, error: staffErr } = await client
      .from('staff_profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle()
    assert(!staffErr, `${a.email} staff_profiles: ${staffErr?.message}`)
    assert(staff?.role === a.role, `${a.email} role want ${a.role} got ${staff?.role}`)
    assert(redirectForRole(staff.role) === a.home, `${a.email} home ${redirectForRole(staff.role)}`)
    const profile = { role: staff.role }
    if (a.role === ROLES.MARKETING) {
      assert(canAccessCrm(profile) && !canAccessFinance(profile), 'marketing CRM only')
    }
    if (a.role === ROLES.SALES) {
      assert(!canAccessPos(profile) && !canAccessFinance(profile), 'sales no POS/finance')
    }
    if (a.role === ROLES.STAFF) {
      assert(!canAccessCrm(profile) && !canAccessPos(profile), 'staff scoped')
    }
    results.push(`login.${a.role}: ok → ${a.home}`)
  }
  await client.auth.signOut()
}

const lookup = await lookupCustomerAuthStatus({ identifier: 'demo.customer@hakumautocare.com' })
assert(lookup.status === 'ready' || lookup.status === 'needs_password', `lookup status ${lookup.status}`)
results.push(`auth.lookup: ${lookup.status}`)

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: branches, error: brErr } = await admin
  .from('branches')
  .select('slug, name, is_active')
  .eq('is_active', true)
  .limit(5)
assert(!brErr && branches?.length, `branches: ${brErr?.message || 'empty'}`)
results.push(`public.branches: ${branches.length}`)

const { data: services, error: svcErr } = await admin
  .from('services')
  .select('id, name')
  .eq('is_active', true)
  .eq('is_archived', false)
  .limit(5)
assert(!svcErr && services?.length, `services: ${svcErr?.message || 'empty'}`)
results.push(`book.services: ${services.length}`)

const { data: queueView, error: qErr } = await admin.from('public_queue_counts').select('*').limit(5)
if (qErr) {
  // view may not exist in all envs — fall back to bookings count
  const { count, error: bErr } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .in('status', ['waiting', 'in_progress', 'final_checking'])
  assert(!bErr, `queue bookings: ${bErr?.message}`)
  results.push(`queue.active_bookings: ${count ?? 0}`)
} else {
  results.push(`queue.public_counts: ${queueView?.length ?? 0}`)
}

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-readiness: ok')
