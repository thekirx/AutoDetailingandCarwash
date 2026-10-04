import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeptemberPlan, SEED_TAG, SEPTEMBER_DAYS } from '../scripts/seed/september2026Plan.mjs'

const P = (small, medium, large, extra_large) => ({ small, medium, large, extra_large })
const svc = (id, name, prices) => ({ id, name, prices })
const CATALOG = {
  services: {
    'premium-car-wash': svc('s-wash', 'Premium Car Wash', P(29750, 35000, 42000, 49000)),
    'express-wash-package': svc('s-express', 'Express Wash Package', P(68000, 80000, 96000, 112000)),
    'hakum-custom-package': svc('s-custom', 'Hakum Custom Package', P(85000, 100000, 120000, 140000)),
    'full-care-package': svc('s-full', 'Full Care Package', P(382500, 450000, 540000, 630000)),
    'interior-detailing': svc('s-int', 'Interior Detailing', P(127500, 150000, 180000, 210000)),
    'full-exterior-detailing': svc('s-ext', 'Full Exterior Detailing', P(212500, 250000, 300000, 350000)),
    'glass-detailing': svc('s-glass', 'Glass Detailing', P(42500, 50000, 60000, 70000)),
    'engine-wash': svc('s-engine', 'Engine Wash', P(68000, 80000, 96000, 112000)),
    'paint-maintenance': svc('s-pm', 'Paint Maintenance', P(297500, 350000, 420000, 490000)),
    'nano-ceramic-tint': svc('s-tint', 'Nano Ceramic Tint', P(680000, 800000, 960000, 1120000)),
    'ceramic-coating': svc('s-cer', 'Ceramic Coating', P(1275000, 1500000, 1800000, 2100000)),
    'paint-protection-film': svc('s-ppf', 'Paint Protection Film', P(2125000, 2500000, 3000000, 3500000)),
  },
  products: [
    { id: 'p-fresh', name: 'Interior Freshener', price_minor: 35000 },
    { id: 'p-towel', name: 'Microfiber Towel Pack', price_minor: 45000 },
    { id: 'p-kit', name: 'Ceramic Top-Up Kit', price_minor: 150000 },
  ],
  accounts: { 10: 'a10', 12: 'a12', 13: 'a13', 16: 'a16', 19: 'a19' },
}
const STAFF = {
  sa: 'u-sa',
  asa: 'u-asa',
  bacoor: { ba: 'u-ba-b', tl: 'u-tl-b', crew: ['u-c1', 'u-c2', 'u-c3'], detailer: 'u-det-b' },
  batangas: { ba: 'u-ba-t', tl: 'u-tl-t', crew: ['u-c4', 'u-c5'], detailer: 'u-det-t' },
}

const plan = buildSeptemberPlan({ catalog: CATALOG, staff: STAFF })
const manilaDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const manilaHour = (iso) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)))
const WASH_SLUGS = new Set(['s-wash', 's-express', 's-custom', 's-full', 's-int', 's-ext'])

test('september plan: same input → same plan', () => {
  const again = buildSeptemberPlan({ catalog: CATALOG, staff: STAFF })
  assert.deepEqual(again.expected, plan.expected)
  assert.equal(again.bookings[100].id, plan.bookings[100].id)
})

test('september plan: walk-in car volume per branch-day is realistic', () => {
  assert.equal(SEPTEMBER_DAYS.length, 30)
  const perDay = new Map()
  for (const b of plan.bookings) {
    if (!WASH_SLUGS.has(b.service_id)) continue
    const key = `${b.branch}|${manilaDate(b.waiting_at)}`
    perDay.set(key, (perDay.get(key) || 0) + 1)
  }
  for (const date of SEPTEMBER_DAYS) {
    const walkIns = (branch) => perDay.get(`${branch}|${date}`) || 0
    assert.ok(walkIns('bacoor') >= 20 && walkIns('bacoor') <= 30, `bacoor ${date}: ${walkIns('bacoor')}`)
    assert.ok(walkIns('batangas') >= 12 && walkIns('batangas') <= 20, `batangas ${date}: ${walkIns('batangas')}`)
  }
  assert.ok(plan.expected.completedCars >= 1100 && plan.expected.completedCars <= 1500, `completed ${plan.expected.completedCars}`)
})

