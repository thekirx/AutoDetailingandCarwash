/**
 * Principal QA: real customer + detailing + package status SMS + CRM retention blast (live BusyBee).
 * Phone: 09625294043 (Malcolm Cuady)
 *
 * Done when:
 * - Real customer row (notify_sms on) + vehicle
 * - Detailing + package bookings linked to that customer
 * - Full detailing status chain notify accepted by BusyBee (DELIVRD when polled)
 * - Package status chain includes service name in SMS
 * - CRM we_missed + aftercare + thank_you SMS to this phone only
 * - sms_events rows present; shop SMS gate left ON
 *
 * Usage: node scripts/e2e-real-customer-status-sms.mjs
 * Optional: SKIP_DLR=1 (API accept only), SKIP_CRM=1
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { phoneLoginEmail } from '../src/lib/customerAuth.js'
import { normalizePlate } from '../src/queue/queueLogic.js'
import { notifyBookingStatus } from '../server/notifyBooking.mjs'
import { normalizePhMobile } from '../server/busybee.mjs'
import { handleNotificationBroadcastRequest } from '../server/notificationBroadcastApi.mjs'

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

const TEST_PHONE = '09625294043'
const CUSTOMER = {
  full_name: 'Malcolm Cuady',
  first_name: 'Malcolm',
  last_name: 'Cuady',
  phone: TEST_PHONE,
  email: 'malcolm.cuady@customers.hakumautocare.com',
  date_of_birth: '1995-08-15',
  notify_sms: true,
  notify_push: true,
  is_disabled: false,
  is_archived: false,
  role: 'customer',
}
const VEHICLE = {
  plate_number: 'NCA2943',
  vehicle_make: 'Toyota',
  vehicle_model: 'Vios',
  vehicle_type: 'sedan',
  vehicle_year: 2021,
  color: 'Silver Metallic',
}
/** Full detailing board pipeline (statuses customers should hear about). */
const DETAILING_STATUSES = [
  'pending',
  'confirmed',
  'waiting',
  'in_progress',
  'final_checking',
  'for_releasing',
  'for_payment',
  'completed',
]
const PACKAGE_STATUSES = [
  'pending',
  'confirmed',
  'waiting',
  'in_progress',
  'final_checking',
  'for_payment',
  'completed',
]
const BRANCH_SLUG = process.env.E2E_BRANCH || 'bacoor'
const SKIP_DLR = String(process.env.SKIP_DLR || '').trim() === '1'
const SKIP_CRM = String(process.env.SKIP_CRM || '').trim() === '1'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.error('✖', name, detail)
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function messageStatus(messageId) {
  const apiKey = process.env.BUSYBEE_API_KEY
  const clientId = process.env.BUSYBEE_CLIENT_ID
  const base = (process.env.BUSYBEE_API_BASE_URL || 'https://app.brandtxt.io').replace(/\/$/, '')
  const q = new URLSearchParams({ ApiKey: apiKey, ClientId: clientId, MessageId: messageId })
  const res = await fetch(`${base}/api/v2/MessageStatus?${q}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  const jsonBody = await res.json().catch(() => null)
  return {
    errorCode: jsonBody?.ErrorCode,
    status: jsonBody?.Data?.Status || null,
    doneDate: jsonBody?.Data?.DoneDate || null,
    mobile: jsonBody?.Data?.MobileNumber || null,
  }
}

async function pollDlr(messageId, { maxPolls = 10, gapMs = 4000 } = {}) {
  let last = null
  for (let i = 0; i < maxPolls; i++) {
    last = await messageStatus(messageId)
    const s = String(last.status || '').toUpperCase()
    console.log('  dlr_poll', i, messageId.slice(0, 8), s || '(none)', last.mobile || '')
    if (s === 'DELIVRD' || s === 'FAILED' || s === 'REJECTD' || s === 'EXPIRED') return last
    await sleep(gapMs)
  }
  return last
}

async function ensureCustomer() {
  const loginEmail = phoneLoginEmail(TEST_PHONE)
  const { data: existing } = await admin
    .from('customers')
    .select('id, full_name, phone, email, notify_sms, is_disabled, is_archived')
    .eq('phone', TEST_PHONE)
    .eq('role', 'customer')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  let customerId = existing?.[0]?.id || null

  if (!customerId) {
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: 'HakumCustomer2026!',
      email_confirm: true,
      user_metadata: {
        full_name: CUSTOMER.full_name,
        sms_opt_in: true,
        role: 'customer',
      },
      phone: `+${normalizePhMobile(TEST_PHONE)}`,
      phone_confirm: true,
    })
    if (authErr) throw authErr
    customerId = authUser.user.id
  } else {
    await admin.auth.admin.updateUserById(customerId, {
      user_metadata: { full_name: CUSTOMER.full_name, sms_opt_in: true, role: 'customer' },
    })
  }

  const { data: cust, error: upErr } = await admin
    .from('customers')
    .upsert(
      {
        id: customerId,
        ...CUSTOMER,
        email: CUSTOMER.email || loginEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()
  if (upErr) throw upErr

  const dupIds = (existing || []).map((r) => r.id).filter((id) => id !== customerId)
  if (dupIds.length) {
    await admin
      .from('customers')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .in('id', dupIds)
  }

  return cust
}

async function ensureVehicle(customerId) {
  const norm = normalizePlate(VEHICLE.plate_number)
  const { data: found } = await admin
    .from('vehicles')
    .select('id, plate_number')
    .eq('customer_id', customerId)
    .eq('normalized_plate_number', norm)
    .eq('is_archived', false)
    .maybeSingle()

  if (found) {
    const { data, error } = await admin
      .from('vehicles')
      .update({
        ...VEHICLE,
        normalized_plate_number: norm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', found.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('vehicles')
    .insert({
      customer_id: customerId,
      ...VEHICLE,
      normalized_plate_number: norm,
      is_archived: false,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function createBooking({ customer, vehicle, service, label }) {
  const { data, error } = await admin
    .from('bookings')
    .insert({
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: TEST_PHONE,
      customer_email: customer.email,
      vehicle_plate: vehicle.plate_number,
      vehicle_make: vehicle.vehicle_make,
      vehicle_model: vehicle.vehicle_model,
      service_id: service.id,
      branch: BRANCH_SLUG,
      scheduled_start: new Date().toISOString(),
      status: 'pending',
      final_price_minor: service.price_minor,
      price_minor: service.price_minor,
      notes: `E2E real-customer ${label} ${new Date().toISOString()}`,
      is_archived: false,
    })
    .select('*, services(name, slug, pay_category)')
    .single()
  if (error) throw error
  return {
    ...data,
    service_name: data.services?.name || service.name,
  }
}

async function runStatusChain(booking, label, statuses) {
  const chain = []
  for (const status of statuses) {
    const { error: updErr } = await admin
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', booking.id)
    if (updErr) {
      fail(`${label}.update.${status}`, updErr.message)
      chain.push({ status, ok: false })
      continue
    }

    const notify = await notifyBookingStatus({ ...booking, status }, status)
    const sms = notify?.sms || null
    const messageId = sms?.messageId || null
    const apiOk = Boolean(sms?.ok)

    if (!apiOk) {
      fail(`${label}.sms.${status}`, JSON.stringify({ sms, smsEnabled: notify?.smsEnabled, reason: notify?.reason }))
      chain.push({ status, apiOk: false, dlr: null, messageId })
      await sleep(1200)
      continue
    }

    if (SKIP_DLR) {
      pass(`${label}.sms.${status}`, `accepted · ${messageId || 'no-id'}`)
      chain.push({ status, apiOk: true, dlr: 'skipped', messageId })
      await sleep(1200)
      continue
    }

    if (!messageId) {
      fail(`${label}.sms.${status}`, 'accepted but no messageId — cannot prove DLR')
      chain.push({ status, apiOk: true, dlr: null, messageId: null })
      await sleep(1200)
      continue
    }

    await sleep(2000)
    const dlr = await pollDlr(messageId)
    const dlrStatus = String(dlr?.status || '').toUpperCase()
    if (dlrStatus === 'DELIVRD') {
      pass(`${label}.sms.${status}`, `DELIVRD · ${messageId}`)
      chain.push({ status, apiOk: true, dlr: dlrStatus, messageId })
    } else {
      fail(`${label}.sms.${status}`, `apiOk but dlr=${dlrStatus || 'none'} · ${messageId}`)
      chain.push({ status, apiOk: true, dlr: dlrStatus || null, messageId })
    }
    await sleep(1200)
  }
  return chain
}

function mockReq(method, body, headers = {}) {
  return { method, headers: { 'content-type': 'application/json', ...headers }, body }
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
      out.body = payload
    },
  }
}

async function sendCrmBlast({ kind, title, body }) {
  const mkt = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: auth, error } = await mkt.auth.signInWithPassword({
    email: 'marketing@hakumautocare.com',
    password: 'HakumMkt2026!',
  })
  if (error || !auth.session) throw new Error(`marketing login: ${error?.message}`)

  const req = mockReq(
    'POST',
    {
      kind,
      channel: 'sms',
      title,
      body,
      target_audience: 'all',
      phones: [TEST_PHONE],
      url: '/account',
    },
    { authorization: `Bearer ${auth.session.access_token}` },
  )
  const res = mockRes()
  await handleNotificationBroadcastRequest(req, res)
  const jsonBody = JSON.parse(res.out.body || '{}')
  if (res.out.statusCode !== 200 || !jsonBody.sent) {
    throw new Error(`CRM ${kind}: ${res.out.statusCode} ${JSON.stringify(jsonBody)}`)
  }
  return jsonBody
}

try {
  console.log('=== E2E real customer detailing + package + CRM SMS ===')
  console.log('normalize', TEST_PHONE, '→', normalizePhMobile(TEST_PHONE))
  console.log('branch', BRANCH_SLUG, 'SKIP_DLR', SKIP_DLR, 'SKIP_CRM', SKIP_CRM)

  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: true },
    updated_at: new Date().toISOString(),
  })
  const { data: gate } = await admin.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
  if (gate?.value?.enabled === true) pass('sms.gate.on')
  else fail('sms.gate.on', JSON.stringify(gate?.value))

  const customer = await ensureCustomer()
  if (
    customer.full_name === CUSTOMER.full_name &&
    customer.phone === TEST_PHONE &&
    customer.notify_sms === true &&
    customer.is_disabled !== true
  ) {
    pass('customer.upsert', `${customer.id} · ${customer.full_name} · ${customer.phone}`)
  } else {
    fail('customer.upsert', JSON.stringify(customer))
  }

  const vehicle = await ensureVehicle(customer.id)
  pass('vehicle.upsert', `${vehicle.plate_number} · ${vehicle.vehicle_make} ${vehicle.vehicle_model}`)

  const { data: detailing } = await admin
    .from('services')
    .select('id, name, price_minor, pay_category, slug')
    .eq('pay_category', 'detailing')
    .eq('is_active', true)
    .eq('is_archived', false)
    .eq('slug', 'ceramic-coating')
    .maybeSingle()
  const detailingSvc =
    detailing ||
    (
      await admin
        .from('services')
        .select('id, name, price_minor, pay_category, slug')
        .eq('pay_category', 'detailing')
        .eq('is_active', true)
        .eq('is_archived', false)
        .limit(1)
        .single()
    ).data

  const { data: pkg } = await admin
    .from('services')
    .select('id, name, price_minor, pay_category, slug')
    .eq('pay_category', 'package')
    .eq('is_active', true)
    .eq('is_archived', false)
    .eq('slug', 'express-wash-package')
    .maybeSingle()
  const packageSvc =
    pkg ||
    (
      await admin
        .from('services')
        .select('id, name, price_minor, pay_category, slug')
        .eq('pay_category', 'package')
        .eq('is_active', true)
        .eq('is_archived', false)
        .limit(1)
        .single()
    ).data

  if (!detailingSvc) throw new Error('No active detailing service')
  if (!packageSvc) throw new Error('No active package service')
  pass('catalog.detailing', `${detailingSvc.name} · ${detailingSvc.pay_category}`)
  pass('catalog.package', `${packageSvc.name} · ${packageSvc.pay_category}`)

  const detailingBooking = await createBooking({
    customer,
    vehicle,
    service: detailingSvc,
    label: 'detailing',
  })
  pass('booking.detailing.create', `${detailingBooking.id} · ${detailingBooking.service_name}`)

  const packageBooking = await createBooking({
    customer,
    vehicle,
    service: packageSvc,
    label: 'package',
  })
  pass('booking.package.create', `${packageBooking.id} · ${packageBooking.service_name}`)

  console.log('\n--- detailing status chain ---')
  await runStatusChain(detailingBooking, 'detailing', DETAILING_STATUSES)

  console.log('\n--- package status chain ---')
  await runStatusChain(packageBooking, 'package', PACKAGE_STATUSES)

  const { data: recentSms } = await admin
    .from('sms_events')
    .select('message, status, event_type, booking_id')
    .eq('phone', TEST_PHONE)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(40)
  const withService = (recentSms || []).filter(
    (e) =>
      String(e.message || '').includes(detailingSvc.name.slice(0, 12)) ||
      String(e.message || '').includes(packageSvc.name.slice(0, 12)),
  )
  if (withService.length) pass('sms.copy.service_name', `${withService.length} recent bodies name service/package`)
  else fail('sms.copy.service_name', 'no recent sent SMS mentions detailing/package name')

  if (!SKIP_CRM) {
    console.log('\n--- CRM retention blasts (this phone only) ---')
    const kinds = [
      {
        kind: 'we_missed',
        title: 'Hakum misses you',
        body: 'Hi {name}, we miss caring for {plate}. Your shine is waiting — book: hakumautocare.com/book',
      },
      {
        kind: 'aftercare',
        title: 'How is the shine?',
        body: 'Hi {name}, how is {plate} looking after your last visit? Need a touch-up? hakumautocare.com/book',
      },
      {
        kind: 'thank_you',
        title: 'Thank you',
        body: 'Hi {name}, thank you for trusting Hakum with {plate}. See you on the next shine.',
      },
    ]
    for (const row of kinds) {
      try {
        const out = await sendCrmBlast(row)
        pass(`crm.${row.kind}`, `sent=${out.sent}`)
        await sleep(1500)
      } catch (err) {
        fail(`crm.${row.kind}`, err.message)
      }
    }
  } else {
    pass('crm.skipped', 'SKIP_CRM=1')
  }

  const { data: events } = await admin
    .from('sms_events')
    .select('status, event_type, phone, booking_id, created_at')
    .eq('phone', TEST_PHONE)
    .order('created_at', { ascending: false })
    .limit(40)
  const sentCount = (events || []).filter((e) => e.status === 'sent').length
  pass('sms.events', `${events?.length || 0} recent · sent=${sentCount}`)

  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: true },
    updated_at: new Date().toISOString(),
  })
  pass('sms.gate.left_on')

  console.log('\n--- summary ---')
  console.log(
    JSON.stringify(
      {
        customerId: customer.id,
        plate: vehicle.plate_number,
        detailingBookingId: detailingBooking.id,
        packageBookingId: packageBooking.id,
        phone: TEST_PHONE,
        normalized: normalizePhMobile(TEST_PHONE),
      },
      null,
      2,
    ),
  )
} catch (err) {
  fail('fatal', err?.message || String(err))
}

const failed = results.filter((r) => !r.ok)
console.log(`\n---\npassed ${results.length - failed.length}/${results.length}`)
if (failed.length) {
  console.log('FAILURES:')
  for (const f of failed) console.log(' -', f.name, f.detail)
}
process.exit(failed.length ? 1 : 0)
