/**
 * READ-ONLY: how many branches are test residue, and has any of it touched money?
 *
 * `probe-tl-crew-scope.mjs` surfaced 32 branches for a shop that trades on four
 * (hq, dasmarinas, bacoor, batangas). The rest are `crudtest-*`, `aud-*` and
 * `probe-*` rows left by earlier testing. Branch slugs key branch pickers, the
 * Finance P&L, daily sheets and POS till scoping, so residue there is not inert:
 * it shows up in dropdowns and, if it carries rows, in the books.
 *
 *   node scripts/probe-branch-residue.mjs
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

function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const RESIDUE = /^(crudtest|aud-|probe-)/i

const branches = readOrFail('branches', await db.from('branches').select('slug, name, is_active').limit(500)) || []
const real = branches.filter((b) => !RESIDUE.test(b.slug))
const residue = branches.filter((b) => RESIDUE.test(b.slug))

console.log('=== branch residue (READ-ONLY) ===\n')
console.log(`branches total: ${branches.length}`)
console.log(`  real     : ${real.length}  -> ${real.map((b) => b.slug).join(', ')}`)
console.log(`  residue  : ${residue.length}`)
console.log(`  inactive : ${branches.filter((b) => b.is_active === false).length}`)
console.log(`  active residue (these appear in branch pickers): ${residue.filter((b) => b.is_active !== false).length}`)
if (residue.length) console.log(`\n  slugs: ${residue.map((b) => b.slug).join(', ')}`)

const residueSlugs = new Set(residue.map((b) => b.slug))
if (residueSlugs.size === 0) {
  console.log('\nNo residue branches; nothing further to measure.')
  process.exit(0)
}

console.log('\n--- does the residue carry rows? ---')
const MONEY = [
  ['sales', 'branch'],
  ['bookings', 'branch'],
  ['daily_sheets', 'branch'],
  ['expenses', 'branch'],
  ['staff_attendance', 'branch_slug'],
]

let anyRows = false
for (const [table, col] of MONEY) {
  const res = await db.from(table).select(col).in(col, [...residueSlugs]).limit(5000)
  if (res.error) {
    console.log(`  ${table.padEnd(18)} (skipped: ${res.error.message})`)
    continue
  }
  const rows = readOrFail(`${table} read`, res) || []
  const byBranch = new Map()
  for (const r of rows) byBranch.set(r[col], (byBranch.get(r[col]) || 0) + 1)
  if (rows.length) anyRows = true
  console.log(`  ${table.padEnd(18)} rows on residue branches: ${rows.length}`)
  if (rows.length && byBranch.size <= 6) {
    for (const [b, n] of byBranch) console.log(`      ${b.padEnd(22)} ${n}`)
  }
}

// Staff parked on a residue branch would be invisible on a real roster.
const staff = readOrFail('staff_profiles', await db.from('staff_profiles').select('id, full_name, role, branch_slug, is_active').limit(1000)) || []
const stranded = staff.filter((s) => s.branch_slug && residueSlugs.has(s.branch_slug))
console.log(`\nstaff_profiles parked on a residue branch: ${stranded.length}`)
for (const s of stranded) console.log(`  ${s.full_name} (${s.role}) -> ${s.branch_slug}`)

console.log(`
VERDICT
  ${residue.filter((b) => b.is_active !== false).length} active residue branches sit in every branch
  picker. ${anyRows ? 'They also carry rows, so they can reach reports and the books.' : 'They carry no rows, so today they are cosmetic clutter rather than a money problem.'}
  Staff stranded on a residue branch: ${stranded.length}.
  Deleting them is a destructive production write and is NOT defaulted here —
  this probe only measures.
`)