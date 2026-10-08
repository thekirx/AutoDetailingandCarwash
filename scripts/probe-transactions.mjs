/**
 * READ-ONLY probe: is `transactions` a live ledger, and does it agree with
 * `pos_handoffs`?
 *
 * This exists because `docs/qa/BUGS.md` recorded `transactions` as a DEAD
 * ledger with zero references. That was wrong. The reference search covered
 * src/, server/ and api/ only, and missed the database functions — which is
 * where the write path actually lives:
 *
 *   supabase/migrations/20260819081507_complete_pos_sale_settle_txn.sql:155
 *     update public.transactions t set status = 'completed' ...
 *
 * So the table is live, and the question flips: if POS settles it, does every
 * settled handoff actually have a settled transaction? A handoff that reads
 * `completed` while its transaction still reads `pending_payment` is money
 * recorded twice with the two records disagreeing.
 *
 *   node scripts/probe-transactions.mjs
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

async function fetchAll(table, columns = '*', { page = 500, filters } = {}) {
  const rows = []
  for (let from = 0; ; from += page) {
    let q = db.from(table).select(columns).range(from, from + page - 1)
    if (filters) q = filters(q)
    const { data, error } = await q
    if (error) { console.error(`ERROR reading ${table}: ${error.message}`); return null }
    rows.push(...(data || []))
    if (!data || data.length < page) break
  }
  return rows
}

const peso = (m) => `PHP ${(Number(m || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// 1. Shape of the table.
const probe = await db.from('transactions').select('*').limit(1)
if (probe.error) { console.error('transactions unreadable:', probe.error.message); process.exit(1) }
const columns = Object.keys((probe.data && probe.data[0]) || {})
console.log(`transactions columns: ${columns.join(', ')}\n`)

const txns = await fetchAll('transactions')
const handoffs = await fetchAll('pos_handoffs')
const sales = await fetchAll('sales', 'id, pos_handoff_id, status, total_minor, payment_method')

console.log(`transactions: ${txns.length}   pos_handoffs: ${handoffs.length}   sales: ${sales.length}\n`)

const byStatus = {}
for (const t of txns) byStatus[t.status] = (byStatus[t.status] || 0) + 1
console.log('transaction status distribution:', JSON.stringify(byStatus))

const txWithHandoff = txns.filter((t) => t.pos_handoff_id)
const txNoHandoff = txns.filter((t) => !t.pos_handoff_id)
console.log(`transactions linked to a handoff: ${txWithHandoff.length}`)
console.log(`transactions with NO handoff link : ${txNoHandoff.length}\n`)

// 2. The reconciliation question: handoff completed, transaction still pending?
const handoffById = new Map(handoffs.map((h) => [h.id, h]))
const saleByHandoff = new Map()
for (const s of sales) if (s.pos_handoff_id) saleByHandoff.set(s.pos_handoff_id, s)

const mismatches = []
for (const t of txWithHandoff) {
  const h = handoffById.get(t.pos_handoff_id)
  if (!h) { mismatches.push({ kind: 'txn_points_at_missing_handoff', id: t.id, status: t.status }); continue }
  const hDone = h.status === 'completed'
  const tDone = t.status === 'completed'
  if (hDone && !tDone) {
    mismatches.push({ kind: 'handoff_completed_but_txn_not', txn: t.id, txnStatus: t.status, handoff: h.id, amountPHP: peso(t.amount_minor ?? t.total_minor) })
  }
  if (!hDone && tDone) {
    mismatches.push({ kind: 'txn_completed_but_handoff_not', txn: t.id, handoff: h.id, handoffStatus: h.status })
  }
}

console.log(`\n--- handoff <-> transaction reconciliation ---`)
if (!mismatches.length) {
  console.log('OK: every transaction agrees with its handoff status')
} else {
  console.log(`${mismatches.length} MISMATCH(ES):`)
  for (const m of mismatches) console.log('  ', JSON.stringify(m))
}

// 3. Stuck transactions: what are they attached to?
console.log(`\n--- non-completed transactions ---`)
const stuck = txns.filter((t) => t.status !== 'completed')
for (const t of stuck) {
  const h = t.pos_handoff_id ? handoffById.get(t.pos_handoff_id) : null
  const s = t.pos_handoff_id ? saleByHandoff.get(t.pos_handoff_id) : null
  console.log(`  ${t.id.slice(0, 8)} status=${String(t.status).padEnd(16)} ${peso(t.amount_minor ?? t.total_minor).padStart(14)}` +
    `  handoff=${h ? h.status : 'none'}` +
    `  sale=${s ? s.status : 'none'}` +
    `  created=${String(t.created_at || '').slice(0, 10)}`)
}

// 4. Do any transactions reference a sale (double-count risk)?
const linkedSales = txns.filter((t) => t.sale_id)
const linkedBookings = txns.filter((t) => t.booking_id)
console.log(`\ntransactions with sale_id    : ${linkedSales.length}`)
console.log(`transactions with booking_id : ${linkedBookings.length}`)
console.log(`sales with a transaction_id  : ${sales.filter((s) => s.transaction_id).length}`)

console.log('\n(read-only probe — no writes issued)')