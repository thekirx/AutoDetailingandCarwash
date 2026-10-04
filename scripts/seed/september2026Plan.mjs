/**
 * September 2026 test data for Bacoor + Batangas — a pure, deterministic plan (rows in final state, no I/O).
 * scripts/seed-september-2026.mjs inserts it; scripts/seed/wipe-september-2026.sql removes it.
 * Every row is tagged: notes/description start with SEED_TAG, plates ZZB/ZZT####, phones 0955500####,
 * emails seedN@sep2026.hakum.test, customers have notify_sms=false and no birthday (no cron or SMS can reach them).
 */
import { addMonthsDateOnly, normalizeMaintPlate } from '../../src/lib/paintMaintenance.js'

export const SEED_TAG = '[seed:sep2026]'
export const SEED_BRANCHES = Object.freeze(['bacoor', 'batangas'])
export const SEPTEMBER_DAYS = Object.freeze(Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`))

const VOLUME = { bacoor: { weekday: [20, 26], weekend: [25, 30] }, batangas: { weekday: [12, 16], weekend: [16, 20] } }
const DETAILING_CHANCE = { bacoor: 0.55, batangas: 0.35 }
const LETTER = { bacoor: 'B', batangas: 'T' }
const OPENING_FLOAT_MINOR = 200000

const WASH_MIX = [
  ['premium-car-wash', 55],
  ['express-wash-package', 18],
  ['hakum-custom-package', 12],
  ['full-care-package', 7],
  ['interior-detailing', 5],
  ['full-exterior-detailing', 3],
]
const WORK_MINUTES = {
  'premium-car-wash': [30, 50],
  'express-wash-package': [50, 80],
  'hakum-custom-package': [80, 110],
  'full-care-package': [180, 240],
  'interior-detailing': [120, 170],
  'full-exterior-detailing': [150, 200],
}
const LONG_JOBS = new Set(['full-care-package', 'interior-detailing', 'full-exterior-detailing'])

const FIRST = ['Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'Paolo', 'Angelica', 'Carlo', 'Patricia', 'Miguel', 'Camille', 'Rafael', 'Bea', 'Joshua', 'Nicole', 'Gabriel', 'Andrea', 'Kevin', 'Joanna', 'Ramon', 'Liza', 'Enzo', 'Trisha']
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Villanueva', 'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Dela Cruz', 'Flores', 'Gonzales', 'Lim', 'Tan', 'Mercado', 'Domingo', 'Pascual']
const CARS = [
  ['Toyota', 'Vios', 'small'], ['Toyota', 'Wigo', 'small'], ['Honda', 'City', 'small'], ['Mitsubishi', 'Mirage G4', 'small'], ['Suzuki', 'Dzire', 'small'],
  ['Toyota', 'Raize', 'medium'], ['Honda', 'HR-V', 'medium'], ['Mitsubishi', 'Xpander', 'medium'], ['Nissan', 'Kicks', 'medium'], ['Geely', 'Coolray', 'medium'],
  ['Toyota', 'Innova', 'large'], ['Toyota', 'Fortuner', 'large'], ['Ford', 'Ranger', 'large'], ['Mitsubishi', 'Montero Sport', 'large'], ['Toyota', 'Hilux', 'large'], ['Nissan', 'Navara', 'large'],
  ['Toyota', 'Hiace', 'extra_large'], ['Nissan', 'Urvan', 'extra_large'], ['Hyundai', 'Staria', 'extra_large'], ['Ford', 'Expedition', 'extra_large'],
]
const CANCEL_REASONS = ['Customer left — wait was too long', 'Customer changed their mind', 'Wrong service picked — rebooked as detailing', 'Customer had an emergency']
const REDO_REASONS = ['Water spots left on the glass', 'Wheel wells missed', 'Interior vacuum not finished', 'Streaks on the side mirrors']
const DISCOUNT_REASONS = ['Loyalty 10%', 'Senior citizen discount', 'Fleet account rate', 'First visit promo']

function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Manila wall-clock minutes after midnight → ISO (UTC). */
export const manilaAt = (date, minutes) => new Date(Date.parse(`${date}T00:00:00+08:00`) + minutes * 60000).toISOString()
const manilaDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const plusMonths = (date, n) => addMonthsDateOnly(`${date}T12:00:00+08:00`, n)
const isWeekend = (date) => [0, 6].includes(new Date(`${date}T12:00:00+08:00`).getUTCDay())
const pesos = (minor) => `₱${(minor / 100).toLocaleString('en-PH')}`

export function buildSeptemberPlan({ catalog, staff, seed = 20260901 } = {}) {
  const rand = mulberry32(seed)
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1))
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const chance = (p) => rand() < p
  const weighted = (pairs) => {
    let x = rand() * pairs.reduce((s, [, w]) => s + w, 0)
    for (const [v, w] of pairs) if ((x -= w) < 0) return v
    return pairs.at(-1)[0]
  }
  const id = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16))
    h[12] = '4'
    h[16] = '89ab'[Math.floor(rand() * 4)]
    const s = h.join('')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
  }
  const tag = (text) => `${SEED_TAG} ${text}`
  const S = catalog.services
  const A = catalog.accounts

  const out = {
    customers: [],
    vehicles: [],
    bookings: [],
    queueEvents: [],
    assignments: [],
    sales: [],
    saleLines: [],
    attendance: [],
    maintenance: [],
    bills: [],
    sheets: [],
    salaryOverrides: {},
  }
  const pools = { bacoor: [], batangas: [] }
  const plateSeq = { bacoor: 0, batangas: 0 }
  let customerSeq = 0

  function newCustomer(branch, createdAt, sizeHint) {
    customerSeq += 1
    const first = pick(FIRST)
    const last = pick(LAST)
    const options = sizeHint ? CARS.filter((c) => c[2] === sizeHint) : CARS
    const [make, model, size] = pick(options)
    plateSeq[branch] += 1
    const customer = {
      id: id(),
      role: 'customer',
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      email: `seed${customerSeq}@sep2026.hakum.test`,
      phone: `0955500${String(customerSeq).padStart(4, '0')}`,
      notify_sms: false,
      notify_push: false,
      date_of_birth: null,
      created_at: createdAt,
    }
    const entry = { customer, branch, lastDate: null, car: { plate: `ZZ${LETTER[branch]}${String(plateSeq[branch]).padStart(4, '0')}`, make, model, size, year: int(2015, 2025) } }
    out.customers.push(customer)
    pools[branch].push(entry)
    return entry
  }

  function walkInCustomer(branch, date, createdAt) {
    const returning = pools[branch].filter((e) => !e.coated && e.lastDate !== date)
    const entry = returning.length > 10 && chance(0.3) ? pick(returning) : newCustomer(branch, createdAt)
    entry.lastDate = date
    return entry
  }

  function bookingRow({ branch, entry, slug, status, createdAt, createdBy, teamLead, note, extra = {} }) {
    const svc = S[slug]
    const price = svc.prices[entry.car.size]
    const c = entry.customer
    return {
      id: id(),
      branch,
      customer_id: c.id,
      service_id: svc.id,
      customer_name: c.full_name,
      customer_email: c.email,
      customer_phone: c.phone,
      vehicle_make: entry.car.make,
      vehicle_model: entry.car.model,
      vehicle_year: entry.car.year,
      vehicle_plate: entry.car.plate,
      vehicle_type: entry.car.size,
      scheduled_start: createdAt,
      queue_date: manilaDay(createdAt),
      status,
      notes: tag(note),
      created_at: createdAt,
      created_by: createdBy,
      team_lead_id: teamLead,
      price_minor: price,
      final_price_minor: price,
      ...extra,
    }
  }

  const event = (b, oldStatus, newStatus, by, at, notes = null) =>
    out.queueEvents.push({ id: id(), booking_id: b.id, branch: b.branch, old_status: oldStatus, new_status: newStatus, changed_by: by, notes, created_at: at })

  function paymentFor(slug) {
    const method = ['ceramic-coating', 'paint-protection-film', 'nano-ceramic-tint'].includes(slug)
      ? weighted([['card', 40], ['gcash', 40], ['cash', 20]])
      : weighted([['cash', 55], ['gcash', 35], ['card', 10]])
    const ref = method === 'gcash' ? `GC${String(int(10000000, 99999999))}` : method === 'card' ? `CARD-${int(1000, 9999)}` : null
    return { method, ref }
  }

  function addSale({ branch, booking = null, customerId = null, items, at, recordedBy, discountReason = null, note }) {
    const saleId = id()
    let subtotal = 0
    for (const it of items) {
      const line = {
        id: id(),
        sale_id: saleId,
        item_type: it.type,
        service_id: it.type === 'service' ? it.id : null,
        product_id: it.type === 'product' ? it.id : null,
        name: it.name,
        quantity: it.qty || 1,
        unit_price_minor: it.price,
        line_total_minor: it.price * (it.qty || 1),
        created_at: at,
      }
      subtotal += line.line_total_minor
      out.saleLines.push(line)
    }
    const discount = discountReason ? Math.round((subtotal * 0.1) / 100) * 100 : 0
    const pay = paymentFor(booking ? Object.keys(S).find((k) => S[k].id === booking.service_id) : null)
    const sale = {
      id: saleId,
      branch,
      customer_id: customerId,
      booking_id: booking?.id || null,
      status: 'paid',
      payment_method: pay.method,
      payment_ref: pay.ref,
      subtotal_minor: subtotal,
      discount_minor: discount,
      discount_reason: discountReason,
      total_minor: subtotal - discount,
      currency: 'PHP',
      notes: tag(note),
      recorded_by: recordedBy,
      occurred_at: at,
      created_at: at,
    }
    out.sales.push(sale)
    return sale
  }

  function assign(booking, staffId, by, start, end) {
    out.assignments.push({
      id: id(),
      booking_id: booking.id,
      staff_id: staffId,
      assigned_by: by,
      task_name: 'Queue service',
      status: 'released',
      started_at: start,
      completed_at: end,
      released_at: end,
      created_at: start,
    })
  }

  // ── Maintenance background: coated in March, due in September ─────────────
  const maintenanceVisits = { bacoor: [], batangas: [] }
  for (const branch of SEED_BRANCHES) {
    const days = [3, 5, 6, 9, 11, 13, 16, 18, 20, 23]
    days.forEach((d, i) => {
      const coatedAt = `2026-03-${String(d).padStart(2, '0')}`
      const entry = newCustomer(branch, manilaAt(coatedAt, 9 * 60))
      entry.coated = true
      out.vehicles.push({
        customer_id: entry.customer.id,
        plate_number: entry.car.plate,
        normalized_plate_number: normalizeMaintPlate(entry.car.plate),
        vehicle_make: entry.car.make,
        vehicle_model: entry.car.model,
        vehicle_year: entry.car.year,
        vehicle_type: entry.car.size,
        first_branch: branch,
        last_branch: branch,
        notes: tag('Coated in March (no September booking)'),
        created_at: manilaAt(coatedAt, 9 * 60),
      })
      const slug = i % 2 ? 'paint-protection-film' : 'ceramic-coating'
      const row = {
        id: id(),
        customer_id: entry.customer.id,
        booking_id: null,
        service_slug: slug,
        program_key: 'paint_maintenance',
        plate_number: entry.car.plate,
        plate_normalized: normalizeMaintPlate(entry.car.plate),
        customer_phone: entry.customer.phone,
        customer_name: entry.customer.full_name,
        coated_at: coatedAt,
        last_maintenance_at: null,
        next_due_at: plusMonths(coatedAt, 6),
        branch_slug: branch,
        status: 'scheduled',
        last_notified_at: null,
        notes: tag('Coated in March — due for paint maintenance in September'),
      }
      if (i < 4) maintenanceVisits[branch].push({ entry, row, date: `2026-09-${String(Math.min(30, d + int(0, 3))).padStart(2, '0')}` })
      else if (i < 7) Object.assign(row, { status: 'notified', last_notified_at: manilaAt(`2026-09-${String(Math.max(1, d - 7)).padStart(2, '0')}`, 10 * 60) })
      else if (i === 9) Object.assign(row, { status: 'cancelled', notes: tag('Customer sold the car — removed from reminders') })
      out.maintenance.push(row)
    })
  }

  // ── Detailing jobs (multi-day ceramic/PPF), placed before attendance ─────
  const detailingJobs = { bacoor: [], batangas: [] }
  for (const branch of SEED_BRANCHES) {
    for (const v of maintenanceVisits[branch]) detailingJobs[branch].push({ start: v.date, end: v.date, slug: 'paint-maintenance', visit: v })
    for (const date of SEPTEMBER_DAYS) {
      if (detailingJobs[branch].some((j) => j.start === date) || !chance(DETAILING_CHANCE[branch])) continue
      const slug = weighted([['nano-ceramic-tint', 35], ['ceramic-coating', 40], ['paint-protection-film', 25]])
      const multi = slug !== 'nano-ceramic-tint' && date !== SEPTEMBER_DAYS.at(-1)
      const end = multi ? SEPTEMBER_DAYS[SEPTEMBER_DAYS.indexOf(date) + 1] : date
      detailingJobs[branch].push({ start: date, end, slug })
    }
  }

  // ── Day by day ───────────────────────────────────────────────────────────
  const counts = { completedCars: 0, cancelled: 0, noShow: 0, redo: 0 }
  // ponytail: explicit 901+ numbers so seed detailing never advances the live persistent counter
  const detailingSeq = { bacoor: 0, batangas: 0 }
  for (const branch of SEED_BRANCHES) {
    const team = staff[branch]
    out.salaryOverrides[team.tl] = { amount_minor: 80000, reason: 'Team Lead day rate (₱800)' }
    out.salaryOverrides[team.detailer] = { amount_minor: 70000, reason: 'Detailer day rate (₱700) — no detailing share today', onlyIfBelow: true }

    for (const date of SEPTEMBER_DAYS) {
      const detailingToday = detailingJobs[branch].some((j) => j.start <= date && j.end >= date)
      const onDuty = []
      const clockIn = (staffId, status) => {
        const inMin = status === 'late' ? int(8 * 60 + 10, 8 * 60 + 50) : int(7 * 60 + 30, 7 * 60 + 59)
        out.attendance.push({
          id: id(),
          staff_id: staffId,
          branch_slug: branch,
          attendance_date: date,
          status,
          checked_in_at: status === 'absent' ? null : manilaAt(date, inMin),
          checked_out_at: status === 'absent' ? null : manilaAt(date, int(19 * 60 + 30, 20 * 60 + 30)),
          marked_by: team.ba,
          source: 'manual',
          notes: tag(status === 'absent' ? 'Absent' : 'Clock-in'),
        })
      }
      for (const crewId of team.crew) {
        const status = weighted([['present', 85], ['late', 10], ['absent', 5]])
        clockIn(crewId, status)
        if (status !== 'absent') onDuty.push(crewId)
      }
      if (!onDuty.length) {
        const fixed = out.attendance.findLast((a) => a.staff_id === team.crew[0] && a.attendance_date === date)
        Object.assign(fixed, { status: 'present', checked_in_at: manilaAt(date, 7 * 60 + 45), checked_out_at: manilaAt(date, 20 * 60), notes: tag('Clock-in') })
        onDuty.push(team.crew[0])
      }
      clockIn(team.tl, chance(0.05) ? 'late' : 'present')
      clockIn(team.detailer, detailingToday || chance(0.7) ? 'present' : 'absent')

      // Walk-in wash queue
      const [lo, hi] = VOLUME[branch][isWeekend(date) ? 'weekend' : 'weekday']
      const arrivals = Array.from({ length: int(lo, hi) }, () => int(8 * 60, 17 * 60 + 30)).sort((a, b) => a - b)
      for (const arrive of arrivals) {
        let slug = weighted(WASH_MIX)
        if (LONG_JOBS.has(slug) && arrive > 14 * 60) slug = 'premium-car-wash'
        const waitingAt = manilaAt(date, arrive)
        const entry = walkInCustomer(branch, date, waitingAt)
        const roll = rand()
        if (roll < 0.05) {
          const cancelledAt = manilaAt(date, arrive + int(10, 40))
          const reason = pick(CANCEL_REASONS)
          const b = bookingRow({ branch, entry, slug, status: 'cancelled', createdAt: waitingAt, createdBy: team.tl, teamLead: team.tl, note: 'Walk-in (cancelled)', extra: { waiting_at: waitingAt, cancelled_at: cancelledAt, cancellation_reason: reason, final_price_minor: null } })
          out.bookings.push(b)
          event(b, 'waiting', 'cancelled', team.tl, cancelledAt, reason)
          counts.cancelled += 1
          continue
        }
        const redo = roll < 0.08
        const crew = onDuty.length > 1 && chance(0.4) ? [pick(onDuty), pick(onDuty)].filter((v, i, a) => a.indexOf(v) === i) : [pick(onDuty)]
        let t = arrive + int(5, 35)
        const inProgress = t
        t += int(...WORK_MINUTES[slug])
        const firstCheck = t
        let redoAt = null
        let redoStart = null
        if (redo) {
          redoAt = t + int(3, 8)
          redoStart = redoAt + int(2, 5)
          t = redoStart + int(15, 30)
        }
        const finalCheck = t
        const forPayment = finalCheck + int(5, 12)
        const completed = forPayment + int(3, 10)
        const at = (m) => manilaAt(date, m)
        const reason = redo ? pick(REDO_REASONS) : null
        const b = bookingRow({
          branch,
          entry,
          slug,
          status: 'completed',
          createdAt: waitingAt,
          createdBy: team.tl,
          teamLead: team.tl,
          note: redo ? 'Walk-in (failed QA, redone)' : 'Walk-in',
          extra: {
            assigned_staff_id: crew[0],
            waiting_at: waitingAt,
            in_progress_at: at(inProgress),
            actual_start: at(inProgress),
            final_checking_at: at(finalCheck),
            for_payment_at: at(forPayment),
            sent_to_payment_at: at(forPayment),
            actual_end: at(forPayment),
            completed_at: at(completed),
            final_checked_by: team.tl,
            sent_to_payment_by: team.tl,
            completion_outcome: redo ? 'complaints_addressed' : chance(0.01) ? 'unhappy' : 'no_issues',
            ...(redo ? { redo_at: at(redoAt), redo_by: team.tl, redo_reason: reason, redo_staff_ids: crew } : {}),
          },
        })
        out.bookings.push(b)
        event(b, 'waiting', 'in_progress', team.tl, at(inProgress))
        event(b, 'in_progress', 'final_checking', team.tl, at(firstCheck))
        if (redo) {
          event(b, 'final_checking', 'redo', team.tl, at(redoAt), reason)
          event(b, 'redo', 'in_progress', team.tl, at(redoStart))
          event(b, 'in_progress', 'final_checking', team.tl, at(finalCheck))
          counts.redo += 1
        }
        event(b, 'final_checking', 'for_payment', team.tl, at(forPayment))
        event(b, 'for_payment', 'completed', team.ba, at(completed))
        for (const s of crew) assign(b, s, team.tl, at(inProgress), at(forPayment))
        const items = [{ type: 'service', id: S[slug].id, name: S[slug].name, price: b.price_minor }]
        if (chance(0.15)) {
          const addon = S[pick(['glass-detailing', 'engine-wash'])]
          items.push({ type: 'service', id: addon.id, name: addon.name, price: addon.prices[entry.car.size] })
        }
        const discountReason = redo && chance(0.5) ? 'Service recovery — redo' : chance(0.08) ? pick(DISCOUNT_REASONS) : null
        addSale({ branch, booking: b, customerId: entry.customer.id, items, at: b.completed_at, recordedBy: team.ba, discountReason, note: 'Queue sale' })
        counts.completedCars += 1
      }

      // Detailing job that starts today
      const job = detailingJobs[branch].find((j) => j.start === date)
      if (job) {
        const entry = job.visit ? job.visit.entry : newCustomer(branch, manilaAt(date, 9 * 60), job.slug === 'nano-ceramic-tint' ? null : pick(['medium', 'large']))
        const arrive = int(9 * 60, 10 * 60 + 30)
        const inProgress = arrive + int(20, 40)
        const work = job.slug === 'paint-maintenance' ? int(180, 240) : int(240, 300)
        const finalAt = job.end === date ? manilaAt(date, inProgress + work) : manilaAt(job.end, int(11 * 60, 14 * 60))
        const releasingAt = new Date(Date.parse(finalAt) + int(15, 30) * 60000).toISOString()
        const payAt = new Date(Date.parse(releasingAt) + int(30, 60) * 60000).toISOString()
        const doneAt = new Date(Date.parse(payAt) + int(10, 20) * 60000).toISOString()
        const waitingAt = manilaAt(date, arrive)
        const b = bookingRow({
          branch,
          entry,
          slug: job.slug,
          status: 'completed',
          createdAt: waitingAt,
          createdBy: team.tl,
          teamLead: team.tl,
          note: job.end === date ? 'Detailing drop-off' : 'Detailing drop-off (2-day job)',
          extra: {
            queue_number: 900 + (detailingSeq[branch] += 1),
            assigned_staff_id: team.detailer,
            waiting_at: waitingAt,
            in_progress_at: manilaAt(date, inProgress),
            actual_start: manilaAt(date, inProgress),
            final_checking_at: finalAt,
            for_payment_at: payAt,
            sent_to_payment_at: payAt,
            actual_end: payAt,
            completed_at: doneAt,
            final_checked_by: team.tl,
            sent_to_payment_by: team.tl,
            completion_outcome: 'no_issues',
          },
        })
        out.bookings.push(b)
        event(b, 'waiting', 'in_progress', team.tl, b.in_progress_at)
        event(b, 'in_progress', 'final_checking', team.tl, finalAt)
        event(b, 'final_checking', 'for_releasing', team.tl, releasingAt)
        event(b, 'for_releasing', 'for_payment', team.tl, payAt)
        event(b, 'for_payment', 'completed', team.ba, doneAt)
        assign(b, team.detailer, team.tl, b.in_progress_at, payAt)
        if (job.slug !== 'paint-maintenance' && job.slug !== 'nano-ceramic-tint') assign(b, pick(onDuty), team.tl, b.in_progress_at, payAt)
        addSale({ branch, booking: b, customerId: entry.customer.id, items: [{ type: 'service', id: S[job.slug].id, name: S[job.slug].name, price: b.price_minor }], at: doneAt, recordedBy: team.ba, note: 'Detailing sale' })
        counts.completedCars += 1
        const doneDay = manilaDay(doneAt)
        if (job.visit) {
          Object.assign(job.visit.row, { last_maintenance_at: doneDay, next_due_at: plusMonths(doneDay, 6), status: 'scheduled', notes: tag('Came back for paint maintenance — clock reset') })
        } else if (job.slug !== 'nano-ceramic-tint') {
          entry.coated = true
          out.maintenance.push({
            id: id(),
            customer_id: entry.customer.id,
            booking_id: b.id,
            service_slug: job.slug,
            program_key: 'paint_maintenance',
            plate_number: entry.car.plate,
            plate_normalized: normalizeMaintPlate(entry.car.plate),
            customer_phone: entry.customer.phone,
            customer_name: entry.customer.full_name,
            coated_at: doneDay,
            last_maintenance_at: null,
            next_due_at: plusMonths(doneDay, 6),
            branch_slug: branch,
            status: 'scheduled',
            last_notified_at: null,
            notes: tag('Enrolled from September install'),
          })
        }
      }

      // Online booking that never showed up
      if (chance(branch === 'bacoor' ? 0.4 : 0.25)) {
        const createdAt = manilaAt(date, int(6 * 60 + 30, 7 * 60 + 45))
        const slot = int(10, 15) * 60
        const entry = walkInCustomer(branch, date, createdAt)
        const b = bookingRow({ branch, entry, slug: 'premium-car-wash', status: 'no_show', createdAt, createdBy: team.ba, teamLead: null, note: 'Online booking (no-show)', extra: { scheduled_start: manilaAt(date, slot), scheduled_end: manilaAt(date, slot + 60), final_price_minor: null } })
        out.bookings.push(b)
        event(b, 'confirmed', 'no_show', team.ba, manilaAt(date, slot + 60), 'Did not arrive within an hour of the slot')
        counts.noShow += 1
      }

      // Counter product sales (no ticket)
      const counter = int(1, 4)
      for (let i = 0; i < counter; i += 1) {
        const p = pick(catalog.products)
        const qty = chance(0.2) ? 2 : 1
        const sale = addSale({ branch, items: [{ type: 'product', id: p.id, name: p.name, price: p.price_minor, qty }], at: manilaAt(date, int(9 * 60, 18 * 60)), recordedBy: team.ba, note: 'Counter sale' })
        if (i === 0 && ['07', '16', '25'].includes(date.slice(8))) Object.assign(sale, { status: 'voided', notes: tag('Counter sale — voided, wrong item rung up') })
      }

      out.sheets.push(sheetPlan(branch, date, onDuty))
    }
  }

  // A few refunds per branch (still counted in gross, excluded from net)
  for (const branch of SEED_BRANCHES) {
    const queueSales = out.sales.filter((s) => s.branch === branch && s.booking_id && s.status === 'paid')
    for (const k of [97, 251, 433]) {
      const s = queueSales[k % queueSales.length]
      Object.assign(s, { status: 'refunded', notes: tag('Queue sale — refunded, customer complaint') })
    }
  }

  // Bills (outside the daily sheet): rent paid, electricity still unpaid
  const RENT = { bacoor: 4500000, batangas: 3000000 }
  const POWER = { bacoor: 1285000, batangas: 840000 }
  for (const branch of SEED_BRANCHES) {
    const bill = (title, minor, status, dueDate, createdDate, ref) => ({
      id: id(),
      title,
      description: tag(title),
      quantity: 1,
      unit_cost_minor: minor,
      total_minor: minor,
      branch,
      category_id: A[19],
      status,
      expense_kind: 'monthly',
      bill_reference: `${ref}-2026-09-${LETTER[branch]}`,
      due_date: dueDate,
      created_by: staff.sa,
      approved_by: staff.sa,
      paid_by: status === 'paid' ? staff.sa : null,
      created_at: manilaAt(createdDate, 10 * 60),
    })
    out.bills.push(bill('Rent — September 2026', RENT[branch], 'paid', '2026-09-05', '2026-09-01', 'RENT'))
    out.bills.push(bill('Electricity — September 2026', POWER[branch], 'approved', '2026-10-05', '2026-09-28', 'POWER'))
  }

  function sheetPlan(branch, date, onDuty) {
    const day = Number(date.slice(8))
    const team = staff[branch]
    const lines = []
    const line = (code, description, lo, hi) => lines.push({ account_id: A[code], description, amount_minor: int(lo / 500, hi / 500) * 500 })
    line(10, pick(['Crew lunch', 'Crew merienda', 'Lunch for crew and TL']), 15000, 45000)
    if (day % 4 === 1 || (branch === 'bacoor' && day === 12)) line(12, pick(['Car shampoo refill', 'Tire black and dressing', 'Microfiber towels']), 90000, 350000)
    if (day % 3 === 0) line(13, pick(['Drinking water for customers', 'Coffee and cups for lounge']), 25000, 60000)
    if (day % 7 === 2) line(19, pick(['Water refill', 'LPG refill']), 40000, 90000)
    if (day === 15) line(16, 'Pressure washer repair', 150000, 250000)
    const ca = []
    if ([4, 11, 18, 25].includes(day)) ca.push({ kind: 'ca_release', staff_id: onDuty[0], amount_minor: pick([50000, 100000]) })
    if ([9, 16, 23, 30].includes(day)) {
      const released = out.sheets.find((s) => s.branch === branch && s.date === SEPTEMBER_DAYS[day - 6])?.caLines.find((l) => l.kind === 'ca_release')
      if (released) ca.push({ kind: 'ca_repay', staff_id: released.staff_id, amount_minor: released.amount_minor })
    }
    const OFF = {
      bacoor: { 5: [-20000, 'Short ₱200 — wrong change given to a customer'], 14: [5000, 'Over ₱50 — customer left a tip in the drawer'], 23: [-50000, 'Short ₱500 — checking with the crew'] },
      batangas: { 9: [-10000, 'Short ₱100 — coins miscounted'], 19: [2000, 'Over ₱20 — rounding on GCash change'], 26: [-30000, 'Short ₱300 — cash advance not written down, crew will repay'] },
    }
    const RETURNS = {
      bacoor: { 8: 'Chemicals receipt is missing — attach it and resubmit', 17: 'Count the drawer again before I approve', 29: 'Lunch amount looks high — add the receipt' },
      batangas: { 22: 'Water refill entered twice — fix and resubmit' },
    }
    const [overShortMinor, notes] = OFF[branch][day] || [0, null]
    let outcome = 'approve'
    if (branch === 'bacoor' && day === 29) outcome = 'returned'
    else if (branch === 'batangas' && day === 30) outcome = 'submitted'
    else if (RETURNS[branch][day]) outcome = 'return_then_approve'
    else if (branch === 'bacoor' && day === 12) outcome = 'reopen_then_approve'
    if (outcome === 'reopen_then_approve') {
      const chem = lines.find((l) => l.account_id === A[12])
      chem.wrong_account_id = A[10]
    }
    return {
      branch,
      date,
      ba: team.ba,
      openingFloatMinor: OPENING_FLOAT_MINOR,
      overShortMinor,
      notes,
      expenseLines: lines,
      caLines: ca,
      outcome,
      reviewer: day % 3 === 0 ? 'asa' : 'sa',
      returnNote: RETURNS[branch][day] || null,
      reopenNote: outcome === 'reopen_then_approve' ? `Shampoo was posted to Meals — moving it to Chemicals (${pesos(lines.find((l) => l.wrong_account_id).amount_minor)})` : null,
    }
  }

  const paid = out.sales.filter((s) => s.status === 'paid')
  out.expected = {
    ...counts,
    customers: out.customers.length,
    bookings: out.bookings.length,
    sales: { paid: paid.length, refunded: out.sales.filter((s) => s.status === 'refunded').length, voided: out.sales.filter((s) => s.status === 'voided').length },
    netMinor: paid.reduce((t, s) => t + s.total_minor, 0),
    byBranch: Object.fromEntries(
      SEED_BRANCHES.map((branch) => {
        const rows = paid.filter((s) => s.branch === branch)
        return [branch, { paid: rows.length, netMinor: rows.reduce((t, s) => t + s.total_minor, 0) }]
      }),
    ),
    maintenance: out.maintenance.length,
    sheets: out.sheets.length,
  }
  return out
}
