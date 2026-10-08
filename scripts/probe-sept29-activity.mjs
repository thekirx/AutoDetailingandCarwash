/**
 * READ-ONLY: was 2026-09-29 a manual QA day rather than real trading?
 *
 * The two stranded hand-offs (PHP 5,397.50) carry customers named "Walk-in ·
 * ABC124" (phone 0912345678) and "test run" (phone 09999999999, first_name
 * "test"), both auto-created minutes before their hand-off. That pattern says
 * test data, but a two-row sample is not proof. This looks for the cluster a
 * testing session leaves: several placeholder-phone customers, same-day
 * hand-offs, and whether these two ever transacted normally.
 *
 *   node scripts/probe-sept29-activity.mjs
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
    if (error) { console.error(`ERROR ${table}: ${error.message}`); return null }
    rows.push(...(data || []))
    if (!data || data.length < page) break
  }
  return rows
}

const handoffs = await fetchAll('pos_handoffs', 'id, booking_id, customer_id, amount_minor, status, created_at, branch')
const sales = await fetchAll('sales', 'id, customer_id, booking_id, pos_handoff_id, status, total_minor, recorded_by, occurred_at')
const customers = await fetchAll('customers', 'id, full_name, email, phone, created_at')

const byId = new Map(customers.map((c) => [c.id, c]))

// Obvious placeholder markers.
const PLACEHOLDER_PHONE = /^(0?9{9,11}|09\d{9})$/
const isPlaceholder = (c) => {
  if (!c) return false
  const phone = String(c.phone || '')
  if (/^0999{6,}/.test(phone) || /^09\d{0}0{6,}/.test(phone)) return true
  if (PLACEHOLDER_PHONE.test(phone) && /^09/.test(phone) && /^(0912|0999)/.test(phone)) return true
  if (/test|demo|sample/i.test(String(c.full_name || ''))) return true
  if (/^Walk-in\s*·\s*[A-Z]{3}\d{1,4}$/i.test(String(c.full_name || ''))) return true
  return false
}

console.log('=== stranded hand-offs ===')
const stranded = handoffs.filter((h) => h.status !== 'completed')
for (const h of stranded) {
  const c = byId.get(h.customer_id)
  console.log(`  ${h.id.slice(0, 8)} PHP ${(h.amount_minor / 100).toFixed(2)} ${String(h.created_at).slice(0, 16)}`)
  console.log(`      customer: ${c ? `${c.full_name} | ${c.phone} | ${c.email}` : 'none'}`)
  console.log(`      placeholder-looking: ${isPlaceholder(c)}`)
  const theirSales = sales.filter((s) => s.customer_id === h.customer_id)
  console.log(`      sales ever for this customer: ${theirSales.length}`)
  for (const s of theirSales) console.log(`         ${String(s.occurred_at).slice(0, 16)} PHP ${(s.total_minor / 100).toFixed(2)} ${s.status} handoff=${s.pos_handoff_id ? 'yes' : 'no'}`)
}

console.log('\n=== hand-offs by day (status mix) ===')
const byDay = {}
for (const h of handoffs) {
  const d = String(h.created_at).slice(0, 10)
  byDay[d] = byDay[d] || { total: 0, pending: 0, placeholderCustomer: 0 }
  byDay[d].total += 1
  if (h.status !== 'completed') byDay[d].pending += 1
  if (isPlaceholder(byId.get(h.customer_id))) byDay[d].placeholderCustomer += 1
}
for (const d of Object.keys(byDay).sort()) {
  console.log(`  ${d}  total=${byDay[d].total}  notCompleted=${byDay[d].pending}  placeholderCustomer=${byDay[d].placeholderCustomer}`)
}

console.log('\n=== how many customers overall look like placeholders ===')
console.log(`  ${customers.filter(isPlaceholder).length} of ${customers.length}`)

console.log('\n(read-only probe — no writes issued)')