test('september plan: every completed car has one sale; cancelled and no-show have none', () => {
  const salesByBooking = new Map()
  for (const s of plan.sales) if (s.booking_id) salesByBooking.set(s.booking_id, (salesByBooking.get(s.booking_id) || 0) + 1)
  for (const b of plan.bookings) {
    if (b.status === 'completed') assert.equal(salesByBooking.get(b.id), 1, `completed ${b.id}`)
    else assert.equal(salesByBooking.get(b.id), undefined, `${b.status} ${b.id} has a sale`)
  }
  assert.ok(plan.bookings.every((b) => ['completed', 'cancelled', 'no_show'].includes(b.status)), 'September ends with no live queue')
})

test('september plan: sale totals = line items − discount, and discounts carry a reason', () => {
  const lines = new Map()
  for (const l of plan.saleLines) lines.set(l.sale_id, [...(lines.get(l.sale_id) || []), l])
  for (const s of plan.sales) {
    const items = lines.get(s.id) || []
    assert.ok(items.length > 0, `sale ${s.id} has no lines`)
    for (const l of items) assert.equal(l.line_total_minor, l.unit_price_minor * l.quantity)
    const sum = items.reduce((t, l) => t + l.line_total_minor, 0)
    assert.equal(s.subtotal_minor, sum)
    assert.equal(s.total_minor, sum - s.discount_minor)
    if (s.discount_minor > 0) assert.ok(s.discount_reason, `discount without reason ${s.id}`)
    for (const l of items) assert.ok(l.item_type === 'service' ? l.service_id : l.product_id)
  }
})

test('september plan: queue timeline is ordered, in shop hours, and matches the events', () => {
  const saleOf = new Map(plan.sales.map((s) => [s.booking_id, s]))
  const eventsOf = new Map()
  for (const e of plan.queueEvents) eventsOf.set(e.booking_id, [...(eventsOf.get(e.booking_id) || []), e])
  for (const b of plan.bookings.filter((x) => x.status === 'completed')) {
    const chain = [b.waiting_at, b.in_progress_at, b.final_checking_at, b.for_payment_at, b.completed_at].map(Date.parse)
    for (let i = 1; i < chain.length; i += 1) assert.ok(chain[i] >= chain[i - 1], `out of order ${b.id}`)
    assert.ok(manilaHour(b.waiting_at) >= 8 && manilaHour(b.completed_at) < 23, `hours ${b.id}`)
    assert.equal(saleOf.get(b.id).occurred_at, b.completed_at)
    const ev = eventsOf.get(b.id)
    assert.equal(ev.at(-1).new_status, 'completed')
    assert.equal(ev[0].old_status, 'waiting')
    for (let i = 1; i < ev.length; i += 1) assert.equal(ev[i].old_status, ev[i - 1].new_status)
  }
})

test('september plan: the full status mix is present', () => {
  const e = plan.expected
  assert.ok(e.cancelled > 0 && plan.bookings.filter((b) => b.status === 'cancelled').every((b) => b.cancellation_reason && b.cancelled_at))
  assert.ok(e.noShow > 0)
  const redo = plan.bookings.filter((b) => b.redo_at)
  assert.ok(redo.length > 0 && redo.every((b) => b.redo_reason && b.redo_by && b.redo_staff_ids?.length))
  assert.ok(plan.queueEvents.some((ev) => ev.new_status === 'redo'))
  assert.ok(plan.queueEvents.some((ev) => ev.new_status === 'for_releasing'), 'detailing goes through releasing')
  for (const status of ['refunded', 'voided']) assert.ok(plan.sales.some((s) => s.status === status), status)
  for (const m of ['cash', 'gcash', 'card']) assert.ok(plan.sales.some((s) => s.payment_method === m), m)
  assert.ok(plan.sales.some((s) => !s.booking_id), 'counter product sales')
  assert.ok(plan.bookings.some((b) => manilaDate(b.in_progress_at || b.waiting_at) !== manilaDate(b.completed_at || b.waiting_at)), 'multi-day detailing')
})

