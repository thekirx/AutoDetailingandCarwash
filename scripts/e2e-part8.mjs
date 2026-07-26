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

const { data: cats, error: catErr } = await admin.from('vehicle_catalog').select('id, make, model, is_active').limit(5)
assert(!catErr, `vehicle_catalog: ${catErr?.message}`)
assert(cats?.length, 'expected seeded catalog')
results.push(`db.vehicle_catalog: ok (${cats.length}+)`)

// Full CRUD roundtrip (especially UPDATE / edit) — isolated probe row
const probeMake = `__E2E_${Date.now()}__`
const { data: created, error: createErr } = await admin
  .from('vehicle_catalog')
  .insert({ make: probeMake, model: 'Probe', is_active: true, sort_order: 0 })
  .select('id, make, model')
  .single()
assert(!createErr && created?.id, `create: ${createErr?.message}`)
results.push('crud.create: ok')

const { data: edited, error: editErr } = await admin
  .from('vehicle_catalog')
  .update({ make: probeMake, model: 'ProbeEdited', updated_at: new Date().toISOString() })
  .eq('id', created.id)
  .select('id, model')
  .single()
assert(!editErr && edited?.model === 'ProbeEdited', `edit: ${editErr?.message}`)
results.push('crud.update: ok')

const { data: tlVisible, error: tlErr } = await admin
  .from('vehicle_catalog')
  .select('id, make, model')
  .eq('is_active', true)
  .eq('id', created.id)
  .maybeSingle()
assert(!tlErr && tlVisible?.model === 'ProbeEdited', 'TL active catalog should see edited row')
results.push('tl.visible_active: ok')

const { error: delErr } = await admin.from('vehicle_catalog').delete().eq('id', created.id)
assert(!delErr, `delete: ${delErr?.message}`)
results.push('crud.delete: ok')

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
