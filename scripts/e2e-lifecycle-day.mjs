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
import {
  buildPayrollPreview,
  buildRunPayrollPayload,
  floorConfirmBlockedByPendingCloses,
  payrollBlocksConfirm,
} from '../src/lib/payroll.js'

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

  const { data: already, error: attErr } = await boss.client
    .from('staff_attendance')
    .select('staff_id, status, staff_profiles(full_name, role)')
    .eq('attendance_date', today)
    .eq('branch_slug', tlProfile.branch_slug)
    .in('status', ['present', 'late'])
  if (attErr) throw new Error(attErr.message)
  const others = (already || []).filter((row) => row.staff_id !== crew.id)

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

  const baseline = {
    square_sales_minor: kindSum,
    cash_sales_minor: kindSum,
    total_gcash_minor: 0,
    credit_card_minor: 0,
    total_expenses_minor: 0,
    ca_collected_minor: 0,
    downpayments_minor: 0,
    total_cash_left_minor: kindSum,
  }
  let closeId = null
  const { data: closeRow, error: closeErr } = await admin.client.rpc('submit_shift_close', {
    payload: {
      branch: tlProfile.branch_slug,
      business_date: today,
      shift_ended_at: new Date().toISOString(),
      pos_baseline: baseline,
      submitted: baseline,
      override_reasons: {},
    },
  })
  if (closeErr && /already/i.test(closeErr.message)) {
    const { data: existingClose, error: existingErr } = await boss.client
      .from('shift_close_reports')
      .select('id, status')
      .eq('branch', tlProfile.branch_slug)
      .eq('business_date', today)
      .in('status', ['accepted', 'locked', 'submitted'])
      .limit(1)
      .maybeSingle()
    if (existingErr || !existingClose) throw new Error(closeErr.message)
    closeId = existingClose.id
    if (existingClose.status === 'submitted') {
      const { error: reviewErr } = await boss.client.rpc('review_shift_close', {
        payload: { id: closeId, action: 'accept', review_note: 'QA lifecycle accept' },
      })
      if (reviewErr) throw new Error(reviewErr.message)
    }
  } else if (closeErr) {
    throw new Error(closeErr.message)
  } else {
    closeId = closeRow.id
    const { error: reviewErr } = await boss.client.rpc('review_shift_close', {
      payload: { id: closeId, action: 'accept', review_note: 'QA lifecycle accept' },
    })
    if (reviewErr) throw new Error(reviewErr.message)
  }
  pass('finance.accept_close', closeId)

  const { data: rulesRow } = await boss.client.from('compensation_settings').select('*').limit(1).maybeSingle()
  const { data: salesToday, error: salesErr } = await boss.client
    .from('sales')
    .select('id, branch, status, total_minor, occurred_at, created_at, sale_line_items(line_total_minor, line_kind, item_type, name)')
    .eq('branch', tlProfile.branch_slug)
    .eq('status', 'paid')
    .gte('occurred_at', `${today}T00:00:00+08:00`)
    .lte('occurred_at', `${today}T23:59:59+08:00`)
  if (salesErr) throw new Error(salesErr.message)
  const { data: attRows } = await boss.client
    .from('staff_attendance')
    .select('staff_id, branch_slug, attendance_date, status, staff_profiles(id, full_name, role)')
    .eq('attendance_date', today)
    .eq('branch_slug', tlProfile.branch_slug)
    .in('status', ['present', 'late'])
  const attendance = (attRows || []).map((row) => ({
    staff_id: row.staff_id,
    id: row.staff_id,
    full_name: row.staff_profiles?.full_name,
    role: row.staff_profiles?.role,
    branch_slug: row.branch_slug,
    attendance_date: row.attendance_date,
    attendance_status: row.status,
    status: row.status,
  }))
  const preview = buildPayrollPreview({
    period: { start: today, end: today },
    rules: rulesRow || {},
    sales: salesToday || [],
    attendance,
    runKind: 'floor',
    frequency: 'daily',
  })
  const closeGate = floorConfirmBlockedByPendingCloses({
    pendingFloorOptional: rulesRow?.pending_floor_optional === false,
    runKind: 'floor',
    branch: tlProfile.branch_slug,
    periodStart: today,
    periodEnd: today,
    closes: [{ branch: tlProfile.branch_slug, business_date: today, status: 'accepted' }],
  })
  const block = payrollBlocksConfirm(preview)
  if (closeGate.blocked) throw new Error(closeGate.reason)
  if (block.blocked) throw new Error(block.reason)
  const proofIds = new Set((preview.proof || []).map((row) => row.sale_id))
  if (saleId && !proofIds.has(String(saleId))) throw new Error('QA sale is missing from payroll proof')
  const payerIds = [...new Set((preview.lines || []).filter((row) => row.pay_minor > 0).map((row) => row.staff_id))]
  if (others.length) {
    pass('payroll.proof', `sale in proof · confirm withheld because ${others.length} other present row(s) already exist`)
  } else if (payerIds.length && payerIds.some((id) => id !== crew.id)) {
    pass('payroll.proof', 'sale in proof · confirm withheld because preview pays someone other than the QA crew')
  } else {
    const payrollPayload = buildRunPayrollPayload({
      preview,
      branch: tlProfile.branch_slug,
      frequency: 'daily',
      runKind: 'floor',
      notes: 'QA lifecycle day',
    })
    const { data: run, error: runErr } = await boss.client.rpc('run_payroll', { payload: payrollPayload })
    if (runErr) throw new Error(runErr.message)
    pass('payroll.confirm', run?.id || `payout ${run?.total_payout_minor ?? preview.total_payout_minor}`)
  }

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
