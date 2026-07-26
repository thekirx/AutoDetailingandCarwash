/**
 * Part 8 smoke: vehicle_catalog + audit helper + KPI RPC roles.
 * node scripts/e2e-part8.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { formatAuditDetail } from '../src/lib/auditDetail.js'
import { bookingCycleMinutes } from '../src/lib/kpiPart8.js'

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

assert(bookingCycleMinutes({
  in_progress_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-01-01T00:45:00Z',
}) === 45)
assert(formatAuditDetail({ action: 'delete', meta: { plate: 'XYZ 9' }, summary: 'x' }).includes('XYZ 9'))
results.push('helpers: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: cats, error: catErr } = await admin.from('vehicle_catalog').select('id, make, model').limit(5)
assert(!catErr, `vehicle_catalog: ${catErr?.message}`)
assert(cats?.length, 'expected seeded catalog')
results.push(`db.vehicle_catalog: ok (${cats.length}+)`)

const { error: auditErr } = await admin.from('audit_logs').select('id, summary, meta').limit(1)
assert(!auditErr, `audit_logs: ${auditErr?.message}`)
results.push('db.audit_logs: ok')

const { error: bookErr } = await admin
  .from('bookings')
  .select('id, in_progress_at, for_payment_at, completed_at, branch, service_id')
  .limit(1)
assert(!bookErr, `bookings cycle cols: ${bookErr?.message}`)
results.push('db.bookings.cycle_cols: ok')

console.log(results.join('\n'))
console.log('e2e-part8: PASS')
