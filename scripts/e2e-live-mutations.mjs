/**
 * Live DB Mutation & Full End-to-End E2E Verification against https://hakumauto.vercel.app
 * and production Supabase (self-cleaning QA plate QATEST9).
 *
 * Tests:
 * 1. Create queue ticket as Team Lead -> verify Start Service blocked without crew
 * 2. Assign present crew -> In Progress (Start Service hidden, Final Checking shown)
 * 3. CustomerNotesPanel simple Notes save (no Like/Dislike/General dropdown)
 * 4. BossMich Mark Redo -> appears in Failed QA lane -> returns to Final Checking -> Send to payment
 * 5. Branch Admin POS -> Itemized Breakdown -> Modify service (resyncs pos_handoffs/transactions)
 * 6. Branch Admin POS -> Return to Queue -> cancels pending handoff/tx
 * 7. Team Lead -> Change service -> Final Checking -> Send to payment (0 duplicate transactions!)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const BASE = (process.env.BASE_URL || 'https://hakumauto.vercel.app').replace(/\/$/, '')
const QA_KEY = process.env.DEMO_LOGIN_KEY || 'DM0Z_paAUzJ6lcrCZiePE8egqXt_d6ihmGV7XYuWgfU'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const QA_PLATE = 'QATEST9'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const checks = []
const ok = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass, detail })
  console.log(pass ? '✔' : '✖', name, detail ? `— ${detail}` : '')
}

async function cleanupQaData() {
  const { data: bks } = await admin.from('bookings').select('id, vehicle_id').eq('vehicle_plate', QA_PLATE)
  const bIds = (bks || []).map((b) => b.id)
  if (bIds.length) {
    await admin.from('queue_events').delete().in('booking_id', bIds)
    await admin.from('queue_assignments').delete().in('booking_id', bIds)
    await admin.from('pos_handoffs').delete().in('booking_id', bIds)
    await admin.from('transactions').delete().in('booking_id', bIds)
    await admin.from('audit_logs').delete().in('entity_id', bIds)
    await admin.from('bookings').delete().in('id', bIds)
  }
  await admin.from('customer_notes').delete().eq('plate_normalized', QA_PLATE)
  await admin.from('vehicles').delete().eq('normalized_plate_number', QA_PLATE)
}

async function dismissPopups(page) {
  await page.evaluate(() => {
    const cookie = document.querySelector('.cookie-consent-secondary, .cookie-consent-primary')
    if (cookie) cookie.click()
    const notNow = [...document.querySelectorAll('button')].find((b) => /^not now$/i.test(b.innerText.trim()))
    if (notNow) notNow.click()
  })
  await sleep(300)
}

async function demoSignIn(page, chipLabel) {
  await page.goto(`${BASE}/operations/login?qa=${QA_KEY}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto(`${BASE}/operations/login?qa=${QA_KEY}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector('.hakum-demo-chip', { timeout: 20000 })
  await dismissPopups(page)
  const clicked = await page.evaluate((targetLabel) => {
    const chip = [...document.querySelectorAll('.hakum-demo-chip')].find((c) => c.innerText.includes(targetLabel))
    if (chip) {
      chip.click()
      return true
    }
    return false
  }, chipLabel)
  if (!clicked) throw new Error(`Demo chip "${chipLabel}" not found`)
  await page.waitForFunction(() => !location.pathname.startsWith('/operations/login'), { timeout: 45000 })
  await sleep(1500)
  await dismissPopups(page)
}

async function clickButtonByText(page, regex, scopeSelector = 'body') {
  const clicked = await page.evaluate((rxStr, rxFlags, sel) => {
    const rx = new RegExp(rxStr, rxFlags)
    const rootEl = sel === 'dialog'
      ? ([...document.querySelectorAll('[role="dialog"]')].filter((d) => !/Necessary only|Accept all/i.test(d.innerText)).pop() || document.body)
      : document.querySelector(sel) || document.body
    const btns = [...rootEl.querySelectorAll('button')].filter((b) => !b.disabled)
    const match = btns.find((b) => rx.test(b.innerText.trim()))
    if (match) {
      match.scrollIntoView({ block: 'center' })
      match.click()
      return match.innerText.trim()
    }
    return null
  }, regex.source, regex.flags, scopeSelector)
  return clicked
}

async function ensureBacoorCrewPresent() {
  const { data: staff } = await admin.from('staff_profiles').select('id, full_name').eq('role', 'staff').eq('branch_slug', 'bacoor').eq('is_active', true).limit(3)
  if (!staff?.length) return null
  const manilaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  const { data: existing } = await admin.from('staff_attendance').select('staff_id, status').eq('attendance_date', manilaToday).in('staff_id', staff.map((s) => s.id))
  if ((existing || []).some((e) => ['present', 'late'].includes(e.status))) return staff.find((s) => existing.some((e) => e.staff_id === s.id && ['present', 'late'].includes(e.status)))
  // Seed attendance for QA crew assignment only for today if none clocked in yet
  const target = staff[0]
  await admin.from('staff_attendance').upsert({
    staff_id: target.id,
    branch_slug: 'bacoor',
    attendance_date: manilaToday,
    status: 'present',
    checked_in_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,attendance_date' })
  return target
}

let seededAttendanceStaff = null
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

try {
  await cleanupQaData()
  seededAttendanceStaff = await ensureBacoorCrewPresent()

  // ── 1. TEAM LEAD: Create QA ticket -> Crew Block -> Assign -> In Progress -> Notes -> Final Check
  await demoSignIn(page, 'Team Lead')
  await page.goto(`${BASE}/operations/queue/new`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector('input[placeholder*="ABC"]', { timeout: 20000 })
  await dismissPopups(page)

  await page.type('input[placeholder*="ABC"]', QA_PLATE)
  await sleep(600)
  // Step 1 -> Step 2 (Services)
  await clickButtonByText(page, /^Next$/i)
  await page.waitForFunction(() => !!document.querySelector('input[type="checkbox"], button[aria-pressed], .service-kind-picker, form'), { timeout: 15000 })
  await sleep(1000)

  // Pick Premium Car Wash
  const pickedService = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, label')].find((el) => /Premium Car Wash/i.test(el.innerText) && el.innerText.length < 120)
    if (btn) { btn.click(); return true }
    return false
  })
  ok('TL Step 2 selects Premium Car Wash on /operations/queue/new', pickedService)
  await sleep(400)
  await clickButtonByText(page, /^Next$/i)
  await sleep(800)
  const createdClicked = await clickButtonByText(page, /Create Queue Ticket/i)
  ok('TL submits Create Queue Ticket', Boolean(createdClicked))

  await page.waitForFunction(() => /\/operations\/queue/.test(location.pathname) && !location.pathname.endsWith('/new'), { timeout: 30000 })
  await sleep(2500)
  await dismissPopups(page)

  const { data: createdRows } = await admin.from('bookings').select('id, status, service_id, final_price_minor, vehicle_type').eq('vehicle_plate', QA_PLATE)
  const qaBookingId = createdRows?.[0]?.id
  ok('Live DB confirms QA ticket created in waiting status', createdRows?.length === 1 && createdRows[0].status === 'waiting', `id=${qaBookingId}`)

  // Open QATEST9 modal if not already auto-opened
  const modalAlreadyOpen = await page.evaluate((plate) => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.innerText.includes(plate)), QA_PLATE)
  if (!modalAlreadyOpen) {
    await page.evaluate((plate) => {
      const card = [...document.querySelectorAll('article, div')].find((el) => el.innerText.includes(plate) && el.querySelector('button'))
      const openBtn = card ? [...card.querySelectorAll('button')].find((b) => /Open/i.test(b.innerText)) : null
      if (openBtn) openBtn.click()
    }, QA_PLATE)
    await sleep(1500)
  }

  // Verify Start Service is blocked without assigned crew
  const startBlockedState = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !/Necessary only|Accept all/i.test(d.innerText)).pop()
    const btns = dlg ? [...dlg.querySelectorAll('button')] : []
    const blockedBtn = btns.find((b) => /Select crew above, then Start/i.test(b.innerText))
    return { found: Boolean(blockedBtn), disabled: Boolean(blockedBtn?.disabled) }
  })
  ok('Queue enforces crew assignment before Start Service (button disabled)', startBlockedState.found && startBlockedState.disabled)

  // Assign present crew member and click Save crew
  const crewChecked = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !/Necessary only|Accept all/i.test(d.innerText)).pop()
    if (!dlg) return false
    const labels = [...dlg.querySelectorAll('label')].filter((l) => l.querySelector('input[type="checkbox"]') && !l.querySelector('input[type="checkbox"]').disabled)
    if (!labels.length) return false
    labels[0].click()
    return true
  })
  ok('TL ticks present crew member', crewChecked)
  await sleep(300)
  await clickButtonByText(page, /^Save crew$/i, 'dialog')
  await sleep(2500)

  const { data: afterCrewRows } = await admin.from('bookings').select('status, assigned_staff_id').eq('id', qaBookingId)
  ok('Live DB confirms ticket enters in_progress after crew assignment', afterCrewRows?.[0]?.status === 'in_progress' && Boolean(afterCrewRows?.[0]?.assigned_staff_id), afterCrewRows?.[0]?.status)

  // Verify Start Service is hidden under in_progress while Final Checking is shown
  const inProgressBtns = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !/Necessary only|Accept all/i.test(d.innerText)).pop()
    const btns = dlg ? [...dlg.querySelectorAll('button')].map((b) => b.innerText.trim()) : []
    return {
      hasStartService: btns.some((t) => /Start Service|Select crew above/i.test(t)),
      hasFinalChecking: btns.some((t) => /^Final Checking$/i.test(t)),
    }
  })
  ok('In Progress ticket hides Start Service and shows Final Checking', !inProgressBtns.hasStartService && inProgressBtns.hasFinalChecking)

  // Test simple Notes save (no category dropdown)
  await page.type('#guest-note-body', 'Live QA simple note verification')
  await clickButtonByText(page, /^Save note$/i, 'dialog')
  await sleep(1500)
  const { data: noteRows } = await admin.from('customer_notes').select('body, note_type').eq('plate_normalized', QA_PLATE)
  ok('Live DB saves simple note with note_type=general', noteRows?.length === 1 && noteRows[0].note_type === 'general')

  // Move In Progress -> Final Checking
  await clickButtonByText(page, /^Final Checking$/i, 'dialog')
  await sleep(2000)
  const { data: fcRows } = await admin.from('bookings').select('status').eq('id', qaBookingId)
  ok('Live DB transitions ticket to final_checking', fcRows?.[0]?.status === 'final_checking')

  // ── 2. SUPER ADMIN (BossMich): Mark Redo -> Failed QA lane -> Return to Final Checking -> Send to payment
  await demoSignIn(page, 'Super Admin')
  await page.goto(`${BASE}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await sleep(3000)
  await dismissPopups(page)

  await page.evaluate((plate) => {
    const card = [...document.querySelectorAll('article, div')].find((el) => el.innerText.includes(plate) && el.querySelector('button') && el.innerText.length < 400)
    const openBtn = card ? [...card.querySelectorAll('button')].find((b) => /Open/i.test(b.innerText)) : null
    if (openBtn) openBtn.click()
  }, QA_PLATE)
  await sleep(1500)

  const clickedMarkRedo = await clickButtonByText(page, /^Mark Redo$/i, 'dialog')
  ok('SA clicks "Mark Redo" action button on Final Check ticket', Boolean(clickedMarkRedo))
  await sleep(600)
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input, textarea')].filter((el) => el.closest('[role="dialog"]')).pop()
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value')?.set
      setter?.call(inp, 'Live E2E QA redo test')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await sleep(300)
  await clickButtonByText(page, /Confirm|Mark redo|Submit/i, 'dialog')
  await sleep(2500)

  const { data: redoRows } = await admin.from('bookings').select('status, redo_reason').eq('id', qaBookingId)
  const failedQaVisible = await page.evaluate((plate) => {
    const bodyText = document.body.innerText
    return /FAILED QA/i.test(bodyText) && bodyText.includes(plate)
  }, QA_PLATE)
  ok('Live DB sets status=redo and vehicle appears in Failed QA section', redoRows?.[0]?.status === 'redo' && failedQaVisible)

  // Re-open from Failed QA lane -> return to Final Checking
  await page.evaluate((plate) => {
    const card = [...document.querySelectorAll('article, div')].find((el) => el.innerText.includes(plate) && el.querySelector('button') && el.innerText.length < 400)
    const openBtn = card ? [...card.querySelectorAll('button')].find((b) => /Open/i.test(b.innerText)) : null
    if (openBtn) openBtn.click()
  }, QA_PLATE)
  await sleep(1500)
  const returnedToFc = await clickButtonByText(page, /^Final Checking$/i, 'dialog')
  await sleep(2000)
  const { data: backToFcRows } = await admin.from('bookings').select('status').eq('id', qaBookingId)
  ok('Redo vehicle returns directly to Final Checking after correction', Boolean(returnedToFc) && backToFcRows?.[0]?.status === 'final_checking')

  // Send to payment
  const sentToPay = await clickButtonByText(page, /Send to payment/i, 'dialog')
  await sleep(2500)
  const { data: payRows } = await admin.from('bookings').select('status').eq('id', qaBookingId)
  const { data: handoffs1 } = await admin.from('pos_handoffs').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  const { data: tx1 } = await admin.from('transactions').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  ok('Live DB creates 1 pending pos_handoff & 1 pending_payment transaction on Send to payment', Boolean(sentToPay) && payRows?.[0]?.status === 'for_payment' && handoffs1?.length === 1 && handoffs1[0].status === 'pending' && tx1?.length === 1 && tx1[0].status === 'pending_payment')

  // ── 3. BRANCH ADMIN: POS Itemized Breakdown + Modify (re-syncs DB) + Return to Queue
  await demoSignIn(page, 'Branch Admin')
  await page.goto(`${BASE}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await sleep(3000)
  await dismissPopups(page)

  const clickedPosCard = await page.evaluate((plate) => {
    const btn = [...document.querySelectorAll('button, [role="button"]')].filter((e) => e.innerText.includes(plate)).sort((a, b) => a.innerText.length - b.innerText.length)[0]
    if (btn) { btn.click(); return true }
    return false
  }, QA_PLATE)
  await sleep(1500)
  const posText = await page.evaluate(() => document.body.innerText)
  ok('Branch Admin opens QATEST9 in POS with Itemized Breakdown, Modify, Return to Queue', clickedPosCard && /Itemized Breakdown/i.test(posText) && /\bModify\b/i.test(posText) && /Return to Queue/i.test(posText))

  // Click Modify -> change service to Premium Drip Wash -> Save changes
  await clickButtonByText(page, /^Modify$/i)
  await sleep(500)
  const selectedNewPosSvc = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Modify ticket service"]')
    if (!sel) return false
    const opt = [...sel.options].find((o) => /Premium Drip Wash/i.test(o.text))
    if (!opt) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, opt.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  ok('Branch Admin selects replacement service in POS Modify editor', selectedNewPosSvc)
  await sleep(300)
  await clickButtonByText(page, /^Save changes$/i)
  await sleep(2500)

  const { data: handoffsAfterMod } = await admin.from('pos_handoffs').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  const { data: txAfterMod } = await admin.from('transactions').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  const { data: bkAfterMod } = await admin.from('bookings').select('final_price_minor, services(name)').eq('id', qaBookingId)
  ok(
    'POS Modify updates booking, pos_handoffs.amount_minor, and transactions.amount_minor with 0 duplicates',
    bkAfterMod?.[0]?.services?.name === 'Premium Drip Wash' &&
      handoffsAfterMod?.length === 1 &&
      handoffsAfterMod[0].amount_minor === bkAfterMod[0].final_price_minor &&
      txAfterMod?.length === 1 &&
      txAfterMod[0].amount_minor === bkAfterMod[0].final_price_minor,
    `price=${bkAfterMod?.[0]?.final_price_minor}, handoff=${handoffsAfterMod?.[0]?.amount_minor}, txCount=${txAfterMod?.length}`,
  )

  // Click Return to Queue
  await clickButtonByText(page, /^Return to Queue$/i)
  await sleep(2500)
  const { data: bkReturned } = await admin.from('bookings').select('status').eq('id', qaBookingId)
  const { data: hReturned } = await admin.from('pos_handoffs').select('status').eq('booking_id', qaBookingId)
  const { data: tReturned } = await admin.from('transactions').select('status').eq('booking_id', qaBookingId)
  ok(
    'Return to Queue returns booking to in_progress and cancels pending handoff + tx cleanly',
    bkReturned?.[0]?.status === 'in_progress' && hReturned?.[0]?.status === 'cancelled' && tReturned?.[0]?.status === 'cancelled',
  )

  // ── 4. TEAM LEAD: Change service in Queue -> Final Checking -> Send to payment (0 duplicate transactions!)
  await demoSignIn(page, 'Team Lead')
  await page.goto(`${BASE}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await sleep(3000)
  await dismissPopups(page)

  await page.evaluate((plate) => {
    const card = [...document.querySelectorAll('article, div')].find((el) => el.innerText.includes(plate) && el.querySelector('button') && el.innerText.length < 400)
    const openBtn = card ? [...card.querySelectorAll('button')].find((b) => /Open/i.test(b.innerText)) : null
    if (openBtn) openBtn.click()
  }, QA_PLATE)
  await sleep(1500)

  const pickedTlSvc = await page.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Modify assigned service"]')
    if (!sel) return false
    const opt = [...sel.options].find((o) => /Express Package/i.test(o.text))
    if (!opt) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, opt.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  await sleep(300)
  await clickButtonByText(page, /^Change service$/i, 'dialog')
  await sleep(2000)

  // Final Checking -> Send to payment (Note: Team Lead doesn't push payment, SA/BA pushes payment or let's check!)
  await clickButtonByText(page, /^Final Checking$/i, 'dialog')
  await sleep(2000)

  // Switch to Branch Admin or SA to click Send to payment OR check TL permission
  const canTlSendPay = await clickButtonByText(page, /Send to payment/i, 'dialog')
  if (!canTlSendPay) {
    await demoSignIn(page, 'Super Admin')
    await page.goto(`${BASE}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(3000)
    await dismissPopups(page)
    await page.evaluate((plate) => {
      const card = [...document.querySelectorAll('article, div')].find((el) => el.innerText.includes(plate) && el.querySelector('button') && el.innerText.length < 400)
      const openBtn = card ? [...card.querySelectorAll('button')].find((b) => /Open/i.test(b.innerText)) : null
      if (openBtn) openBtn.click()
    }, QA_PLATE)
    await sleep(1500)
    await clickButtonByText(page, /Send to payment/i, 'dialog')
  }
  await sleep(2500)

  const { data: finalBk } = await admin.from('bookings').select('status, final_price_minor, services(name)').eq('id', qaBookingId)
  const { data: finalHandoffs } = await admin.from('pos_handoffs').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  const { data: finalTxs } = await admin.from('transactions').select('id, status, amount_minor').eq('booking_id', qaBookingId)
  ok(
    'Corrected order returns to POS (for_payment) with updated service & ZERO duplicate transactions or handoffs',
    pickedTlSvc &&
      finalBk?.[0]?.status === 'for_payment' &&
      finalBk[0].services?.name === 'Express Package' &&
      finalHandoffs?.length === 1 &&
      finalHandoffs[0].status === 'pending' &&
      finalHandoffs[0].amount_minor === finalBk[0].final_price_minor &&
      finalTxs?.length === 1 &&
      finalTxs[0].status === 'pending_payment' &&
      finalTxs[0].amount_minor === finalBk[0].final_price_minor,
    `svc=${finalBk?.[0]?.services?.name}, price=${finalBk?.[0]?.final_price_minor}, handoffs=${finalHandoffs?.length}, txs=${finalTxs?.length}`,
  )

  ok('Zero uncaught page errors during full live mutation E2E', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await cleanupQaData().catch((e) => console.error('Cleanup error:', e))
  if (seededAttendanceStaff) {
    // leave attendance untouched or clean only if needed
  }
  await browser.close()
}

const failed = checks.filter((c) => !c.pass)
console.log(`\nLive DB Mutation E2E: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
