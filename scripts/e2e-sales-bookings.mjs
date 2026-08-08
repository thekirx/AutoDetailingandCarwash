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
  password: 'HakumSales2026!',
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
assert(!allowRoute({ role: ROLES.SALES }, 'queue'))
assert(!allowRoute({ role: ROLES.SALES }, 'pos'))
assert(!allowRoute({ role: ROLES.SALES }, 'crm'))
assert(!canCheckInFormBooking({ role: ROLES.SALES }))
results.push('rbac.home+gates: ok')

const { data: branches, error: brErr } = await client.from('branches').select('slug, name').eq('is_active', true)
assert(!brErr && branches?.length, brErr?.message || 'no branches')
results.push(`branches.read: ${branches.length}`)

const { data: services, error: svcErr } = await client
  .from('services')
  .select('id, name')
  .eq('is_active', true)
  .eq('is_archived', false)
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
const { data: created, error: createErr } = await client.from('bookings').insert(payload).select('id, status').single()
assert(!createErr && created?.id, createErr?.message || 'create failed')
results.push(`bookings.create: ${created.id}`)

const { error: updateErr } = await client
  .from('bookings')
  .update({ notes: 'sales edit ok', vehicle_make: 'Honda' })
  .eq('id', created.id)
assert(!updateErr, updateErr?.message)
results.push('bookings.update_details: ok')

// Direct client status change must fail (queue_events / can_manage_branch)
const { error: directConfirmErr } = await client.from('bookings').update({ status: 'confirmed' }).eq('id', created.id)
assert(directConfirmErr, 'direct confirm must fail without queue manager role')
results.push('bookings.direct_status_blocked: ok')

assert(
  canStaffUpdateBookingStatus(
    { role: 'sales', branch_slug: 'bacoor' },
    { branch: 'bacoor', status: 'pending' },
    { nextStatus: 'confirmed' },
  ),
)
const confirm = await callBookingStatus(token, { booking_id: created.id, status: 'confirmed' })
assert(confirm.statusCode === 200, `confirm API ${confirm.statusCode} ${JSON.stringify(confirm.body)}`)
assert(confirm.body?.booking?.status === 'confirmed', JSON.stringify(confirm.body))
results.push('api.confirm: ok')

assert(
  !canStaffUpdateBookingStatus(
    { role: 'sales', branch_slug: 'bacoor' },
    { branch: 'bacoor', status: 'confirmed' },
    { nextStatus: 'waiting' },
  ),
)
const waiting = await callBookingStatus(token, { booking_id: created.id, status: 'waiting' })
assert(waiting.statusCode === 403, `waiting API want 403 got ${waiting.statusCode}`)
results.push('api.waiting_denied: ok')

const cancel = await callBookingStatus(token, {
  booking_id: created.id,
  status: 'cancelled',
  cancellation_reason: 'E2E sales cancel probe',
})
assert(cancel.statusCode === 200, `cancel API ${cancel.statusCode} ${JSON.stringify(cancel.body)}`)
assert(cancel.body?.booking?.status === 'cancelled', JSON.stringify(cancel.body))
results.push('api.cancel: ok')

await admin.from('bookings').delete().eq('id', created.id)
await client.auth.signOut()
results.push('cleanup: ok')

for (const line of results) console.log('✔', line)
console.log('e2e-sales-bookings: ok')