test('september plan: every row is tagged and wipeable', () => {
  for (const b of plan.bookings) {
    assert.equal(b.queue_date, manilaDate(b.created_at), 'queue_date column defaults to today — must be set')
    if (!WASH_SLUGS.has(b.service_id) && b.status === 'completed') assert.ok(b.queue_number > 900, 'detailing must not consume the live persistent counter')
    assert.ok(b.notes.startsWith(SEED_TAG))
    assert.match(b.vehicle_plate, /^ZZ[BT]\d{4}$/)
    assert.match(b.customer_phone, /^0955500\d{4}$/)
  }
  for (const s of plan.sales) assert.ok(s.notes.startsWith(SEED_TAG))
  for (const c of plan.customers) {
    assert.match(c.email, /^seed\d+@sep2026\.hakum\.test$/)
    assert.equal(c.notify_sms, false)
    assert.equal(c.date_of_birth ?? null, null)
  }
  for (const r of [...plan.attendance, ...plan.maintenance, ...plan.bills, ...plan.vehicles]) assert.ok(String(r.notes ?? r.description).startsWith(SEED_TAG))
  for (const v of plan.vehicles) assert.match(v.plate_number, /^ZZ[BT]\d{4}$/)
})

test('september plan: crew only work on days they clocked in', () => {
  const onDuty = new Set(plan.attendance.filter((a) => a.status !== 'absent').map((a) => `${a.staff_id}|${a.attendance_date}`))
  for (const a of plan.assignments) {
    const day = manilaDate(a.started_at)
    assert.ok(onDuty.has(`${a.staff_id}|${day}`), `${a.staff_id} worked ${day} without attendance`)
  }
})

test('september plan: one daily sheet per branch-day with approvals, returns, a reopen and drawer notes', () => {
  assert.equal(plan.sheets.length, 60)
  const outcomes = new Set(plan.sheets.map((s) => s.outcome))
  for (const o of ['approve', 'return_then_approve', 'reopen_then_approve', 'returned', 'submitted']) assert.ok(outcomes.has(o), o)
  assert.ok(plan.sheets.some((s) => s.reviewer === 'asa') && plan.sheets.some((s) => s.reviewer === 'sa'))
  const offDays = plan.sheets.filter((s) => s.overShortMinor !== 0)
  assert.ok(offDays.length >= 4 && offDays.every((s) => s.notes?.trim()))
  for (const s of plan.sheets) {
    assert.ok(s.expenseLines.every((l) => l.account_id && l.description && l.amount_minor > 0))
    if (['return_then_approve', 'returned'].includes(s.outcome)) assert.ok(s.returnNote)
    if (s.outcome === 'reopen_then_approve') assert.ok(s.reopenNote && s.expenseLines.some((l) => l.wrong_account_id))
  }
  assert.ok(Object.values(plan.salaryOverrides).every((o) => o.amount_minor > 0 && o.reason))
})

test('september plan: maintenance enrolls September installs and shows due, overdue and reset plates', () => {
  const installs = plan.bookings.filter((b) => b.status === 'completed' && ['s-cer', 's-ppf'].includes(b.service_id))
  assert.ok(installs.length > 0)
  for (const b of installs) {
    const row = plan.maintenance.find((m) => m.booking_id === b.id)
    assert.ok(row, `install ${b.id} not enrolled`)
    assert.equal(row.coated_at, manilaDate(b.completed_at))
    assert.equal(row.next_due_at.slice(5, 7), String(Number(row.coated_at.slice(5, 7)) + 6 - 12).padStart(2, '0'))
  }
  const today = '2026-10-04'
  assert.ok(plan.maintenance.some((m) => m.status === 'notified' && m.next_due_at < today))
  assert.ok(plan.maintenance.some((m) => m.status === 'scheduled' && m.next_due_at < today))
  assert.ok(plan.maintenance.some((m) => m.status === 'cancelled'))
  const resets = plan.maintenance.filter((m) => m.last_maintenance_at)
  assert.ok(resets.length > 0)
  for (const m of resets) {
    assert.ok(plan.bookings.some((b) => b.status === 'completed' && b.service_id === 's-pm' && b.vehicle_plate === m.plate_number && manilaDate(b.completed_at) === m.last_maintenance_at))
  }
  const active = plan.maintenance.filter((m) => ['scheduled', 'notified'].includes(m.status)).map((m) => m.plate_normalized)
  assert.equal(new Set(active).size, active.length, 'one active schedule per plate')
})
