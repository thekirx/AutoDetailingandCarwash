/**
 * Part 1 RBAC live smoke: matrix helpers + DB role/grants/branches.
 * node scripts/e2e-rbac-part1.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import {
  ROLES,
  allowRoute,
  canAccessReports,
  canEditPlanning,
  getOperationsNav,
} from '../src/auth/permissions.js'

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

// Unit matrix (no network)
assert(canAccessReports({ role: ROLES.SUPER_ADMIN }), 'boss reports')
assert(!canAccessReports({ role: ROLES.ADMIN }), 'admin no reports')
assert(canEditPlanning({ role: ROLES.SUPER_ADMIN }), 'boss planning edit')
assert(!canEditPlanning({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }), 'assistant default no planning edit')
assert(allowRoute({ role: ROLES.ADMIN }, 'pos'), 'admin pos')
assert(!getOperationsNav({ role: ROLES.SUPER_ADMIN }).some((i) => i.to === '/operations/services'), 'no services nav')
results.push('matrix.helpers: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: roles, error: roleErr } = await admin.rpc('is_assistant_super_admin').then(() => ({ data: true, error: null })).catch((e) => ({ data: null, error: e }))
// prove enum + columns via SQL-ish REST
const { data: cols, error: colErr } = await admin.from('staff_profiles').select('id, role, permission_grants').limit(1)
assert(!colErr, `staff_profiles.permission_grants: ${colErr?.message}`)
assert(cols, 'staff_profiles readable')
results.push('db.permission_grants: ok')

const { data: assigns, error: aErr } = await admin.from('staff_branch_assignments').select('staff_id, branch_slug').limit(5)
assert(!aErr, `assignments: ${aErr?.message}`)
results.push(`db.staff_branch_assignments: ${assigns?.length ?? 0} rows sample`)

const { count: salesLeft, error: sErr } = await admin
  .from('staff_profiles')
  .select('id', { count: 'exact', head: true })
  .in('role', ['sales', 'cashier'])
assert(!sErr, sErr?.message)
assert((salesLeft ?? 0) === 0, `sales/cashier still present: ${salesLeft}`)
results.push('db.no_sales_cashier: ok')

const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: login, error: loginErr } = await client.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
assert(!loginErr && login.session, loginErr?.message || 'admin login')
const { data: me } = await client
  .from('staff_profiles')
  .select('id, role, permission_grants')
  .eq('id', login.user.id)
  .maybeSingle()
assert(me?.role === 'admin', `admin role ${me?.role}`)
const { data: myBranches } = await client
  .from('staff_branch_assignments')
  .select('branch_slug')
  .eq('staff_id', login.user.id)
assert(Array.isArray(myBranches), 'admin can read own assignments')
results.push(`login.admin: ok branches=${myBranches?.length ?? 0}`)
await client.auth.signOut()

const boss = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { error: bossErr } = await boss.auth.signInWithPassword({
  email: 'bossmich@hakumautocare.com',
  password: 'HakumBoss2026!',
})
assert(!bossErr, bossErr?.message)
results.push('login.boss: ok')
await boss.auth.signOut()

void roles
console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-rbac-part1: ok')
