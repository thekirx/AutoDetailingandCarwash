/**
 * Branch Admin captures the customer at POS (TL no longer does). Runs the real server handler
 * and the real RPCs with the demo TL / BA logins, then removes everything it created.
 *   node scripts/e2e-pos-ticket-customer.mjs
 * Proves: customer-less ticket reaches payment · phone/email dedupe · conflict refused ·
 * ticket + visit group + handoff move onto one customer. Does not post a sale.
 */
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}
const { provisionCustomerAccount } = await import('../server/provisionCustomer.mjs')

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function login(id) {
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`${id} login: ${error.message}`)
  return { client, token: data.session.access_token, id: data.user.id }
}

const stamp = Date.now().toString().slice(-6)
const PHONE_A = `0917${stamp}0`.slice(0, 11)
const PHONE_B = `0918${stamp}1`.slice(0, 11)
const EMAIL_A = `qa.pos.a.${stamp}@example.com`
const EMAIL_B = `qa.pos.b.${stamp}@example.com`
const created = { bookings: [], customers: new Set(), vehicles: [] }

const ba = await login('admin')
const tl = await login('tl')
const { data: baProfile } = await admin.from('staff_profiles').select('branch_slug').eq('id', ba.id).single()
const branch = baProfile.branch_slug
const { data: service } = await admin
  .from('services').select('id, price_minor').eq('is_active', true).eq('is_archived', false)
  .not('pay_category', 'in', '(detailing,ppf)').gt('price_minor', 0).limit(1).single()

const provision = (token, body) => provisionCustomerAccount({ accessToken: token, siteOrigin: 'http://localhost', body: { site_origin: 'http://localhost', allow_walk_in_name: true, ...body } })

async function ticket(plate, extra = {}) {
  const { data, error } = await admin.from('bookings').insert({
    customer_id: null, customer_name: `Walk-in · ${plate}`, customer_phone: '',
    vehicle_plate: plate, vehicle_make: '', vehicle_model: '', vehicle_type: 'medium', service_id: service.id, branch,
    status: 'in_progress', price_minor: service.price_minor, final_price_minor: service.price_minor,
    scheduled_start: new Date().toISOString(), waiting_at: new Date().toISOString(),
    team_lead_id: tl.id, created_by: tl.id, notes: 'QA pos ticket customer', ...extra,
  }).select('id, visit_group_id, vehicle_id').single()
  if (error) throw new Error(error.message)
  created.bookings.push(data.id)
  if (data.vehicle_id) created.vehicles.push(data.vehicle_id)
  return data
}

