/**
 * Part 9: full RBAC matrix across roles + Part 1–8 route/grant checks + DB smoke.
 * node scripts/e2e-rbac-matrix.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import {
  ROLES,
  allowRoute,
  canAccessCrm,
  canAccessFinance,
  canAccessPos,
  canAccessReports,
  canEditPlanning,
  canManageVehicleCatalog,
  canWriteFinance,
  getBranchScopeList,
  getOperationsNav,
  hasGrant,
} from '../src/auth/permissions.js'
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
assert(url && anon && service, 'missing supabase env')
const results = []

// --- Static matrix (no network) ---
const boss = { role: ROLES.SUPER_ADMIN }
const admin = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor', 'imus'] }
const asaDefault = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
const asaLocked = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { reports: false, pos: false, finance_write: false, planning_edit: false } }
const asaWriter = {
  role: ROLES.ASSISTANT_SUPER_ADMIN,
  permission_grants: { finance_write: true, planning_edit: true, reports: true },
}
const tl = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }
const staff = { role: ROLES.STAFF, branch_slug: 'bacoor' }
const mkt = { role: ROLES.MARKETING }

assert(canAccessReports(boss) && canManageVehicleCatalog(boss) && canEditPlanning(boss))
assert(!canAccessReports(admin) && !canManageVehicleCatalog(admin))
assert(canAccessPos(admin) && canAccessFinance(admin) && canWriteFinance(admin))
assert(getBranchScopeList(admin).includes('imus'))

assert(canAccessReports(asaDefault) && canAccessPos(asaDefault))
assert(!canWriteFinance(asaDefault) && !canEditPlanning(asaDefault))
assert(canWriteFinance(asaWriter) && canEditPlanning(asaWriter))
assert(!canAccessReports(asaLocked) && !canAccessPos(asaLocked))
assert(hasGrant(asaDefault, 'reports') === true)

assert(allowRoute(tl, 'kpi') && allowRoute(tl, 'bookings') && !allowRoute(tl, 'finance'))
assert(allowRoute(staff, 'my-tasks') && !allowRoute(staff, 'pos'))
assert(canAccessCrm(mkt) && !canAccessPos(mkt) && !canAccessFinance(mkt))
assert(getOperationsNav(mkt).every((i) => i.to === '/operations/crm'))
assert(!getOperationsNav(boss).some((i) => i.to === '/operations/services' || i.to === '/operations/sms'))
assert(getOperationsNav(boss).some((i) => i.to === '/operations/cars'))

assert(OPS_DEMO_ACCOUNTS.some((d) => d.id === 'sales' && d.email === 'sales@hakumautocare.com'))
for (const demo of OPS_DEMO_ACCOUNTS) {
  assert(!/cashier/i.test(demo.id + demo.label + demo.email), `demo still cashier: ${demo.email}`)
}
const salesProfile = { role: ROLES.SALES, branch_slug: 'bacoor' }
assert(allowRoute(salesProfile, 'bookings') && !allowRoute(salesProfile, 'pos') && !allowRoute(salesProfile, 'queue'))
assert(getOperationsNav(salesProfile).every((i) => i.to === '/operations/bookings'))
results.push('matrix.static: ok')

// --- Live DB ---
const adminClient = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { count: deadRoles, error: deadErr } = await adminClient
  .from('staff_profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'cashier')
assert(!deadErr, deadErr?.message)
assert((deadRoles ?? 0) === 0, `cashier rows remain: ${deadRoles}`)
results.push('db.no_cashier: ok')

const partTables = [
  'vehicle_catalog',
  'ops_forms',
  'ops_form_submissions',
  'plan_label_presets',
  'plan_checklist_templates',
  'expense_categories',
  'staff_branch_assignments',
]
for (const table of partTables) {
  // staff_branch_assignments PK is (staff_id, branch_slug) — no id column
  const col = table === 'staff_branch_assignments' ? 'staff_id' : 'id'
  const { error } = await adminClient.from(table).select(col).limit(1)
  assert(!error, `${table}: ${error?.message}`)
}
results.push(`db.part_tables: ok (${partTables.length})`)

const { data: events, error: evErr } = await adminClient.from('events').select('id, slug').not('slug', 'is', null).limit(1)
assert(!evErr, `events.slug: ${evErr?.message}`)
results.push(`db.events.slug: ok (${events?.length ? 'sample' : 'empty'})`)

// Role logins + route homes
const logins = [
  { email: 'bossmich@hakumautocare.com', password: 'HakumBoss2026!', role: ROLES.SUPER_ADMIN, mustAllow: ['reports', 'cars', 'finance', 'pos'] },
  { email: 'admin@hakumautocare.com', password: 'HakumAdmin2026!', role: ROLES.ADMIN, mustAllow: ['pos', 'finance', 'crm'], mustDeny: ['reports', 'cars'] },
  { email: 'teamlead@hakumautocare.com', password: 'HakumTL2026!', role: ROLES.TEAM_LEAD, mustAllow: ['kpi', 'bookings', 'queue'], mustDeny: ['finance', 'reports'] },
  { email: 'staff1@hakumautocare.com', password: 'HakumStaff2026!', role: ROLES.STAFF, mustAllow: ['my-tasks'], mustDeny: ['pos', 'finance'] },
  { email: 'marketing@hakumautocare.com', password: 'HakumMkt2026!', role: ROLES.MARKETING, mustAllow: ['crm'], mustDeny: ['pos', 'finance', 'kpi'] },
]

for (const a of logins) {
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: a.email, password: a.password })
  assert(!error && data.session, `${a.email}: ${error?.message || 'no session'}`)
  const { data: staff, error: sErr } = await client
    .from('staff_profiles')
    .select('id, role, permission_grants, branch_slug')
    .eq('id', data.user.id)
    .eq('is_active', true)
    .maybeSingle()
  assert(!sErr && staff?.role === a.role, `${a.email} role ${staff?.role}`)
  const profile = {
    role: staff.role,
    permission_grants: staff.permission_grants || {},
    branch_slug: staff.branch_slug,
  }
  for (const key of a.mustAllow || []) assert(allowRoute(profile, key), `${a.role} allow ${key}`)
  for (const key of a.mustDeny || []) assert(!allowRoute(profile, key), `${a.role} deny ${key}`)
  results.push(`login.${a.role}: ok`)
  await client.auth.signOut()
}

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-rbac-matrix: PASS')
