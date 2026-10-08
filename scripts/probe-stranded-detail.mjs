/**
 * READ-ONLY: exact provenance of the two stranded POS hand-offs.
 *
 * A previous probe reported "customer MISSING" for both. That phrase is
 * ambiguous and must not be trusted on its own: a PostgREST
 * `.eq('id', null)` returns zero rows with no error, which looks identical to
 * "no such customer". This prints the raw values so the distinction is
 * explicit, and follows the hand-off's customer_id onto the BOOKING's
 * customer_id, which is the one that actually has to resolve.
 *
 *   node scripts/probe-stranded-detail.mjs
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

const { data: handoffs } = await db
  .from('pos_handoffs')
  .select('id, booking_id, customer_id, transaction_id, amount_minor, status, created_at, branch, currency')
  .eq('status', 'pending')

const show = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'string' ? (v || '(empty string)') : String(v))

for (const h of handoffs || []) {
  console.log('================================================')
  console.log(`hand-off ${h.id.slice(0, 8)}   PHP ${(h.amount_minor / 100).toFixed(2)}   ${h.branch}`)
  console.log(`  created        : ${String(h.created_at).slice(0, 19)}`)
  console.log(`  booking_id     : ${show(h.booking_id)}`)
  console.log(`  customer_id    : ${show(h.customer_id)}`)
  console.log(`  transaction_id : ${show(h.transaction_id)}`)
  console.log(`  currency       : ${show(h.currency)}`)

  const { data: b } = await db
    .from('bookings')
    .select('id, status, branch, customer_id, customer_name, customer_phone, vehicle_plate, service_id')
    .eq('id', h.booking_id)
    .maybeSingle()
  if (!b) { console.log('  booking        : *** DOES NOT EXIST ***'); continue }
  console.log(`  booking status : ${b.status}`)
  console.log(`  booking cust id: ${show(b.customer_id)}`)
  console.log(`  booking name   : ${show(b.customer_name)}`)
  console.log(`  booking phone  : ${show(b.customer_phone)}`)
  console.log(`  plate          : ${show(b.vehicle_plate)}`)

  if (b.customer_id) {
    const { data: c, error } = await db.from('customers').select('id, name, email').eq('id', b.customer_id).maybeSingle()
    console.log(`  customer row   : ${c ? `${c.name} <${c.email}>` : `NONE (${error ? error.message : 'no match'})`}`)
  } else {
    console.log('  customer row   : booking has no customer_id — name/phone columns carry the customer instead')
  }
}

console.log('\n(read-only probe — no writes issued)')