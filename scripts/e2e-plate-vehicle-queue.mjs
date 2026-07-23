/**
 * E2E: plate autofill + PH brand/model catalog + queue ticket create + status path.
 * Usage: node scripts/e2e-plate-vehicle-queue.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { filterVehicleMakes, filterVehicleModels, splitCustomerName } from '../src/lib/phVehicles.js'
import { normalizePlate } from '../src/queue/queueLogic.js'

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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const client = createClient(url, anon)

const results = []
function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.error('✖', name, detail)
}

const stamp = Date.now().toString(36).toUpperCase()
const plate = `QA${stamp.slice(-6)}`
const phone = '09625294043'

try {
  // Catalog smart search
  if (filterVehicleMakes('mit').some((m) => m === 'Mitsubishi')) pass('catalog.make_search')
  else fail('catalog.make_search')
  if (filterVehicleModels('Toyota', 'for').includes('Fortuner')) pass('catalog.model_search')
  else fail('catalog.model_search')
  if (splitCustomerName('Ana Reyes').last === 'Reyes') pass('catalog.split_name')
  else fail('catalog.split_name')

  // Seed customer + vehicle for plate autofill
  const email = `qa.plate.${stamp.toLowerCase()}@customers.hakumautocare.com`
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: 'HakumQA2026!',
    email_confirm: true,
    user_metadata: { full_name: 'QA Plate Autofill' },
  })
  if (authErr) throw authErr
  const customerId = authUser.user.id

  await admin.from('customers').upsert({
    id: customerId,
    full_name: 'QA Plate Autofill',
    first_name: 'QA',
    last_name: 'Plate Autofill',
    phone,
    email,
    role: 'customer',
    is_archived: false,
  })

  const { data: vehicle, error: vehErr } = await admin
    .from('vehicles')
    .insert({
      customer_id: customerId,
      plate_number: plate,
      normalized_plate_number: normalizePlate(plate),
      vehicle_make: 'Toyota',
      vehicle_model: 'Fortuner',
      vehicle_type: 'suv',
      vehicle_year: 2022,
      color: 'Pearl White',
      is_archived: false,
    })
    .select('id')
    .single()
  if (vehErr) throw vehErr
  pass('seed.vehicle', plate)

  // TL login + masterlist lookup (same path as UI)
  const { error: loginErr } = await client.auth.signInWithPassword({
    email: 'teamlead@hakumautocare.com',
    password: 'HakumTL2026!',
  })
  if (loginErr) throw loginErr
  pass('tl.login')

  const { data: match, error: lookErr } = await client
    .from('customer_vehicle_masterlist')
    .select('vehicle_id, customer_id, plate_number, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_type')
    .eq('normalized_plate_number', normalizePlate(plate))
    .limit(1)
    .maybeSingle()
  if (lookErr) fail('plate.lookup', lookErr.message)
  else if (!match || match.vehicle_make !== 'Toyota' || match.vehicle_model !== 'Fortuner') {
    fail('plate.lookup', JSON.stringify(match))
  } else {
    pass('plate.lookup', `${match.customer_name} · ${match.vehicle_make} ${match.vehicle_model}`)
  }

  // Enrich year/color like queueApi.lookupPlate
  const { data: enrich } = await client
    .from('vehicles')
    .select('vehicle_year, color')
    .eq('id', vehicle.id)
    .maybeSingle()
  if (enrich?.vehicle_year === 2022 && /pearl/i.test(enrich.color || '')) pass('plate.enrich_year_color')
  else fail('plate.enrich_year_color', JSON.stringify(enrich))

  // Public soft lookup (service-side shape)
  const { data: pubVeh } = await admin
    .from('vehicles')
    .select('vehicle_make, vehicle_model, vehicle_type')
    .eq('normalized_plate_number', normalizePlate(plate))
    .eq('is_archived', false)
    .limit(1)
    .maybeSingle()
  if (pubVeh?.vehicle_make === 'Toyota') pass('public.plate_soft_lookup')
  else fail('public.plate_soft_lookup', JSON.stringify(pubVeh))

  // Create queue booking as TL (branch-scoped)
  const { data: profile } = await client.from('staff_profiles').select('id, branch_slug, role').eq('role', 'team_lead').limit(1).maybeSingle()
  const branch = profile?.branch_slug || 'bacoor'
  const { data: service } = await admin.from('services').select('id, price_minor').eq('is_active', true).limit(1).maybeSingle()
  if (!service) throw new Error('No active service')

  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicle.id,
      customer_name: 'QA Plate Autofill',
      customer_phone: phone,
      vehicle_plate: plate,
      vehicle_make: 'Toyota',
      vehicle_model: 'Fortuner',
      vehicle_type: 'suv',
      branch,
      status: 'waiting',
      service_id: service.id,
      price_minor: service.price_minor,
      final_price_minor: service.price_minor,
      queue_date: new Date().toISOString().slice(0, 10),
      scheduled_start: new Date().toISOString(),
    })
    .select('id, status, branch, vehicle_plate')
    .single()
  if (bookErr) fail('queue.ticket_create', bookErr.message)
  else pass('queue.ticket_create', booking.id)

  // Status progression
  if (booking?.id) {
    for (const status of ['in_progress', 'final_checking', 'for_payment']) {
      const { error } = await admin.from('bookings').update({ status }).eq('id', booking.id)
      if (error) fail(`queue.status.${status}`, error.message)
      else pass(`queue.status.${status}`)
    }
    await admin.from('bookings').delete().eq('id', booking.id)
  }

  await admin.from('vehicles').delete().eq('id', vehicle.id)
  await admin.from('customers').delete().eq('id', customerId)
  await admin.auth.admin.deleteUser(customerId)
  pass('cleanup')
} catch (err) {
  fail('fatal', err.message)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
