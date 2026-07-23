/**
 * E2E QA: customer book → TL queue statuses → POS complete, with SMS to test phone.
 * Phone: 09625294043 (+63)
 *
 * Usage: node scripts/e2e-queue-sms-pos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { notifyBookingStatus } from '../server/notifyBooking.mjs'
import { buildPosSalePayload } from '../src/lib/posSale.js'

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

async function login(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

try {
  // Ensure SMS toggle ON
  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: true },
    updated_at: new Date().toISOString(),
  })
  pass('sms.toggle.on')

  // Seed merch product
  const sku = `QA-TOWEL-${Date.now().toString(36)}`
  const { data: product, error: prodErr } = await admin
    .from('products')
    .insert({
      name: 'QA Microfiber Towel',
      sku,
      category: 'merch',
      price_minor: 19900,
      stock_qty: 25,
      is_active: true,
      is_archived: false,
    })
    .select()
    .single()
  if (prodErr) fail('product.create', prodErr.message)
  else pass('product.create', product.id)

  const { data: productEdit, error: editErr } = await admin
    .from('products')
    .update({ stock_qty: 24, price_minor: 18900, updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .select()
    .single()
  if (editErr) fail('product.update', editErr.message)
  else pass('product.update', `stock=${productEdit.stock_qty}`)

  // Service for booking
  const { data: service } = await admin
    .from('services')
    .select('id, name, price_minor')
    .eq('is_active', true)
    .eq('is_archived', false)
    .limit(1)
    .single()
  if (!service) throw new Error('No active service')

  const { data: branch } = await admin.from('branches').select('slug').eq('is_active', true).limit(1).single()

  // Public-style booking with test phone
  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({
      customer_name: 'QA SMS Tester',
      customer_phone: TEST_PHONE,
      vehicle_plate: 'QA9625',
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      service_id: service.id,
      branch: branch.slug,
      scheduled_start: new Date().toISOString(),
      status: 'pending',
      final_price_minor: service.price_minor,
      price_minor: service.price_minor,
      is_archived: false,
    })
    .select('*')
    .single()
  if (bookErr) throw bookErr
  pass('booking.create', booking.id)

  const statuses = ['pending', 'waiting', 'in_progress', 'final_checking', 'for_payment', 'completed']
  for (const status of statuses) {
    await admin.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', booking.id)
    const notify = await notifyBookingStatus({ ...booking, status }, status)
    const smsStatus = notify?.sms?.status || notify?.sms?.ok
    pass(`notify.${status}`, `sms=${smsStatus} enabled=${notify?.smsEnabled}`)
  }

  // POS merch sale as admin
  await login('admin@hakumautocare.com', 'HakumAdmin2026!')
  const payload = buildPosSalePayload({
    branch: branch.slug,
    customerId: '',
    paymentMethod: 'cash',
    cart: [
      {
        item_type: 'product',
        id: product.id,
        name: product.name,
        quantity: 1,
        unit_price_minor: 18900,
      },
    ],
    activeHandoff: null,
  })
  const { data: sale, error: saleErr } = await client.rpc('complete_pos_sale', { payload })
  if (saleErr) fail('pos.merch_sale', saleErr.message)
  else pass('pos.merch_sale', sale?.sale_id)

  // Toggle OFF then confirm notify skips send
  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: false },
    updated_at: new Date().toISOString(),
  })
  const off = await notifyBookingStatus({ ...booking, status: 'completed', customer_phone: TEST_PHONE }, 'completed')
  if (off.sms?.status === 'disabled') pass('sms.toggle.off_skip')
  else fail('sms.toggle.off_skip', JSON.stringify(off.sms))

  // Restore ON
  await admin.from('app_settings').upsert({
    key: 'sms_notifications',
    value: { enabled: true },
    updated_at: new Date().toISOString(),
  })
  pass('sms.toggle.restored')

  // Recent sms_events for test phone
  const { data: events } = await admin
    .from('sms_events')
    .select('status, event_type, phone, created_at')
    .eq('phone', TEST_PHONE)
    .order('created_at', { ascending: false })
    .limit(10)
  pass('sms.events', `${events?.length || 0} rows · ${events?.map((e) => e.status).join(',')}`)
} catch (err) {
  fail('fatal', err.message)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n---\npassed ${results.length - failed.length}/${results.length}`)
process.exit(failed.length ? 1 : 0)
