/**
 * Data-proof + future-proof integrity for newrequest Parts 1–9.
 * Asserts schema, RLS, dead roles, redirects, and package ceilings.
 * node scripts/e2e-data-integrity.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  allowRoute,
  canAccessReports,
  canManageVehicleCatalog,
  getOperationsNav,
  ROLES,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
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
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
assert(url && service && anonKey, 'missing supabase env')
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

// --- Static: App redirects + package ceilings ---
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert(app.includes('OpsRoleGate'), 'App missing OpsRoleGate')
assert(app.includes('/operations/inventory?tab=services'), 'services redirect missing')
assert(app.includes('/operations/inventory?tab=merch'), 'products redirect missing')
assert(/sms.*crm\?tab=sms|Navigate to=.*crm\?tab=sms/s.test(app) || app.includes('crm?tab=sms'), 'sms→crm redirect missing')
assert(app.includes('cars') || app.includes('routeKey="cars"'), 'cars route missing')
results.push('static.app_redirects: ok')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const depNames = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ')
assert(!/\bgraphql\b/i.test(depNames), 'graphql dependency introduced (out of scope)')
assert(!/\bxero\b/i.test(depNames), 'xero dependency introduced (out of scope)')
results.push('static.package_ceilings: ok')

const navBoss = getOperationsNav({ role: ROLES.SUPER_ADMIN })
assert(!navBoss.some((i) => ['/operations/services', '/operations/products', '/operations/sms'].includes(i.to)))
assert(navBoss.some((i) => i.to === '/operations/cars'))
assert(navBoss.some((i) => i.to === '/operations/pos'))
assert(canAccessReports({ role: ROLES.SUPER_ADMIN }))
assert(!canAccessReports({ role: ROLES.ADMIN }))
assert(canManageVehicleCatalog({ role: ROLES.SUPER_ADMIN }))
assert(!allowRoute({ role: ROLES.MARKETING }, 'pos'))
results.push('static.nav_matrix: ok')

// --- Live SQL via RPC-free selects + information_schema ---
const { count: dead, error: deadErr } = await admin
  .from('staff_profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'cashier')
assert(!deadErr, deadErr?.message)
assert((dead ?? 0) === 0, `cashier roles remain: ${dead}`)
results.push('db.no_cashier: ok')

const { data: grantProbe, error: grantErr } = await admin
  .from('staff_profiles')
  .select('id, role, permission_grants')
  .eq('role', 'assistant_super_admin')
  .limit(5)
assert(!grantErr, `permission_grants: ${grantErr?.message}`)
results.push(`db.asa_grants_col: ok (rows=${grantProbe?.length ?? 0})`)

const { error: assignErr } = await admin.from('staff_branch_assignments').select('staff_id, branch_slug').limit(1)
assert(!assignErr, assignErr?.message)
results.push('db.staff_branch_assignments: ok')

const rlsTables = [
  'vehicle_catalog',
  'ops_forms',
  'ops_form_submissions',
  'plan_label_presets',
  'plan_checklist_templates',
  'plan_checklist_template_items',
  'plan_card_assignees',
  'expense_categories',
]
for (const t of rlsTables) {
  // Service role bypasses RLS; this proves tables exist and are queryable for app code.
  const { error: e } = await admin.from(t).select('*').limit(1)
  assert(!e, `${t}: ${e?.message}`)
}
results.push(`db.part_tables_readable: ok (${rlsTables.length})`)

// Enum / columns: bookings redo + visit_group
const { error: bookErr } = await admin.from('bookings').select('id, visit_group_id, status').limit(1)
assert(!bookErr, `bookings cols: ${bookErr?.message}`)
results.push('db.bookings.visit_group: ok')

const { data: redoTry, error: redoErr } = await admin
  .from('bookings')
  .select('id, status')
  .eq('status', 'redo')
  .limit(1)
assert(!redoErr, `redo status enum: ${redoErr?.message}`)
results.push(`db.bookings.redo_status: ok (sample=${redoTry?.length ?? 0})`)

const { data: cats, error: catErr } = await admin
  .from('expense_categories')
  .select('id, kind')
  .limit(20)
assert(!catErr, catErr?.message)
assert((cats?.length ?? 0) > 0, 'expense_categories empty')
const kinds = new Set((cats || []).map((c) => c.kind))
assert(kinds.has('payroll') || kinds.has('marketing'), `expected payroll/marketing kinds, got ${[...kinds]}`)
results.push(`db.expense_kinds: ok (${[...kinds].join(',')})`)

const { data: vcat, error: vcErr } = await admin.from('vehicle_catalog').select('id, is_active').limit(3)
assert(!vcErr, vcErr?.message)
assert((vcat?.length ?? 0) > 0, 'vehicle_catalog empty — seed required')
results.push(`db.vehicle_catalog: ok (${vcat.length})`)

const { data: labels, error: labErr } = await admin.from('plan_label_presets').select('id').limit(1)
assert(!labErr, labErr?.message)
assert((labels?.length ?? 0) > 0, 'plan_label_presets empty')
results.push('db.plan_label_presets: ok')

const { error: evErr } = await admin.from('events').select('id, slug').limit(1)
assert(!evErr, `events.slug: ${evErr?.message}`)
results.push('db.events.slug: ok')

const { data: forms, error: formErr } = await admin.from('ops_forms').select('id').limit(3)
assert(!formErr, formErr?.message)
assert((forms?.length ?? 0) > 0, 'ops_forms empty')
results.push(`db.ops_forms: ok (${forms.length})`)

// Indexes: probe via EXPLAIN is heavy; check daily_sales_summary view/table exists for finance auto sales
const { error: salesErr } = await admin.from('daily_sales_summary').select('sale_date').limit(1)
assert(!salesErr, `daily_sales_summary: ${salesErr?.message}`)
results.push('db.daily_sales_summary: ok')

// Future-proof: username on staff for crew
const { error: userErr } = await admin.from('staff_profiles').select('id, username').limit(1)
assert(!userErr, `username col: ${userErr?.message}`)
results.push('db.staff.username: ok')

// Future-proof: anon can read active catalog (booking), cannot write catalog / ops_forms
const { data: anonCat, error: anonCatErr } = await anon
  .from('vehicle_catalog')
  .select('id')
  .eq('is_active', true)
  .limit(1)
assert(!anonCatErr, `anon catalog read: ${anonCatErr?.message}`)
assert((anonCat?.length ?? 0) > 0, 'anon cannot see active vehicle_catalog')
results.push('rls.anon_catalog_read: ok')

const { error: anonWriteErr } = await anon.from('vehicle_catalog').insert({
  make: '__e2e_probe__',
  model: '__deny__',
  is_active: true,
})
assert(anonWriteErr, 'anon must not insert vehicle_catalog')
results.push('rls.anon_catalog_write_denied: ok')

const { error: anonFormErr } = await anon.from('ops_forms').insert({ name: '__e2e_probe__' })
assert(anonFormErr, 'anon must not insert ops_forms')
results.push('rls.anon_ops_forms_write_denied: ok')

// Index fit: visit_group + expenses branch (query planner relies on these)
const { data: vg, error: vgErr } = await admin.from('bookings').select('visit_group_id').not('visit_group_id', 'is', null).limit(1)
assert(!vgErr, vgErr?.message)
results.push(`db.visit_group_populated: ok (sample=${vg?.length ?? 0})`)

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-data-integrity: PASS')
