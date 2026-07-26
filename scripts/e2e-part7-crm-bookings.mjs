/**
 * Part 7: CRM insights helpers + bookings/sales columns smoke.
 * node scripts/e2e-part7-crm-bookings.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { aggregateSalesByHour, peakSalesHour } from '../src/lib/crmInsights.js'
import { getDashboardDateRange } from '../src/queue/queueLogic.js'

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
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing supabase env')
const results = []

const week = getDashboardDateRange('week')
assert(week.start && week.end)
results.push('helpers.date_presets: ok')

const peak = peakSalesHour(aggregateSalesByHour([{ occurred_at: new Date().toISOString(), total_minor: 100 }]))
assert(peak?.count === 1)
results.push('helpers.insights: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { error: salesErr } = await admin.from('sales').select('id, branch, total_minor, occurred_at, status').limit(1)
assert(!salesErr, `sales: ${salesErr?.message}`)
results.push('db.sales: ok')

const { error: lineErr } = await admin
  .from('sale_line_items')
  .select('sale_id, item_type, service_id, name, quantity, line_total_minor')
  .limit(1)
assert(!lineErr, `sale_line_items: ${lineErr?.message}`)
results.push('db.sale_line_items: ok')

const { error: bookErr } = await admin
  .from('bookings')
  .select('id, customer_name, branch, status, scheduled_start, is_archived')
  .eq('is_archived', false)
  .limit(1)
assert(!bookErr, `bookings: ${bookErr?.message}`)
results.push('db.bookings: ok')

const { error: custErr } = await admin.from('customers').select('id, full_name, phone').eq('role', 'customer').limit(1)
assert(!custErr, `customers: ${custErr?.message}`)
results.push('db.customers: ok')

console.log(results.join('\n'))
console.log('e2e-part7-crm-bookings: PASS')
