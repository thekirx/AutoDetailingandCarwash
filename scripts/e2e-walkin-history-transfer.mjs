/**
 * Live seam: walk-in orphan booking → signupCustomer history flags → BA transfer + maintenance follow.
 * Creates disposable rows and deletes them in finally. No floor sale.
 *   node scripts/e2e-walkin-history-transfer.mjs
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { EXISTING_HISTORY_MESSAGE, historySignupFlags } from '../src/lib/vehicleTransfer.js'
import { claimWalkInHistory, signupCustomer } from '../server/customerSignup.mjs'
import { transferVehicle } from '../server/vehicleTransferApi.mjs'

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
assert.ok(url && anon && service, 'missing SUPABASE_URL / anon / SERVICE_ROLE_KEY')

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = Date.now().toString().slice(-7)
const PHONE = `0917${stamp}`.slice(0, 11)
const PHONE_SPACED = `${PHONE.slice(0, 4)} ${PHONE.slice(4, 7)} ${PHONE.slice(7)}`
const PLATE = `WHT${stamp.slice(-4)}`
const PASS = `QaHist${stamp}!a`
const created = { bookings: [], customers: [], vehicles: [], schedules: [], authIds: [] }

async function login(id) {
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`${id} login: ${error.message}`)
  return { token: data.session.access_token, id: data.user.id }
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

try {
  const { data: serviceRow, error: svcErr } = await admin
    .from('services')
    .select('id, price_minor')
    .eq('is_active', true)
    .eq('is_archived', false)
    .gt('price_minor', 0)
    .limit(1)
    .single()
  if (svcErr) throw svcErr

  // 1. Orphan walk-in with spaced phone (match filter + sameHandset).
  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .insert({
      customer_id: null,
      customer_name: 'Walk-in QA History',
      customer_phone: PHONE_SPACED,
      vehicle_plate: PLATE,
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      vehicle_type: 'medium',
      service_id: serviceRow.id,
      branch: 'bacoor',
      status: 'completed',
      price_minor: serviceRow.price_minor,
      final_price_minor: serviceRow.price_minor,
      scheduled_start: new Date().toISOString(),
      waiting_at: new Date().toISOString(),
      notes: 'QA walk-in history attach',
      is_archived: false,
    })
    .select('id')
    .single()
  if (bErr) throw bErr
  created.bookings.push(booking.id)
  check('orphan booking stored with spaced phone', Boolean(booking.id), booking.id)

  // 2. Real signupCustomer → claimWalkInHistory (PostgREST match + sameHandset) + history flags.
  const signed = await signupCustomer({
    body: {
      phone: PHONE,
      full_name: `Qa History ${stamp}`,
      plate: PLATE,
      date_of_birth: '1990-01-15',
      password: PASS,
      confirm: PASS,
      accepted_terms: true,
    },
    requestOrigin: 'http://127.0.0.1:5174',
  })
  created.authIds.push(signed.user_id)
  created.customers.push(signed.user_id)
  check('signup returns existing_history', signed.existing_history === true, JSON.stringify(signed))
  check('history sentence constant still shipped', EXISTING_HISTORY_MESSAGE === 'You have existing history with us.')
  check(
    'historySignupFlags matches response',
    historySignupFlags({ count: 1 }).existing_history === signed.existing_history,
  )
  const { data: afterSignup } = await admin.from('bookings').select('customer_id').eq('id', booking.id).single()
  check('signup claim attached booking', afterSignup?.customer_id === signed.user_id, afterSignup?.customer_id)

  // Second orphan with the same handset (spaces) proves claimWalkInHistory match filter again
  // without clearing customer_id (PostgREST/DB keeps the first attach).
  const { data: booking2, error: b2Err } = await admin
    .from('bookings')
    .insert({
      customer_id: null,
      customer_name: 'Walk-in QA History 2',
      customer_phone: PHONE_SPACED,
      vehicle_plate: `${PLATE}B`,
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      vehicle_type: 'medium',
      service_id: serviceRow.id,
      branch: 'bacoor',
      status: 'completed',
      price_minor: serviceRow.price_minor,
      final_price_minor: serviceRow.price_minor,
      scheduled_start: new Date().toISOString(),
      waiting_at: new Date().toISOString(),
      notes: 'QA walk-in history attach',
      is_archived: false,
    })
    .select('id')
    .single()
  if (b2Err) throw b2Err
  created.bookings.push(booking2.id)
  const reclaimed = await claimWalkInHistory(admin, { customerId: signed.user_id, phone: PHONE })
  check('claimWalkInHistory attaches second spaced-phone orphan', reclaimed === 1, String(reclaimed))

  // 3. Second account (buyer) + vehicle on seller + open maintenance.
  const buyer = await signupCustomer({
    body: {
      phone: `0918${stamp}`.slice(0, 11),
      full_name: `Qa Buyer ${stamp}`,
      plate: `BUY${stamp.slice(-4)}`,
      date_of_birth: '1991-02-20',
      password: PASS,
      confirm: PASS,
      accepted_terms: true,
    },
    requestOrigin: 'http://127.0.0.1:5174',
  })
  created.authIds.push(buyer.user_id)
  created.customers.push(buyer.user_id)

  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id, customer_id, plate_number, normalized_plate_number')
    .eq('customer_id', signed.user_id)
    .eq('is_archived', false)
    .ilike('plate_number', PLATE)
    .maybeSingle()
  assert.ok(vehicle?.id, 'seller garage plate missing after signup')
  created.vehicles.push(vehicle.id)

  const coated = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setMonth(due.getMonth() + 6)
  const { data: sched, error: sErr } = await admin
    .from('vehicle_maintenance_schedules')
    .insert({
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number,
      plate_normalized: vehicle.normalized_plate_number,
      customer_id: signed.user_id,
      customer_name: `Qa History ${stamp}`,
      customer_phone: PHONE,
      status: 'scheduled',
      coated_at: coated,
      next_due_at: due.toISOString().slice(0, 10),
      service_slug: 'paint-maintenance',
      program_key: 'paint_maintenance',
      branch_slug: 'bacoor',
      notes: 'QA transfer maintenance follow',
    })
    .select('id')
    .single()
  if (sErr) throw sErr
  created.schedules.push(sched.id)

  const ba = await login('admin')
  const moved = await transferVehicle({
    accessToken: ba.token,
    vehicleId: vehicle.id,
    toCustomerId: buyer.user_id,
  })
  check('BA transfer ok', moved?.ok === true, JSON.stringify(moved))

  const { data: afterMove } = await admin.from('vehicles').select('customer_id').eq('id', vehicle.id).single()
  check('vehicle owner is buyer', afterMove?.customer_id === buyer.user_id, afterMove?.customer_id)

  const { data: maint } = await admin
    .from('vehicle_maintenance_schedules')
    .select('customer_id, customer_phone, customer_name')
    .eq('id', sched.id)
    .single()
  check('open maintenance follows buyer', maint?.customer_id === buyer.user_id, JSON.stringify(maint))

  // 5. Reverse transfer (seller gets car back) so cleanup ownership is simple.
  const back = await transferVehicle({
    accessToken: ba.token,
    vehicleId: vehicle.id,
    toCustomerId: signed.user_id,
  })
  check('reverse transfer ok', back?.ok === true, JSON.stringify(back))
} catch (err) {
  check('script ran to completion', false, err.message)
  console.error(err)
} finally {
  if (created.schedules.length) {
    await admin.from('vehicle_maintenance_schedules').delete().in('id', created.schedules)
  }
  if (created.bookings.length) {
    const { error: delB } = await admin.from('bookings').delete().in('id', created.bookings)
    if (delB) {
      await admin
        .from('bookings')
        .update({ is_archived: true, notes: 'QA walk-in history attach · cleaned' })
        .in('id', created.bookings)
    }
  }
  // Leftovers from a prior failed run of this script.
  await admin
    .from('bookings')
    .delete()
    .eq('notes', 'QA walk-in history attach')
    .is('customer_id', null)
  if (created.vehicles.length) {
    await admin.from('vehicles').delete().in('id', created.vehicles)
  }
  for (const id of created.customers) {
    await admin.from('vehicles').delete().eq('customer_id', id)
    await admin.from('customers').delete().eq('id', id)
  }
  for (const id of created.authIds) {
    await admin.auth.admin.deleteUser(id)
  }
  await admin.from('sms_events').delete().in('phone', [PHONE, `0918${stamp}`.slice(0, 11)])
  console.log('cleanup done')
}

const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
