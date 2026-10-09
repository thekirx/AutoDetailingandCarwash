/**
 * READ-ONLY: do Team Leads and crew actually see only their own branch, and
 * has the geo-spoof alerting ever fired?
 *
 * This is the last unaudited daily-operations surface. Branch over-scope is
 * the expensive failure: a TL or crew member reading another branch's roster,
 * attendance or payroll silently corrupts the day and nobody notices.
 *
 *   node scripts/probe-tl-crew-scope.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

/**
 * PostgREST returns `{ data: null, error }` rather than throwing, so a wrong
 * column or a denied select yields null — a broken read, not an empty table.
 * An earlier probe in this repo passed a fabricated `{ data: null, error }`
 * into exactly this helper and printed a clean "0 affected" for tables holding
 * thousands of rows, so the whole result object is passed through, never rebuilt.
 */
function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const staff = readOrFail('staff_profiles', await db.from('staff_profiles').select('id, full_name, role, branch_slug, is_active').limit(1000)) || []
const branches = readOrFail('branches', await db.from('branches').select('slug, name').limit(200)) || []
const slugs = branches.map((b) => b.slug)

console.log('=== TL / crew branch scope (READ-ONLY) ===\n')
console.log(`staff_profiles: ${staff.length}   branches: ${branches.length} -> ${slugs.join(', ')}\n`)

const byRole = new Map()
for (const s of staff) {
  const k = s.role || '(none)'
  byRole.set(k, (byRole.get(k) || 0) + 1)
}
console.log('roles:', [...byRole.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}=${n}`).join('  '))

/** The branches a staff row can actually reach. */
function scopeOf(s) {
  // `branch_slugs` is a client-side normalizer, not a column — reading it from
  // PostgREST is a 42703 that readOrFail correctly refuses to swallow.
  return s.branch_slug ? [s.branch_slug] : []
}

const scopeRows = []
for (const role of ['team_lead', 'staff', 'detailer', 'video_editor']) {
  const rows = staff.filter((s) => s.role === role && s.is_active !== false)
  const unscoped = rows.filter((s) => scopeOf(s).length === 0)
  const multi = rows.filter((s) => scopeOf(s).length > 1)
  scopeRows.push({ role, active: rows.length, unscoped: unscoped.length, multi: multi.length, unscopedNames: unscoped.map((s) => s.full_name) })
  console.log(
    `${role.padEnd(14)} active=${String(rows.length).padEnd(4)} ` +
      `NO BRANCH=${String(unscoped.length).padEnd(4)} multi-branch=${multi.length}` +
      (unscoped.length ? `  -> ${unscoped.map((s) => s.full_name).join(', ')}` : ''),
  )
}

// Attendance is the daily-operations artifact these roles own. A crew row whose
// branch is not in the staff member's scope is a real over-scope signal.
const att = readOrFail('staff_attendance', await db.from('staff_attendance').select('id, staff_id, branch_slug, attendance_date, status').limit(5000)) || []
console.log(`\nstaff_attendance rows read: ${att.length}`)

const byId = new Map(staff.map((s) => [s.id, s]))
const orphan = att.filter((a) => !byId.has(a.staff_id))
console.log(`  attendance rows whose staff_id is not in staff_profiles: ${orphan.length}`)

const outOfScope = att.filter((a) => {
  const s = byId.get(a.staff_id)
  if (!s) return false
  const scope = scopeOf(s)
  if (scope.length === 0) return true // unscoped staff: cannot be verified either way
  return !scope.includes(a.branch_slug)
})
console.log(`  attendance rows on a branch outside the staff member's scope: ${outOfScope.length}`)
if (outOfScope.length) {
  const sample = outOfScope.slice(0, 8)
  for (const a of sample) {
    const s = byId.get(a.staff_id)
    console.log(`    ${a.attendance_date} ${a.branch_slug}  ${s?.full_name} (${s?.role}) scope=${JSON.stringify(scopeOf(s))}`)
  }
}

// Has the spoof alerting ever fired on a real device?
const alertsRes = await db.from('attendance_location_alerts').select('*', { count: 'exact', head: true })
if (alertsRes.error) {
  console.log(`\nattendance_location_alerts: not in the schema cache (${alertsRes.error.message})`)
} else {
  console.log(`\nattendance_location_alerts: ${alertsRes.count} rows`)
  const alerts = readOrFail('alerts read', await db.from('attendance_location_alerts').select('staff_id, branch_slug, reasons, created_at').limit(500)) || []
  const reasons = new Map()
  for (const a of alerts) for (const r of a.reasons || []) reasons.set(r, (reasons.get(r) || 0) + 1)
  console.log('  reasons:', [...reasons.entries()].sort((x, y) => y[1] - x[1]).map(([r, n]) => `${r}=${n}`).join('  ') || '(none)')
}

console.log(`
VERDICT
  A NO BRANCH count above 0 means those roles resolve with an empty branch
  scope. Whether that is a leak depends entirely on the SQL: BUG TL-C3 raised
  42501 for a null TL branch precisely so it cannot widen to company-wide.
  Confirm that before treating it as over-scope.
`)