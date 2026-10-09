/**
 * READ-ONLY: are the stranded POS hand-offs real revenue or September seed data?
 *
 * This matters because scripts/seed/wipe-september-2026.sql removes seeded
 * bookings but does NOT remove pos_handoffs. If a stranded hand-off points at a
 * seeded booking, then running the September cleanup would leave the hand-off
 * pointing at a row that no longer exists — turning BUG-061's "both bookings
 * verified to exist" into a dangling reference and potentially failing the FK.
 *
 *   node scripts/probe-stranded-handoffs.mjs
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
 * PostgREST returns `{ data: null, error }` rather than throwing, so a bad
 * column or a denied select silently yields null. That is not an empty result,
 * it is a broken read — and this probe's output decides what a destructive
 * cleanup may delete, so a broken read has to stop the run instead of being
 * rendered as "no such row".
 *
 * This is not hypothetical: the customer read selected `name`, which does not
 * exist (it is `full_name`). The error was never surfaced, so every customer
 * printed MISSING and the seed marker silently evaluated false. The verdict was
 * still right for these rows only because the plate marker carried it.
 */
function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

// The same markers wipe-september-2026.sql keys on.
const SEED_EMAIL = /@sep2026\.hakum\.test|@seed\.hakum\.test/i
const SEED_PLATE = /^ZZ[BT]\d{4}$/

const handoffs = readOrFail('pos_handoffs', await db
  .from('pos_handoffs')
  .select('id, booking_id, customer_id, amount_minor, status, created_at, branch')
  .eq('status', 'pending'))

console.log(`pending hand-offs: ${handoffs?.length ?? 0}\n`)

for (const h of handoffs || []) {
  const b = readOrFail('bookings', await db
    .from('bookings')
    .select('id, status, branch, customer_id, vehicle_plate, notes, created_at')
    .eq('id', h.booking_id)
    .maybeSingle())
  const c = readOrFail('customers', await db
    .from('customers')
    .select('id, email, full_name')
    .eq('id', h.customer_id)
    .maybeSingle())

  const emailSeeded = SEED_EMAIL.test(c?.email || '')
  const plateSeeded = SEED_PLATE.test(b?.vehicle_plate || '')
  const inSeedMonth = String(b?.created_at || '').slice(0, 7) === '2026-09'

  console.log('---')
  console.log(`  hand-off : ${h.id.slice(0, 8)}  PHP ${(h.amount_minor / 100).toFixed(2)}  branch ${h.branch}`)
  console.log(`  created  : ${String(h.created_at).slice(0, 10)}`)
  // "NO ROW" now means the read succeeded and the row is genuinely absent —
  // a failed read would have thrown above, so the two can no longer be confused.
  console.log(`  booking  : ${b ? `status=${b.status} plate=${b.vehicle_plate} created=${String(b.created_at).slice(0, 10)}` : 'NO ROW'}`)
  console.log(`  customer : ${c ? `${c.email} | ${c.full_name}` : 'NO ROW'}`)
  console.log(`  in 2026-09 : ${inSeedMonth}`)
  console.log(`  seed email  : ${emailSeeded}`)
  console.log(`  seed plate  : ${plateSeeded}`)
  const seeded = emailSeeded || plateSeeded
  console.log(`  VERDICT     : ${seeded ? 'SEEDED - falls in the September cleanup scope' : 'real data - NOT touched by the September cleanup'}`)
}

console.log('\nNote: wipe-september-2026.sql removes seeded bookings but never pos_handoffs.')
console.log('A hand-off whose booking is seeded would be left pointing at a removed row.')
console.log('\n(read-only probe — no writes issued)')