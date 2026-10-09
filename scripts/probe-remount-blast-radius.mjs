/**
 * READ-ONLY: how many customers would be damaged if a POS re-provision
 * remounted them onto a new Auth uid?
 *
 * `remountCustomerOntoAuthUid` (server/provisionCustomer.mjs) moves
 * bookings / vehicles / sales onto the new id and then DELETES the old
 * `customers` row. It does NOT move every table that references
 * customers(id), and it never checks the delete's error:
 *
 *   loyalty_ledger          on delete restrict -> DELETE silently fails
 *   customer_memberships    on delete cascade   -> membership silently lost
 *   customer_birthday_perks on delete cascade   -> perk silently lost
 *
 * Both outcomes corrupt the customer's history, which is exactly what the
 * "retain customer + transaction data permanently" requirement forbids.
 *
 *   node scripts/probe-remount-blast-radius.mjs
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
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

/**
 * PostgREST returns `{ data: null, error }` rather than throwing, so a bad column
 * or a denied select silently yields null. That is a broken read, not an empty
 * result, and this probe's output decides how urgent a data-loss fix is.
 *
 * Pass the WHOLE result object. An earlier version of this probe called
 * `readOrFail(label, { data: null, error })`, which made every read return null
 * and printed a clean "0 customers affected" for every table — including tables
 * that hold thousands of rows. A probe that cannot report a problem is worse
 * than no probe, so the count is cross-checked against a raw row count below.
 */
function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const TABLES = [
  ['loyalty_ledger', 'restrict — DELETE FAILS silently'],
  ['customer_memberships', 'cascade — membership DESTROYED'],
  ['customer_birthday_perks', 'cascade — perk DESTROYED'],
]

async function totalRows(table) {
  const res = await db.from(table).select('*', { count: 'exact', head: true })
  readOrFail(`${table} count`, res)
  return res.count ?? 0
}

async function distinctOwners(table) {
  const res = await db.from(table).select('customer_id').not('customer_id', 'is', null).limit(5000)
  const rows = readOrFail(`${table} read`, res) || []
  return { owners: new Set(rows.map((r) => r.customer_id)).size, rows: rows.length }
}

console.log('=== remount blast radius (READ-ONLY) ===\n')

const customersRes = await db.from('customers').select('*', { count: 'exact', head: true })
// head:true returns no rows, so the count lives on the result, not on `data`.
readOrFail('customers count', customersRes)
const customerCount = customersRes.count ?? 0
console.log(`customers total: ${customerCount}\n`)

console.log('tables the remount does NOT move before deleting the old row:')
for (const [table, consequence] of TABLES) {
  const { owners } = await distinctOwners(table)
  const total = await totalRows(table)
  console.log(
    `  ${table.padEnd(24)} rows=${String(total).padEnd(5)} owners=${String(owners).padEnd(5)} ${consequence}`,
  )
}

console.log('\ntables the remount DOES move (for contrast — these are handled):')
for (const table of ['sales', 'bookings', 'vehicles']) {
  const { owners } = await distinctOwners(table)
  const total = await totalRows(table)
  console.log(`  ${table.padEnd(24)} rows=${String(total).padEnd(5)} owners=${String(owners).padEnd(5)} moved by the remount`)
}

console.log(`
VERDICT
  Any customer counted above is one re-provision away from a corrupted history.
  With a loyalty_ledger row the old-row DELETE fails on the restrict FK and the
  error is never read, so the request still returns 200 while a second orphaned
  customers row survives; phone lookup then resolves to whichever row sorts
  first. Without one, the DELETE succeeds and cascades away memberships and perks.
`)