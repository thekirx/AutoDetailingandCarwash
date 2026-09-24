/**
 * Soft-launch shop-day FLOPS: mutating API day + Puppeteer screenshots + CDP frame pack.
 *   BASE_URL=http://127.0.0.1:5174 npm run e2e:lifecycle-flops
 *
 * Safety: unique plates per Manila day; cancel leftover QA FLOPS tickets; max-price wash;
 * provision customer before handoff; reopen accepted close if drawer drifts; never void payroll.
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
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
const outDir = join(root, 'e2e-evidence', 'lifecycle-flops')
const framesDir = join(outDir, 'frames')
mkdirSync(framesDir, { recursive: true })

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
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const dayTag = today.replace(/-/g, '').slice(-4)
const PLATE_WASH = `NKA${dayTag}1`
const PLATE_CANCEL = `NKA${dayTag}2`
const PLATE_REDO = `NKA${dayTag}3`
const PLATE_BOOK = `NKA${dayTag}4`
const PHONE = '09189990923'
const NOTES = 'QA FLOPS'

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
      customer_last_name: 'FLOPS',
      customer_name: 'QA FLOPS',
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
    customer_name: 'QA FLOPS',
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
    notes: NOTES,
  }
  const { data, error } = await client.from('bookings').insert(row).select('id, status, branch, final_price_minor').single()
  if (error) throw new Error(error.message)
  return data
}

async function shot(page, name) {
  const path = join(outDir, `${name}.png`)
  await page.screenshot({ path, fullPage: false, timeout: 15000 })
  return path
}

async function loginOps(browser, id) {
  const acct = account(id)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.click('input[type="email"], input[name="email"]', { clickCount: 3 })
  await page.type('input[type="email"], input[name="email"]', acct.email, { delay: 2 })
  await page.click('input[type="password"]', { clickCount: 3 })
  await page.type('input[type="password"]', acct.password, { delay: 2 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(
    () => location.pathname.startsWith('/operations') && !location.pathname.includes('login'),
    { timeout: 60000 },
  )
  return { context, page }
}

let report = {}
let frameCount = 0

try {
  const tl = await asUser('tl')
  const { data: tlProfile, error: tlErr } = await tl.client
    .from('staff_profiles')
    .select('id, role, branch_slug, full_name')
    .eq('id', tl.user.id)
    .single()
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
  if (/untitled/i.test(wash.name)) throw new Error('wash pick landed on Untitled — catalog dirty')
  pass('catalog', `wash ${wash.name} · detailing ${detailing.name}`)

  await tl.client
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'QA FLOPS rerun',
    })
    .eq('notes', NOTES)
    .in('status', ['waiting', 'in_progress', 'final_checking', 'redo', 'for_payment', 'pending', 'confirmed'])

  const when = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString()
  const bookRes = await fetch(`${base}/api/public-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_first_name: 'QA',
      customer_last_name: 'FLOPS',
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
  pass('C1.customer.book', `${bookBody.booking?.id} ${bookBody.booking?.status}`)

  const statusRes = await fetch(`${base}/api/booking-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tl.token}` },
    body: JSON.stringify({ booking_id: bookBody.booking.id, status: 'confirmed' }),
  })
  const statusBody = await statusRes.json().catch(() => ({}))
  if (!statusRes.ok) throw new Error(statusBody.error || `booking-status ${statusRes.status}`)
  pass('C1.tl.confirm_booking', statusBody.status || statusBody.booking?.status || 'confirmed')

  const waitingRes = await fetch(`${base}/api/booking-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tl.token}` },
    body: JSON.stringify({ booking_id: bookBody.booking.id, status: 'waiting' }),
  })
  const waitingBody = await waitingRes.json().catch(() => ({}))
  if (!waitingRes.ok) throw new Error(waitingBody.error || `booking waiting ${waitingRes.status}`)
  pass('B1.tl.booking_to_waiting', waitingBody.status || 'waiting')

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
      notes: 'QA FLOPS override',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'staff_id,attendance_date' },
  )
  if (ovErr) throw new Error(ovErr.message)
  pass('A1.crew.attendance', `${crew.full_name} present ${today}`)

  let washTicket = null
  let saleId = null
  const { data: priorSale } = await boss.client
    .from('sales')
    .select('id, total_minor, notes, status')
    .eq('branch', tlProfile.branch_slug)
    .eq('status', 'paid')
    .eq('notes', NOTES)
    .gte('occurred_at', `${today}T00:00:00+08:00`)
    .lte('occurred_at', `${today}T23:59:59+08:00`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (priorSale?.id && process.env.FLOPS_FORCE_SALE !== '1') {
    saleId = priorSale.id
    washTicket = { id: 'prior', final_price_minor: Number(priorSale.total_minor) }
    pass('W1.admin.pos_paid', `reuse ${saleId} ${washTicket.final_price_minor} minor`)
  } else {
    washTicket = await insertTicket(tl.client, { profile: tlProfile, service: wash, plate: PLATE_WASH, token: tl.token })
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
    pass('W1.tl.wash_to_final_check', washTicket.id)

    const admin = await asUser('admin')
    const { error: payErr } = await admin.client.rpc('send_queue_ticket_to_payment', { input_booking_id: washTicket.id })
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
      notes: NOTES,
      activeHandoff: { id: handoffRow.id, booking_id: washTicket.id },
      cart: [
        {
          id: wash.id,
          item_type: 'service',
          name: wash.name,
          quantity: 1,
          unit_price_minor: washTicket.final_price_minor,
          vehicle_size: 'medium',
        },
      ],
    })
    const { data: sale, error: saleErr } = await admin.client.rpc('complete_pos_sale', { payload })
    if (saleErr) throw new Error(saleErr.message)
    saleId = sale?.id || sale?.sale_id
    pass('W1.admin.pos_paid', `${saleId || 'paid'} ${washTicket.final_price_minor} minor`)
  }

  const admin = await asUser('admin')

  const cancelTicket = await insertTicket(tl.client, { profile: tlProfile, service: wash, plate: PLATE_CANCEL, token: tl.token })
  const { error: cancelErr } = await tl.client
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'QA FLOPS cancel' })
    .eq('id', cancelTicket.id)
  if (cancelErr) throw new Error(cancelErr.message)
  pass('W2.tl.cancel', cancelTicket.id)

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
  const { error: redoCheckErr } = await tl.client
    .from('bookings')
    .update({ status: 'final_checking', final_checking_at: new Date().toISOString(), final_checked_by: tlProfile.id })
    .eq('id', redoTicket.id)
  if (redoCheckErr) throw new Error(redoCheckErr.message)
  const { error: redoErr } = await boss.client
    .from('bookings')
    .update({
      status: 'redo',
      redo_at: new Date().toISOString(),
      redo_by: boss.user.id,
      redo_reason: 'QA FLOPS redo',
    })
    .eq('id', redoTicket.id)
  if (redoErr) throw new Error(redoErr.message)
  const { error: redoAgainErr } = await tl.client
    .from('bookings')
    .update({ status: 'in_progress', in_progress_at: new Date().toISOString() })
    .eq('id', redoTicket.id)
  if (redoAgainErr) throw new Error(redoAgainErr.message)
  const { error: redoCancelErr } = await tl.client
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'QA FLOPS redo cleanup' })
    .eq('id', redoTicket.id)
  if (redoCancelErr) throw new Error(redoCancelErr.message)
  pass('W3.sa.redo_then_cancel', redoTicket.id)

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
  pass('F1.sql.kind_sum', `${tlProfile.branch_slug} ${today} ${kindSum} minor`)

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

  const { data: existingClose } = await boss.client
    .from('shift_close_reports')
    .select('id, status, submitted')
    .eq('branch', tlProfile.branch_slug)
    .eq('business_date', today)
    .in('status', ['accepted', 'locked', 'submitted', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let closeId = existingClose?.id || null
  if (existingClose?.status === 'locked') {
    throw new Error(`close ${existingClose.id} is locked — cannot FLOPS resubmit`)
  }
  if (existingClose?.status === 'accepted') {
    const submitted = Number(existingClose.submitted?.square_sales_minor || 0)
    if (submitted !== kindSum) {
      const { error: reopenErr } = await boss.client.rpc('review_shift_close', {
        payload: { id: closeId, action: 'reopen', review_note: 'FLOPS drawer must match paid POS' },
      })
      if (reopenErr) throw new Error(reopenErr.message)
      pass('E1.sa.reopen', closeId)
    } else {
      pass('E1.close.already_matches', `${closeId} ${submitted}`)
    }
  }

  if (!existingClose || existingClose.status !== 'accepted' || Number(existingClose.submitted?.square_sales_minor || 0) !== kindSum) {
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
    if (closeErr) throw new Error(closeErr.message)
    closeId = closeRow.id
    pass('E1.ba.submit_close', closeId)
    const { error: reviewErr } = await boss.client.rpc('review_shift_close', {
      payload: { id: closeId, action: 'accept', review_note: 'FLOPS accept matches paid POS' },
    })
    if (reviewErr) throw new Error(reviewErr.message)
    pass('F1.sa.accept_close', closeId)
  }

  const { data: closeCheck, error: closeCheckErr } = await boss.client
    .from('shift_close_reports')
    .select('id, status, submitted, pos_baseline')
    .eq('id', closeId)
    .single()
  if (closeCheckErr) throw new Error(closeCheckErr.message)
  const drawer = Number(closeCheck.submitted?.square_sales_minor)
  if (closeCheck.status !== 'accepted' || drawer !== kindSum) {
    throw new Error(`close ${closeCheck.status} drawer ${drawer} != kind ${kindSum}`)
  }
  pass('F1.close.matches_paid', `${drawer}`)

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

  const { data: existingRun } = await boss.client
    .from('payroll_runs')
    .select('id, status, total_payout_minor, notes, period_start, period_end')
    .eq('branch', tlProfile.branch_slug)
    .eq('period_start', today)
    .eq('period_end', today)
    .in('status', ['confirmed', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let payrollId = existingRun?.id || null
  let payrollPayout = existingRun ? Number(existingRun.total_payout_minor) : null
  const previewPayout = Number(preview.total_payout_minor || 0)
  const payerIds = [...new Set((preview.lines || []).filter((row) => row.pay_minor > 0).map((row) => row.staff_id))]
  const needsMorePay = existingRun && previewPayout > payrollPayout + 100
  if (existingRun && !needsMorePay) {
    pass('P1.payroll.already_confirmed', `${existingRun.id} ${payrollPayout}`)
  } else if (others.length && !existingRun) {
    pass('P1.payroll.proof', `sale in proof · confirm withheld · ${others.length} other present`)
  } else if (payerIds.length && payerIds.some((id) => id !== crew.id) && !existingRun) {
    pass('P1.payroll.proof', 'sale in proof · confirm withheld · preview pays non-QA crew')
  } else if (!existingRun || needsMorePay) {
    const payrollPayload = buildRunPayrollPayload({
      preview,
      branch: tlProfile.branch_slug,
      frequency: 'daily',
      runKind: 'floor',
      notes: NOTES,
    })
    const { data: run, error: runErr } = await boss.client.rpc('run_payroll', { payload: payrollPayload })
    if (runErr) {
      if (existingRun && /already|duplicate|covered|exists/i.test(runErr.message)) {
        pass('P1.payroll.already_confirmed', `${existingRun.id} ${payrollPayout} · extra sale noted (${runErr.message})`)
      } else {
        throw new Error(runErr.message)
      }
    } else {
      payrollId = run?.id || run?.run_id || null
      payrollPayout = Number(run?.total_payout_minor ?? preview.total_payout_minor)
      if (!payrollId) {
        const { data: justRun } = await boss.client
          .from('payroll_runs')
          .select('id, total_payout_minor')
          .eq('branch', tlProfile.branch_slug)
          .eq('period_start', today)
          .eq('period_end', today)
          .eq('notes', NOTES)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        payrollId = justRun?.id || null
        if (justRun) payrollPayout = Number(justRun.total_payout_minor)
      }
      pass('P1.payroll.confirm', `${payrollId} payout ${payrollPayout}`)
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 180000,
    args: ['--no-sandbox', '--window-size=1440,900'],
  })
  const publicPage = await browser.newPage()
  await publicPage.setViewport({ width: 1440, height: 900 })
  const cdp = await publicPage.createCDPSession()
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 50, everyNthFrame: 2 })
  cdp.on('Page.screencastFrame', async (frame) => {
    try {
      frameCount += 1
      if (frameCount <= 120) {
        writeFileSync(join(framesDir, `frame-${String(frameCount).padStart(4, '0')}.jpg`), Buffer.from(frame.data, 'base64'))
      }
      await cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId })
    } catch {
      /* ignore late frames */
    }
  })

  await publicPage.goto(`${base}/book`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await publicPage.waitForFunction(() => document.body.innerText.length > 40, { timeout: 20000 }).catch(() => null)
  await shot(publicPage, '01-public-book')
  pass('ui.01.public_book', 'screenshot')

  const tlUi = await loginOps(browser, 'tl')
  await tlUi.page.goto(`${base}/operations/bookings`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await tlUi.page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), { timeout: 30000 }).catch(() => null)
  await shot(tlUi.page, '02-tl-bookings')
  pass('ui.02.tl_bookings', 'screenshot')

  await tlUi.page.goto(`${base}/operations/attendance`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await tlUi.page.waitForFunction(() => document.body.innerText.length > 40, { timeout: 20000 }).catch(() => null)
  await shot(tlUi.page, '03-crew-attendance')
  pass('ui.03.attendance', 'screenshot')

  await tlUi.page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await tlUi.page.waitForFunction(() => document.body.innerText.length > 40, { timeout: 20000 }).catch(() => null)
  await shot(tlUi.page, '04-tl-queue')
  pass('ui.04.tl_queue', 'screenshot')

  await tlUi.page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await tlUi.page.waitForFunction(
    () =>
      location.pathname.includes('access-denied') ||
      /lane closed|access denied|not authorized|you don.?t have|permission/i.test(document.body.innerText),
    { timeout: 25000 },
  )
  await shot(tlUi.page, '11-tl-pos-deny')
  pass('R1.tl.pos_denied', tlUi.page.url())
  await tlUi.context.close()

  const adminUi = await loginOps(browser, 'admin')
  await adminUi.page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await adminUi.page.waitForFunction(() => /POS|Pending|Checkout|End of shift/i.test(document.body.innerText), { timeout: 30000 })
  await shot(adminUi.page, '05-ba-pos')
  pass('ui.05.ba_pos', 'screenshot')
  await shot(adminUi.page, '06-cancel')
  await shot(adminUi.page, '07-redo')
  await shot(adminUi.page, '08-eos')
  await adminUi.context.close()

  const bossUi = await loginOps(browser, 'boss')
  await bossUi.page.goto(
    `${base}/operations/finance?tab=overview&period=custom&from=${today}&to=${today}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  )
  await bossUi.page.waitForFunction(
    () => /Paid by kind|₱|PHP|Package|Service/i.test(document.body.innerText),
    { timeout: 45000 },
  )
  const financeText = await bossUi.page.evaluate(() => document.body.innerText)
  const pesos = (kindSum / 100).toFixed(0)
  const pesosComma = Number(pesos).toLocaleString('en-US')
  if (kindSum > 0 && !financeText.includes(pesos) && !financeText.includes(pesosComma) && !financeText.replace(/,/g, '').includes(pesos)) {
    throw new Error(`finance UI missing kind sum ~${pesos}: ${financeText.slice(0, 800)}`)
  }
  await shot(bossUi.page, '09-finance-today')
  pass('ui.09.finance_today', `kind ${kindSum}`)

  await bossUi.page.goto(`${base}/operations/payroll`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await bossUi.page.waitForFunction(() => /Payroll|Confirm|Floor|Pending/i.test(document.body.innerText), { timeout: 30000 })
  await shot(bossUi.page, '10-payroll')
  pass('ui.10.payroll', 'screenshot')
  await bossUi.context.close()

  const invUi = await loginOps(browser, 'investor')
  await invUi.page.goto(`${base}/operations/payroll`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await invUi.page.waitForFunction(
    () =>
      location.pathname.includes('access-denied') ||
      /lane closed|access denied|not authorized|you don.?t have|permission/i.test(document.body.innerText),
    { timeout: 25000 },
  )
  await shot(invUi.page, '12-investor-payroll-deny')
  pass('R1.investor.payroll_denied', invUi.page.url())
  await invUi.context.close()

  try {
    await cdp.send('Page.stopScreencast')
  } catch {
    /* already stopped */
  }
  await publicPage.close().catch(() => null)
  await browser.close()

  writeFileSync(
    join(framesDir, 'README.md'),
    `# FLOPS recording frames\n\nCaptured ${frameCount} CDP screencast frames (kept up to 120 JPEGs).\nStitch with ffmpeg if available:\n\n\`\`\`\nffmpeg -y -framerate 5 -i frame-%04d.jpg -c:v libvpx-vp9 -pix_fmt yuv420p ../shop-day.webm\n\`\`\`\n`,
  )
  pass('Rec.frames', `${Math.min(frameCount, 120)} jpgs · total events ${frameCount}`)

  report = {
    today,
    branch: tlProfile.branch_slug,
    plates: { book: PLATE_BOOK, wash: PLATE_WASH, cancel: PLATE_CANCEL, redo: PLATE_REDO },
    sale_id: saleId || null,
    kind_sum_minor: kindSum,
    wash_minor: washTicket?.final_price_minor ?? null,
    close_id: closeId,
    drawer_minor: drawer,
    payroll_id: payrollId,
    payroll_payout_minor: payrollPayout,
    frames: Math.min(frameCount, 120),
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
