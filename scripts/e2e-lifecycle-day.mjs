/**
 * One shop day on QA plates. Uses each role's login and the same writes the pages use.
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-lifecycle-day.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { isBookingBoardService, isSameDayQueueKind } from '../src/lib/serviceKinds.js'
import { buildPosSalePayload } from '../src/lib/posSale.js'
import { summarizeSheetSales } from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'lifecycle-day')
mkdirSync(outDir, { recursive: true })

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    if (!process.env[k]) process.env[k] = line.slice(i + 1)
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !anon) throw new Error('missing supabase url/anon key')
const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const PLATE_WASH = 'NKA9231'
const PLATE_CANCEL = 'NKA9232'
const PLATE_REDO = 'NKA9233'
const PLATE_BOOK = 'NKA9234'
const PHONE = '09189990923'

const steps = []
function pass(name, detail = '') {
  steps.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  steps.push({ ok: false, name, detail: String(detail) })
  console.error('✖', name, detail)
}

function account(id) {
  return OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
}

async function asUser(id) {
  const acct = account(id)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
  if (error) throw new Error(`${id} login: ${error.message}`)
  return { client, user: data.user, token: data.session.access_token }
}

function priceFor(service) {
  const rows = service.service_size_prices || []
  const medium = rows.find((r) => r.size_slug === 'medium')
  const minor = Number(medium?.price_minor ?? service.price_minor ?? 0)
  return minor > 0 ? minor : 35000
}

async function insertTicket(client, { profile, service, plate, status = 'waiting', token }) {
  const provision = await fetch(`${base}/api/provision-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      customer_phone: PHONE,
      customer_first_name: 'QA',
      customer_last_name: 'Lifecycle',
      customer_name: 'QA Lifecycle',
      vehicle_plate: plate,
      allow_walk_in_name: true,
      site_origin: base,
    }),
  })
  const provisionBody = await provision.json().catch(() => ({}))
  if (!provision.ok || !provisionBody.customer_id) {
    throw new Error(provisionBody.error || 'provision-customer failed')
  }
  const minor = priceFor(service)
  const row = {
    customer_id: provisionBody.customer_id,
    customer_name: 'QA Lifecycle',
    customer_phone: PHONE,
    vehicle_plate: plate,
    vehicle_make: 'Toyota',
    vehicle_model: 'Vios',
    vehicle_type: 'medium',
    service_id: service.id,
    branch: profile.branch_slug,
    status,
    price_minor: minor,
    final_price_minor: minor,
    scheduled_start: new Date().toISOString(),
    waiting_at: new Date().toISOString(),
    created_by: profile.id,
    team_lead_id: profile.id,
    notes: 'QA lifecycle day',
  }
  const { data, error } = await client.from('bookings').insert(row).select('id, status, branch, final_price_minor').single()
  if (error) throw new Error(error.message)
  return data
}

let report = {}
try {
  const tl = await asUser('tl')
  const { data: tlProfile, error: tlErr } = await tl.client.from('staff_profiles').select('id, role, branch_slug, full_name').eq('id', tl.user.id).single()
  if (tlErr) throw new Error(tlErr.message)
  pass('tl.login', `${tlProfile.role} ${tlProfile.branch_slug}`)

  const { data: services, error: svcErr } = await tl.client
    .from('services')
    .select('id, name, slug, pay_category, price_minor, is_active, service_size_prices(size_slug, price_minor)')
    .eq('is_active', true)
  if (svcErr) throw new Error(svcErr.message)
  const detailing = (services || []).find((s) => isBookingBoardService(s))
  const wash = (services || [])
    .filter((s) => isSameDayQueueKind(s.pay_category) && !isBookingBoardService(s))
    .sort((a, b) => priceFor(b) - priceFor(a))[0]
  if (!detailing || !wash) throw new Error('missing detailing or wash service')
  pass('catalog', `wash ${wash.name} · detailing ${detailing.name}`)

  await tl.client
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'QA rerun',
    })
    .eq('notes', 'QA lifecycle day')
    .in('status', ['waiting', 'in_progress', 'final_checking', 'redo', 'for_payment'])

  const when = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString()
  const bookRes = await fetch(`${base}/api/public-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_first_name: 'QA',
      customer_last_name: 'Lifecycle',
      customer_phone: PHONE,
      vehicle_plate: PLATE_BOOK,
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
      vehicle_type: 'medium',
      scheduled_start: when,
      service_id: detailing.id,
      branch: tlProfile.branch_slug,
    }),
  })
  const bookBody = await bookRes.json().catch(() => ({}))
  if (!bookRes.ok) throw new Error(bookBody.error || `public-book ${bookRes.status}`)
  pass('customer.book', `${bookBody.booking?.id} ${bookBody.booking?.status}`)

  const statusRes = await fetch(`${base}/api/booking-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tl.token}` },
    body: JSON.stringify({ booking_id: bookBody.booking.id, status: 'confirmed' }),
  })
  const statusBody = await statusRes.json().catch(() => ({}))
  if (!statusRes.ok) throw new Error(statusBody.error || `booking-status ${statusRes.status}`)
  pass('tl.confirm_booking', statusBody.status || statusBody.booking?.status || 'confirmed')

  const boss = await asUser('boss')
  const { data: crew, error: crewErr } = await boss.client
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug')
    .eq('role', 'staff')
    .eq('branch_slug', tlProfile.branch_slug)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (crewErr || !crew) throw new Error(crewErr?.message || 'no bay crew on the team lead branch')

  const clock = `${today}T09:00:00+08:00`
  const { error: ovErr } = await boss.client.from('staff_attendance').upsert(
    {
      staff_id: crew.id,
      branch_slug: tlProfile.branch_slug,
      attendance_date: today,
      status: 'present',
      checked_in_at: clock,
      source: 'admin',
      marked_by: boss.user.id,
      notes: 'QA lifecycle override',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'staff_id,attendance_date' },
  )
  if (ovErr) throw new Error(ovErr.message)
  pass('crew.attendance', `${crew.full_name} present ${today}`)

  const washTicket = await insertTicket(tl.client, { profile: tlProfile, service: wash, plate: PLATE_WASH, token: tl.token })
  const { error: assignErr } = await tl.client.rpc('sync_queue_assignments', {
    input_booking_id: washTicket.id,
    input_staff_ids: [crew.id],
  })
  if (assignErr) throw new Error(assignErr.message)
  const now = new Date().toISOString()
  const { error: startErr } = await tl.client
    .from('bookings')
    .update({ status: 'in_progress', in_progress_at: now, actual_start: now })
    .eq('id', washTicket.id)
  if (startErr) throw new Error(startErr.message)
  const { error: checkErr } = await tl.client
    .from('bookings')
    .update({ status: 'final_checking', final_checking_at: new Date().toISOString(), final_checked_by: tlProfile.id })
    .eq('id', washTicket.id)
  if (checkErr) throw new Error(checkErr.message)
  pass('tl.wash_to_final_check', washTicket.id)

  const admin = await asUser('admin')
  const { data: handoff, error: payErr } = await admin.client.rpc('send_queue_ticket_to_payment', { input_booking_id: washTicket.id })
  if (payErr) throw new Error(payErr.message)
  const { data: handoffRow, error: hErr } = await admin.client
    .from('pos_handoffs')
    .select('id, booking_id, amount_minor, status')
    .eq('booking_id', washTicket.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (hErr || !handoffRow) throw new Error(hErr?.message || 'no POS handoff')
  const payload = buildPosSalePayload({
    branch: tlProfile.branch_slug,
    customerId: null,
    paymentMethod: 'cash',
    notes: 'QA lifecycle day',
    activeHandoff: { id: handoffRow.id, booking_id: washTicket.id },
    cart: [{
      id: wash.id,
      item_type: 'service',
      name: wash.name,
      quantity: 1,
      unit_price_minor: washTicket.final_price_minor,
      vehicle_size: 'medium',
    }],
  })
  const { data: sale, error: saleErr } = await admin.client.rpc('complete_pos_sale', { payload })
  if (saleErr) throw new Error(saleErr.message)
  const saleId = sale?.id || sale?.sale_id
  pass('admin.pos_paid', `${saleId || 'paid'} ₱${(washTicket.final_price_minor / 100).toFixed(0)} handoff ${handoff ? 'ok' : ''}`)

  const cancelTicket = await insertTicket(tl.client, { profile: tlProfile, service: wash, plate: PLATE_CANCEL, token: tl.token })
  const { error: cancelErr } = await tl.client
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'QA lifecycle cancel' })
    .eq('id', cancelTicket.id)
  if (cancelErr) throw new Error(cancelErr.message)
  pass('tl.cancel', cancelTicket.id)

  const redoTicket = await insertTicket(tl.client, { profile: tlProfile, service: wash, plate: PLATE_REDO, token: tl.token })
  const { error: redoAssignErr } = await tl.client.rpc('sync_queue_assignments', {
    input_booking_id: redoTicket.id,
    input_staff_ids: [crew.id],
  })
  if (redoAssignErr) throw new Error(redoAssignErr.message)
  const { error: redoStartErr } = await tl.client
    .from('bookings')
    .update({ status: 'in_progress', in_progress_at: new Date().toISOString(), actual_start: new Date().toISOString() })
    .eq('id', redoTicket.id)
  if (redoStartErr) throw new Error(redoStartErr.message)
  const { error: redoErr } = await tl.client
    .from('bookings')
    .update({ status: 'redo', redo_at: new Date().toISOString(), redo_by: tlProfile.id, redo_reason: 'QA lifecycle redo' })
    .eq('id', redoTicket.id)
  if (redoErr) throw new Error(redoErr.message)
  const { error: redoAgainErr } = await tl.client
    .from('bookings')
    .update({ status: 'in_progress', in_progress_at: new Date().toISOString() })
    .eq('id', redoTicket.id)
  if (redoAgainErr) throw new Error(redoAgainErr.message)
  const { error: redoCancelErr } = await tl.client
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'QA lifecycle redo cleanup' })
    .eq('id', redoTicket.id)
  if (redoCancelErr) throw new Error(redoCancelErr.message)
  pass('tl.redo_then_cancel', redoTicket.id)

  const { data: kindRows, error: kindErr } = await boss.client
    .from('finance_daily_line_kind')
    .select('branch, period_date, line_kind, amount_minor')
    .eq('period_date', today)
    .eq('branch', tlProfile.branch_slug)
  if (kindErr) throw new Error(kindErr.message)
  const kindSum = (kindRows || []).reduce((sum, row) => sum + Number(row.amount_minor || 0), 0)
  if (kindSum < washTicket.final_price_minor) {
    throw new Error(`finance kind sum ${kindSum} is below the QA sale ${washTicket.final_price_minor}`)
  }
  pass('finance.today', `${tlProfile.branch_slug} ${today} ${kindSum} minor`)

  // Daily Sheet stays read-only here: today's sheet is the Branch Admin's live data.
  // The save → submit → approve → reopen write path runs on a sandbox date in e2e-daily-sheet-money.mjs.
  const { data: salesToday, error: salesErr } = await boss.client
    .from('sales')
    .select('id, branch, status, total_minor, discount_minor, payment_method, occurred_at, sale_line_items(item_type, line_total_minor, name)')
    .eq('branch', tlProfile.branch_slug)
    .in('status', ['paid', 'refunded'])
    .gte('occurred_at', `${today}T00:00:00+08:00`)
    .lte('occurred_at', `${today}T23:59:59.999+08:00`)
  if (salesErr) throw new Error(salesErr.message)
  const sheetSales = summarizeSheetSales(salesToday || [])
  if (saleId && !(salesToday || []).some((s) => String(s.id) === String(saleId))) {
    throw new Error('QA sale is missing from the Daily Sheet sales')
  }
  pass('sheet.sales_include_qa_sale', `net ${sheetSales.netMinor} · ${sheetSales.count} paid`)
  const { data: sheetRow, error: sheetErr } = await admin.client
    .from('daily_sheets')
    .select('id, status')
    .eq('branch', tlProfile.branch_slug)
    .eq('business_date', today)
    .maybeSingle()
  if (sheetErr) throw new Error(sheetErr.message)
  pass('sheet.ba_reads_today', sheetRow ? `${sheetRow.id} ${sheetRow.status}` : 'not started yet')

  report = {
    today,
    branch: tlProfile.branch_slug,
    plates: { book: PLATE_BOOK, wash: PLATE_WASH, cancel: PLATE_CANCEL, redo: PLATE_REDO },
    sale_id: saleId || null,
    kind_sum_minor: kindSum,
    wash_minor: washTicket.final_price_minor,
  }
} catch (err) {
  fail('fatal', err?.message || String(err))
}

const failed = steps.filter((s) => !s.ok)
const summary = {
  ok: failed.length === 0,
  passed: steps.length - failed.length,
  total: steps.length,
  steps,
  report,
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) process.exit(1)
