/**
 * READ-ONLY: would the void migration abort on today's production data?
 *
 * The migration refuses to run unless the world still matches what was verified
 * when it was written — that is the right design, but it means the owner will
 * hit a hard ABORT if anything has drifted. Nobody should run it blind.
 *
 *   node scripts/probe-void-preconditions.mjs
 *
 * Writes nothing. It re-evaluates each guard exactly as the migration does.
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

/** Pass the real response object through — never rebuild it. See probeReadIntegrity.test.js. */
function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const FROM = '2026-09-28T16:00:00Z'
const TO = '2026-09-29T16:00:00Z'

// Guard 1: the two pending test hand-offs.
const handoffs = readOrFail(
  'pos_handoffs',
  await db
    .from('pos_handoffs')
    .select('id, booking_id, status, branch, created_at')
    .eq('status', 'pending')
    .eq('branch', 'bacoor')
    .gte('created_at', FROM)
    .lt('created_at', TO),
) || []

const plates = readOrFail('bookings plates', await db.from('bookings').select('id, vehicle_plate').in('id', handoffs.map((h) => h.booking_id))) || []
const plateById = new Map(plates.map((b) => [b.id, b.vehicle_plate]))
const targets = handoffs.filter((h) => ['ABC124', 'ABC7643'].includes(plateById.get(h.booking_id)))
const targetIds = targets.map((h) => h.id)

// Guard 2: expand to the whole visit.
const seed = readOrFail('bookings', await db.from('bookings').select('id, visit_group_id, status, is_archived').in('id', targets.map((h) => h.booking_id))) || []
const groupIds = [...new Set(seed.map((b) => b.visit_group_id).filter(Boolean))]
const siblings = groupIds.length
  ? readOrFail('siblings', await db.from('bookings').select('id').in('visit_group_id', groupIds)) || []
  : []
const groupIdsAll = [...new Set([...seed.map((b) => b.id), ...siblings.map((b) => b.id)])]

const groupRows = groupIdsAll.length
  ? readOrFail('group bookings', await db.from('bookings').select('id, vehicle_plate, status, is_archived').in('id', groupIdsAll)) || []
  : []

// Guard 3/4/5.
const sales = groupIdsAll.length
  ? readOrFail('sales', await db.from('sales').select('id, booking_id').in('booking_id', groupIdsAll)) || []
  : []
const txns = targetIds.length
  ? readOrFail('transactions', await db.from('transactions').select('id, pos_handoff_id, status').in('pos_handoff_id', targetIds)) || []
  : []

const checks = [
  { n: 1, label: 'exactly 2 pending test hand-offs (bacoor, 2026-09-29 Manila, plates ABC124/ABC7643)', got: targetIds.length, want: 2 },
  { n: 2, label: 'exactly 3 bookings across the two test visits', got: groupIdsAll.length, want: 3 },
  { n: 3, label: 'every target booking is open for_payment and unarchived', got: groupRows.filter((b) => b.status !== 'for_payment' || b.is_archived === true).length, want: 0 },
  { n: 4, label: 'zero sales attached to those bookings', got: sales.length, want: 0 },
  { n: 5, label: 'exactly 2 pending_payment transactions to cancel', got: txns.filter((t) => t.status === 'pending_payment').length, want: 2 },
]

console.log('=== void migration preconditions (READ-ONLY) ===\n')
console.log(`pending hand-offs in window: ${handoffs.length} (of which matching the test plates: ${targetIds.length})`)
for (const h of targets) console.log(`  ${h.id}  booking ${h.booking_id}  plate ${plateById.get(h.booking_id)}  ${h.created_at}`)
console.log('')
if (groupRows.length) {
  console.log('bookings the migration would touch:')
  for (const b of groupRows) console.log(`  ${b.id}  ${b.vehicle_plate}  ${b.status}${b.is_archived ? ' (archived)' : ''}`)
  console.log('')
}

let aborts = 0
for (const c of checks) {
  const ok = c.got === c.want
  if (!ok) aborts++
  console.log(`${ok ? 'PASS' : 'ABORT'}  guard ${c.n}: ${c.label}`)
  console.log(`          expected ${c.want}, found ${c.got}`)
}

console.log(`
VERDICT
  ${aborts === 0
    ? 'All five guards currently hold. The migration will run, not abort — safe to execute.'
    : `${aborts} guard(s) would ABORT. Do NOT run it until this is reconciled — that is the guard working, not a bug.`}
  Transaction statuses seen: ${[...new Set(txns.map((t) => t.status))].join(', ') || '(none)'}
  Nothing was written.
`)
process.exit(aborts === 0 ? 0 : 1)