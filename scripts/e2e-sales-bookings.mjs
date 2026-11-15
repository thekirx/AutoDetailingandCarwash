/**
 * Live sales path: login → gates → create/edit details → status via booking-status API → waiting denied.
 * node scripts/e2e-sales-bookings.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { Writable } from 'node:stream'
import {
  ROLES,
  allowRoute,
  redirectForRole,
  canCheckInFormBooking,
} from '../src/auth/permissions.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { handleBookingStatusRequest } from '../server/bookingStatus.mjs'
import { demoPassword } from '../src/lib/demoAccounts.js'

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

function mockRes() {
  let statusCode = 200
  let payload = null
  const res = new Writable({
    write(_chunk, _enc, cb) {
      cb()
    },
  })
  res.setHeader = () => {}
  res.getHeader = () => undefined
  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (v) => {
      statusCode = v
    },
  })
  res.end = (body) => {
    if (body) {
      try {
        payload = JSON.parse(String(body))
      } catch {
        payload = body
      }
    }
  }
  return {
    res,
    get statusCode() {
      return statusCode
    },
    get body() {
      return payload
    },
  }
}

async function callBookingStatus(token, body) {
  const req = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
  }
  const out = mockRes()
  await handleBookingStatusRequest(req, out.res)
  return out
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anon && service, 'missing supabase env')

const results = []
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: login, error: loginErr } = await client.auth.signInWithPassword({
  email: 'sales@hakumautocare.com',
  password: demoPassword('VITE_DEMO_PASSWORD_SALES'),
})
assert(!loginErr && login.session, loginErr?.message || 'sales login failed')
const token = login.session.access_token
results.push('auth.login: ok')

const { data: staff, error: staffErr } = await client
  .from('staff_profiles')
  .select('id, role, branch_slug, is_active')
  .eq('id', login.user.id)
  .eq('is_active', true)
  .maybeSingle()
assert(!staffErr && staff?.role === 'sales', staffErr?.message || `role=${staff?.role}`)
assert(staff.branch_slug === 'bacoor', `branch=${staff.branch_slug}`)
assert(redirectForRole(staff.role) === '/operations/bookings', 'home')
assert(allowRoute({ role: ROLES.SALES, branch_slug: staff.branch_slug }, 'bookings'))
assert(allowRoute({ role: ROLES.SALES }, 'queue'), 'sales views the queue')
assert(!allowRoute({ role: ROLES.SALES }, 'queue-new'))
assert(!allowRoute({ role: ROLES.SALES }, 'pos'))
assert(allowRoute({ role: ROLES.SALES }, 'crm'), 'sales views crm')
assert(!canCheckInFormBooking({ role: ROLES.SALES }), 'sales may not check in form bookings')
results.push('rbac.home+gates: ok')

const { data: branches, error: brErr } = await client.from('branches').select('slug, name').eq('is_active', true)
assert(!brErr && branches?.length, brErr?.message || 'no branches')
results.push(`branches.read: ${branches.length}`)

const { data: services, error: svcErr } = await client
  .from('services')
  .select('id, name, slug, pay_category')
  .eq('is_active', true)
  .eq('is_archived', false)
  .eq('pay_category', 'detailing')
  .limit(5)
assert(!svcErr && services?.length, svcErr?.message || 'no services')
results.push(`services.read: ${services.length}`)

const { data: listed, error: listErr } = await client
  .from('bookings')
  .select('id, status, branch')
  .eq('branch', 'bacoor')
  .in('status', ['pending', 'confirmed'])
  .eq('is_archived', false)
  .limit(10)
assert(!listErr, listErr?.message)
results.push(`bookings.list: ${listed?.length ?? 0}`)

const payload = {
  customer_name: 'E2E Sales Route Probe',
  customer_phone: '09170008888',
  branch: 'bacoor',
  status: 'pending',
  service_id: services[0].id,
  vehicle_make: 'Honda',
  vehicle_model: 'City',
  vehicle_plate: 'SLS-E2E',
  scheduled_start: new Date(Date.now() + 2 * 86400000).toISOString(),
  is_archived: false,
}
// 19 Oct RBAC lock: Customer Rep (sales) is read-only on bookings and cannot insert/update.
const { error: createErr } = await client.from('bookings').insert(payload).select('id, status').single()
assert(createErr, 'sales direct booking insert must be refused by RLS')
results.push('bookings.insert_blocked: ok')

// Seed a fixture detailing booking with service role so we can prove cross-branch read + 403 mutations.
const { data: seeded, error: seedErr } = await admin.from('bookings').insert(payload).select('id, status').single()
assert(!seedErr && seeded?.id, seedErr?.message || 'seed failed')
try {
  const { data: readBack, error: readErr } = await client.from('bookings').select('id, branch, status').eq('id', seeded.id).maybeSingle()
  assert(!readErr && readBack?.id === seeded.id, readErr?.message || 'sales must be able to read detailing booking')
  results.push(`bookings.read_cross_branch: ${readBack.id}`)

  const { data: updRows, error: directUpdateErr } = await client
    .from('bookings')
    .update({ notes: 'sales edit attempt' })
    .eq('id', seeded.id)
    .select('id')
  assert(directUpdateErr || (updRows?.length ?? 0) === 0, 'sales direct details update must modify 0 rows under RLS')
  results.push('bookings.update_details_blocked: ok')

  const { data: confRows, error: directConfirmErr } = await client
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', seeded.id)
    .select('id')
  assert(directConfirmErr || (confRows?.length ?? 0) === 0, 'direct confirm must modify 0 rows under RLS')
  results.push('bookings.direct_status_blocked: ok')

  assert(
    !canStaffUpdateBookingStatus(
      { role: 'sales', branch_slug: 'bacoor' },
      { branch: 'bacoor', status: 'pending', services: services[0] },
      { nextStatus: 'confirmed' },
    ),
    'sales cannot move booking status',
  )
  const confirm = await callBookingStatus(token, { booking_id: seeded.id, status: 'confirmed' })
  assert(confirm.statusCode === 403, `confirm API want 403 got ${confirm.statusCode}`)
  results.push('api.confirm_denied: ok')

  assert(
    !canStaffUpdateBookingStatus(
      { role: 'sales', branch_slug: 'bacoor' },
      { branch: 'bacoor', status: 'confirmed', services: services[0] },
      { nextStatus: 'waiting' },
    ),
  )
  const waiting = await callBookingStatus(token, { booking_id: seeded.id, status: 'waiting' })
  assert(waiting.statusCode === 403, `waiting API want 403 got ${waiting.statusCode}`)
  results.push('api.waiting_denied: ok')

  assert(
    !canStaffUpdateBookingStatus(
      { role: 'sales', branch_slug: 'bacoor' },
      { branch: 'bacoor', status: 'waiting', services: services[0] },
      { nextStatus: 'for_payment' },
    ),
    'sales must not send to payment',
  )
  const pay = await callBookingStatus(token, { booking_id: seeded.id, status: 'for_payment' })
  assert(pay.statusCode === 403, `for_payment API want 403 got ${pay.statusCode}`)
  results.push('api.for_payment_denied: ok')

  const cancel = await callBookingStatus(token, {
    booking_id: seeded.id,
    status: 'cancelled',
    cancellation_reason: 'E2E sales cancel probe',
  })
  assert(cancel.statusCode === 403, `cancel API want 403 got ${cancel.statusCode}`)
  results.push('api.cancel_denied: ok')
} finally {
  await admin.from('bookings').delete().eq('id', seeded.id)
}
await client.auth.signOut()
results.push('cleanup: ok')

for (const line of results) console.log('✔', line)
console.log('e2e-sales-bookings: ok')
