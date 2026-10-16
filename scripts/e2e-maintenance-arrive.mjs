/**
 * Live seam: due paint-maintenance schedule → POST arrive → waiting booking on board.
 * Disposable rows wiped in finally. SMS notify may fail (BusyBee) — booking creation is the gate.
 *   node scripts/e2e-maintenance-arrive.mjs
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { PAINT_MAINTENANCE_PROGRAM, PAINT_MAINTENANCE_SLUG } from '../src/lib/paintMaintenance.js'
import { handleMaintenanceSchedulesRequest } from '../server/maintenanceSchedulesApi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert.ok(url && anon && service, 'missing SUPABASE env')

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = Date.now().toString().slice(-6)
const PLATE = `ARR${stamp}`
const PHONE = `0919${stamp}0`.slice(0, 11)
const PASS = `QaArrive${stamp}!a`
const created = { customers: [], vehicles: [], schedules: [], bookings: [], authIds: [] }
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

function mockReq(method, body, token) {
  return {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
  }
}
function mockRes() {
  const out = { statusCode: 200, body: null }
  return {
    out,
    get statusCode() {
      return out.statusCode
    },
    set statusCode(v) {
      out.statusCode = v
    },
    setHeader() {},
    end(payload) {
      out.body = typeof payload === 'string' ? JSON.parse(payload || 'null') : payload
    },
  }
}

async function login(id) {
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`${id}: ${error.message}`)
  return data.session.access_token
}

try {
  const { data: paintSvc, error: svcErr } = await admin
    .from('services')
    .select('id, slug, price_minor')
    .eq('slug', PAINT_MAINTENANCE_SLUG)
    .maybeSingle()
  if (svcErr) throw svcErr
  check('paint-maintenance service in catalog', Boolean(paintSvc?.id), paintSvc?.slug || 'missing')

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: `c${PHONE}@customers.hakumautocare.com`,
    password: PASS,
    email_confirm: true,
    user_metadata: { role: 'customer', full_name: `Qa Arrive ${stamp}`, phone: PHONE },
  })
  if (authErr) throw authErr
  created.authIds.push(authUser.user.id)
  created.customers.push(authUser.user.id)
  await admin.from('customers').upsert({
    id: authUser.user.id,
    role: 'customer',
    full_name: `Qa Arrive ${stamp}`,
    first_name: 'Qa',
    last_name: 'Arrive',
    phone: PHONE,
    email: authUser.user.email,
    is_archived: false,
  })

  const { data: vehicle, error: vErr } = await admin
    .from('vehicles')
    .insert({
      customer_id: authUser.user.id,
      plate_number: PLATE,
      normalized_plate_number: PLATE,
      vehicle_make: 'Toyota',
      vehicle_model: 'Fortuner',
      vehicle_type: 'large',
      is_archived: false,
    })
    .select('id')
    .single()
  if (vErr) throw vErr
  created.vehicles.push(vehicle.id)

  const due = new Date()
  due.setDate(due.getDate() - 1)
  const coated = new Date()
  coated.setMonth(coated.getMonth() - 6)
  const { data: sched, error: sErr } = await admin
    .from('vehicle_maintenance_schedules')
    .insert({
      vehicle_id: vehicle.id,
      plate_number: PLATE,
      plate_normalized: PLATE,
      customer_id: authUser.user.id,
      customer_name: `Qa Arrive ${stamp}`,
      customer_phone: PHONE,
      status: 'scheduled',
      coated_at: coated.toISOString().slice(0, 10),
      next_due_at: due.toISOString().slice(0, 10),
      service_slug: PAINT_MAINTENANCE_SLUG,
      program_key: PAINT_MAINTENANCE_PROGRAM,
      branch_slug: 'bacoor',
      notes: 'QA maintenance arrive',
    })
    .select('id')
    .single()
  if (sErr) throw sErr
  created.schedules.push(sched.id)
  check('due schedule created', Boolean(sched.id), sched.id)

  const tlToken = await login('tl')
  const res = mockRes()
  await handleMaintenanceSchedulesRequest(
    mockReq('POST', { id: sched.id, action: 'arrive', branch: 'bacoor' }, tlToken),
    res,
  )
  check('arrive returns 200', res.out.statusCode === 200, JSON.stringify(res.out.body))
  check('booking created waiting', res.out.body?.booking?.status === 'waiting', JSON.stringify(res.out.body?.booking))
  if (res.out.body?.booking?.id) created.bookings.push(res.out.body.booking.id)

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, service_id, vehicle_plate, branch, customer_phone')
    .eq('id', res.out.body?.booking?.id)
    .maybeSingle()
  check('booking is paint-maintenance SKU', booking?.service_id === paintSvc?.id, booking?.service_id)
  check('plate and branch on booking', booking?.vehicle_plate === PLATE && booking?.branch === 'bacoor', JSON.stringify(booking))

  // Second arrive must 409 while open.
  const res2 = mockRes()
  await handleMaintenanceSchedulesRequest(
    mockReq('POST', { id: sched.id, action: 'arrive', branch: 'bacoor' }, tlToken),
    res2,
  )
  check('duplicate arrive refused 409', res2.out.statusCode === 409, JSON.stringify(res2.out.body))
} catch (err) {
  check('script ran to completion', false, err.message)
  console.error(err)
} finally {
  if (created.bookings.length) {
    await admin.from('queue_events').delete().in('booking_id', created.bookings)
    await admin.from('queue_assignments').delete().in('booking_id', created.bookings)
    await admin.from('bookings').delete().in('id', created.bookings)
  }
  if (created.schedules.length) await admin.from('vehicle_maintenance_schedules').delete().in('id', created.schedules)
  if (created.vehicles.length) await admin.from('vehicles').delete().in('id', created.vehicles)
  for (const id of created.customers) await admin.from('customers').delete().eq('id', id)
  for (const id of created.authIds) await admin.auth.admin.deleteUser(id)
  console.log('cleanup done')
}

const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