try {
  // 1. TL sends a customer-less ticket to payment.
  const t1 = await ticket(`QPT${stamp}A`)
  const sent = await tl.client.rpc('send_queue_ticket_to_payment', { input_booking_id: t1.id })
  assert.ifError(sent.error)
  const { data: h1 } = await admin.from('pos_handoffs').select('id, customer_id, status').eq('booking_id', t1.id).single()
  assert.equal(h1.customer_id, null)
  console.log('✔ TL ticket reaches payment with no customer')

  // 2. Nobody owns this phone yet.
  const miss = await provision(ba.token, { lookup_only: true, customer_phone: PHONE_A })
  assert.equal(miss.found, false)
  console.log('✔ lookup: new phone is free')

  // 3. BA saves the customer: account + ticket + handoff move together.
  const made = await provision(ba.token, { customer_phone: PHONE_A, customer_email: EMAIL_A, customer_first_name: 'Qa', customer_last_name: 'Pos' })
  created.customers.add(made.customer_id)
  assert.equal(made.created, true)
  const assigned = await ba.client.rpc('assign_queue_ticket_customer', { p_booking_id: t1.id, p_customer_id: made.customer_id })
  assert.ifError(assigned.error)
  const { data: b1 } = await admin.from('bookings').select('customer_id, customer_name, customer_phone, customer_email').eq('id', t1.id).single()
  assert.deepEqual([b1.customer_id, b1.customer_name, b1.customer_email], [made.customer_id, 'Qa Pos', EMAIL_A])
  const { data: h1b } = await admin.from('pos_handoffs').select('customer_id').eq('id', h1.id).single()
  assert.equal(h1b.customer_id, made.customer_id)
  console.log('✔ BA creates the account; ticket + handoff now name', b1.customer_name)

  // 4. Same person again — by phone, by email — autofills, never duplicates.
  for (const [label, body] of [['phone', { customer_phone: PHONE_A }], ['email', { customer_email: EMAIL_A }]]) {
    const hit = await provision(ba.token, { lookup_only: true, ...body })
    assert.equal(hit.found, true, `${label} lookup`)
    assert.equal(hit.customer.id, made.customer_id)
    assert.equal(hit.match, label)
  }
  const again = await provision(ba.token, { customer_phone: PHONE_A, customer_first_name: 'Qa', customer_last_name: 'Pos' })
  assert.equal(again.customer_id, made.customer_id)
  assert.equal(again.created, false)
  const emailOnly = await provision(ba.token, { customer_phone: PHONE_A, customer_email: EMAIL_A })
  assert.equal(emailOnly.customer_id, made.customer_id)
  const { count } = await admin.from('customers').select('id', { count: 'exact', head: true }).or(`phone.eq.${PHONE_A},email.ilike.${EMAIL_A}`)
  assert.equal(count, 1)
  console.log('✔ phone/email lookups return the same customer; no duplicate row')

  // 5. A second customer, then a phone/email clash is refused.
  const other = await provision(ba.token, { customer_phone: PHONE_B, customer_email: EMAIL_B, customer_first_name: 'Qa', customer_last_name: 'Other' })
  created.customers.add(other.customer_id)
  await assert.rejects(provision(ba.token, { customer_phone: PHONE_A, customer_email: EMAIL_B }), (e) => e.status === 409)
  const clash = await provision(ba.token, { lookup_only: true, customer_phone: PHONE_A, customer_email: EMAIL_B })
  assert.ok(clash.conflict)
  console.log('✔ phone of one customer + email of another is refused')

  // 6. A visit group moves as one.
  const gid = crypto.randomUUID()
  const g1 = await ticket(`QPT${stamp}B`, { visit_group_id: gid })
  const g2 = await ticket(`QPT${stamp}C`, { visit_group_id: gid })
  const sent2 = await tl.client.rpc('send_queue_ticket_to_payment', { input_booking_id: g1.id })
  assert.ifError(sent2.error)
  const moved = await ba.client.rpc('assign_queue_ticket_customer', { p_booking_id: g1.id, p_customer_id: other.customer_id })
  assert.ifError(moved.error)
  const { data: grp } = await admin.from('bookings').select('customer_id').in('id', [g1.id, g2.id])
  assert.ok(grp.every((r) => r.customer_id === other.customer_id))
  console.log('✔ both cars in the visit group follow the customer')

  // 7. Only Branch Admin / Super Admin can assign.
  const denied = await tl.client.rpc('assign_queue_ticket_customer', { p_booking_id: g1.id, p_customer_id: made.customer_id })
  assert.ok(denied.error)
  console.log('✔ Team Lead cannot assign a customer:', denied.error.message)
} finally {
  const ids = created.bookings
  if (ids.length) {
    const { data: handoffs } = await admin.from('pos_handoffs').select('id').in('booking_id', ids)
    const hIds = (handoffs || []).map((h) => h.id)
    await admin.from('transactions').delete().in('booking_id', ids)
    if (hIds.length) await admin.from('pos_handoffs').delete().in('id', hIds)
    await admin.from('queue_assignments').delete().in('booking_id', ids)
    await admin.from('queue_events').delete().in('booking_id', ids)
    await admin.from('bookings').delete().in('id', ids)
  }
  if (created.vehicles.length) await admin.from('vehicles').delete().in('id', created.vehicles)
  for (const id of created.customers) {
    await admin.from('customers').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
  await admin.from('sms_events').delete().in('phone', [PHONE_A, PHONE_B])
  console.log('cleanup done')
}
