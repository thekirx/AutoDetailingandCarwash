/**
 * Pure, deterministic 18-month full-system seed plan (June 2025 – November 2026).
 *
 * Schema-verified against live Supabase public.* tables & views so:
 *   - POS sales + sale_line_items populate `daily_sales_summary` & `finance_daily_line_kind`
 *   - Daily sheets + daily_sheet_lines + posted expenses reconcile via `computeSheetTotals`
 *     & populate `finance_daily_pl` and `FinanceDrilldownSheet` (`daily_sheet:<id>:<line>`)
 *   - Semi-monthly office `payslips` + `expenses` (`salary_monthly`, category code `14`,
 *     `payslip:<id>`) + `payroll_period_locks` populate Payroll & P&L breakdowns
 *   - Monthly bills (Rent, Electricity, Fiber, Marketing, Equipment) populate Bills & P&L
 *   - CRM memberships, loyalty, referrals, birthday perks, notes, planner cards, forms,
 *     restocks, recons, inquiries, reviews, and broadcasts cover all 12 system roles.
 */

import { payHalf, lastDayOfMonth } from '../../src/lib/payslip.js'
import { computeSheetTotals, suggestSalaries } from '../../src/lib/dailySheet.js'
import { SEED_BRANCHES } from './september2026Plan.mjs'

export const OPENING_FLOAT_MINOR = 0
export const FULL_TIMELINE_TAG = '[seed:jun2025-nov2026]'

export const FULL_TIMELINE_MONTHS = [
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
]

export const ALL_SYSTEM_ROLES = [
  'BossMich',
  'assistant_super_admin',
  'admin',
  'team_lead',
  'sales',
  'marketing',
  'investor',
  'operations_lead',
  'staff',
  'detailer',
  'video_editor',
  'customer',
]

const FIRST_NAMES = [
  'Marco', 'Paolo', 'Carlo', 'Miguel', 'Rafael', 'Gabriel', 'Daniel', 'Joshua', 'Christian', 'Mark',
  'Jerome', 'Kevin', 'Bryan', 'Kenneth', 'Ryan', 'Ronald', 'Dennis', 'Allan', 'Noel', 'Joel',
  'Patricia', 'Angela', 'Camille', 'Bianca', 'Clarissa', 'Denise', 'Erika', 'Grace', 'Hannah', 'Irene',
]
const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Gomez', 'Mendoza', 'Torres', 'Flores', 'Rivera', 'Guzman',
  'Ramos', 'Aquino', 'Navarro', 'Castro', 'Villanueva', 'Mercado', 'Salazar', 'Soriano', 'Pascual', 'Aguilar',
]

const CARS = [
  ['Toyota', 'Vios', 'small'],
  ['Honda', 'City', 'small'],
  ['Mitsubishi', 'Mirage', 'small'],
  ['Toyota', 'Corolla Altis', 'medium'],
  ['Honda', 'Civic', 'medium'],
  ['Mazda', '3', 'medium'],
  ['Toyota', 'Fortuner', 'large'],
  ['Toyota', 'Innova', 'large'],
  ['Mitsubishi', 'Montero Sport', 'large'],
  ['Ford', 'Everest', 'large'],
  ['Toyota', 'HiAce', 'extra_large'],
  ['Ford', 'Ranger Raptor', 'extra_large'],
]

const LETTER = { bacoor: 'C', batangas: 'T' }

export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeUuidFactory(prefix = 0x202506) {
  let seq = 0
  const p = prefix.toString(16).padStart(8, '0').slice(0, 8)
  return () => {
    seq += 1
    return `${p}-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`
  }
}

export function manilaAt(date, minutesFromMidnight) {
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0')
  const mm = String(minutesFromMidnight % 60).padStart(2, '0')
  return `${date}T${hh}:${mm}:00+08:00`
}

export function plusMinutes(iso, mins) {
  const ms = new Date(iso).getTime() + mins * 60000
  const d = new Date(ms + 8 * 3600000)
  return `${d.toISOString().slice(0, 19)}+08:00`
}

export function plusDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function plusMonths(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number)
  const targetMonth = m - 1 + months
  const ty = y + Math.floor(targetMonth / 12)
  const tm = ((targetMonth % 12) + 12) % 12 + 1
  const clampedDay = Math.min(d, lastDayOfMonth(ty, tm))
  return `${ty}-${String(tm).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

export const tagTimeline = (text) =>
  text ? `${text} ${FULL_TIMELINE_TAG}` : FULL_TIMELINE_TAG

function lineKindForService(slug, payCategory) {
  const s = String(slug || '').toLowerCase()
  const cat = String(payCategory || '').toLowerCase()
  if (cat === 'ppf' || s === 'paint-protection-film' || s.includes('ppf')) return 'ppf'
  if (['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint'].includes(s) || cat === 'detailing') {
    return 'detailing'
  }
  if (cat === 'package' || s.includes('package')) return 'package'
  return 'service'
}

export function timelineRepresentativeDays(ym, { daysPerMonth = 6, maxDate = '2026-11-18' } = {}) {
  const [y, m] = ym.split('-').map(Number)
  const last = lastDayOfMonth(y, m)
  const candidateDays =
    daysPerMonth >= last
      ? Array.from({ length: last }, (_, i) => i + 1)
      : [2, 6, 11, 15, 20, 26].slice(0, daysPerMonth)
  return candidateDays
    .filter((d) => d <= last)
    .map((d) => `${ym}-${String(d).padStart(2, '0')}`)
    .filter((ymd) => !maxDate || ymd <= maxDate)
}

export function buildFullTimelinePlan({
  catalog,
  staff,
  months = FULL_TIMELINE_MONTHS,
  skipOpsMonths = ['2026-09'],
  existingSheetKeys = [],
  existingAttendanceKeys = [],
  daysPerMonth = 6,
  maxDate = '2026-11-18',
}) {
  const rand = mulberry32(0x20250601)
  const id = makeUuidFactory(0x202506)
  const attId = makeUuidFactory(0x20250a)
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const chance = (p) => rand() < p

  const existingSheetSet = new Set(existingSheetKeys || [])
  const existingAttSet = new Set(existingAttendanceKeys || [])

  const S = catalog.services
  const A = catalog.accounts
  const salaryAcctId = A['14'] || A[14]
  const tiers = catalog.membershipTiers || [
    { id: id(), name: 'Hakum Basic Member', discount_percent: 0 },
    { id: id(), name: 'Hakum Deluxe Member', discount_percent: 5 },
    { id: id(), name: 'Hakum Premium Member', discount_percent: 10 },
  ]

  const out = {
    tag: FULL_TIMELINE_TAG,
    months: [...months],
    customers: [],
    vehicles: [],
    customerMemberships: [],
    loyaltyLedger: [],
    birthdayPerks: [],
    customerNotes: [],
    customerReferrals: [],
    customerReferralRewards: [],
    attendance: [],
    bookings: [],
    queueAssignments: [],
    queueEvents: [],
    sales: [],
    saleLines: [],
    maintenance: [],
    bills: [],
    dailySheets: [],
    dailySheetLines: [],
    dailySheetExpenses: [],
    payslips: [],
    payrollLocks: [],
    payrollExpenses: [],
    planCards: [],
    planCardAssignees: [],
    opsFormSubmissions: [],
    contactInquiries: [],
    serviceReviews: [],
    restockRequests: [],
    inventoryRecons: [],
    inventoryReconLines: [],
    notificationBroadcasts: [],
  }

  let phoneSeq = 600001
  const plateSeq = { bacoor: 5000, batangas: 5000 }
  const pools = { bacoor: [], batangas: [] }
  const bdayKeys = new Set()

  function createCustomerWithVehicle(branch, createdAt, monthIdx) {
    const first = FIRST_NAMES[(phoneSeq + monthIdx) % FIRST_NAMES.length]
    const last = LAST_NAMES[Math.floor(phoneSeq / 3) % LAST_NAMES.length]
    const [make, model, size] = pick(CARS)
    phoneSeq += 1
    plateSeq[branch] += 1
    const custId = id()
    const vehId = id()
    const plate = `FT${LETTER[branch]}${String(plateSeq[branch]).padStart(4, '0')}`
    const dobMonth = String((monthIdx % 12) + 1).padStart(2, '0')
    const referralCode = `FT${String(phoneSeq).slice(-6)}`
    const customer = {
      id: custId,
      role: 'customer',
      full_name: `${first} ${last}`,
      email: `ft.${branch}.${phoneSeq}@seed.hakumautocare.local`,
      phone: `0918${String(phoneSeq).padStart(7, '0')}`,
      loyalty_points: int(20, 450),
      loyalty_stamps: int(1, 9),
      date_of_birth: `199${phoneSeq % 9}-${dobMonth}-15`,
      notify_sms: false,
      notify_push: false,
      is_disabled: false,
      is_archived: false,
      referral_code: referralCode,
      created_at: createdAt,
    }
    const vehicle = {
      id: vehId,
      customer_id: custId,
      plate_number: plate,
      normalized_plate_number: plate.replace(/[^A-Z0-9]/g, '').toUpperCase(),
      vehicle_make: make,
      vehicle_model: model,
      vehicle_year: int(2016, 2026),
      vehicle_type: size,
      color: pick(['Pearl White', 'Jet Black', 'Metallic Gray', 'Silver', 'Deep Blue', 'Red Mica']),
      notes: tagTimeline(`Seeded vehicle (${branch})`),
      first_branch: branch,
      last_branch: branch,
      last_visit_at: createdAt,
      total_visits: 1,
      is_archived: false,
      created_at: createdAt,
    }
    out.customers.push(customer)
    out.vehicles.push(vehicle)

    if (chance(0.35)) {
      const tier = pick(tiers)
      const startYmd = createdAt.slice(0, 10)
      out.customerMemberships.push({
        id: id(),
        customer_id: custId,
        tier_id: tier.id,
        starts_at: startYmd,
        ends_at: plusMonths(startYmd, 12),
        is_active: true,
        created_at: createdAt,
      })
    }

    const entry = { customer, vehicle, branch, lastDate: null, coated: false }
    pools[branch].push(entry)
    return entry
  }

  function pickOrCreateCustomer(branch, date, createdAt, monthIdx) {
    const existing = pools[branch].filter((e) => e.lastDate !== date)
    const entry =
      existing.length >= 8 && chance(0.55)
        ? pick(existing)
        : createCustomerWithVehicle(branch, createdAt, monthIdx)
    entry.lastDate = date
    entry.vehicle.total_visits += 1
    entry.vehicle.last_visit_at = createdAt
    return entry
  }

  function addSale({
    branch,
    booking = null,
    customerId = null,
    items,
    at,
    recordedBy,
    discountMinor = 0,
    discountReason = null,
    status = 'paid',
    note,
  }) {
    const saleId = id()
    const saleLineRows = []
    let subtotal = 0
    for (const it of items) {
      const qty = it.qty || 1
      const lineTotal = it.price * qty
      subtotal += lineTotal
      const lineKind =
        it.type === 'product'
          ? 'merch'
          : lineKindForService(it.slug, it.pay_category)
      const line = {
        id: id(),
        sale_id: saleId,
        item_type: it.type,
        service_id: it.type === 'service' ? it.id : null,
        product_id: it.type === 'product' ? it.id : null,
        name: it.name,
        quantity: qty,
        unit_price_minor: it.price,
        line_total_minor: lineTotal,
        line_kind: lineKind,
        created_at: at,
      }
      out.saleLines.push(line)
      saleLineRows.push({
        ...line,
        services: it.type === 'service' ? { name: it.name, slug: it.slug, pay_category: it.pay_category, salary_pct: it.salary_pct || null } : null,
        products: it.type === 'product' ? { name: it.name, tags: it.tags || [], category: it.category || 'merchandise' } : null,
      })
    }
    const method = pick(['cash', 'cash', 'gcash', 'card', 'split'])
    const totalMinor = Math.max(0, subtotal - discountMinor)
    const effectiveMethod = method === 'split' && totalMinor < 2 ? 'cash' : method
    let cashMinor = null
    let gcashMinor = null
    if (effectiveMethod === 'split') {
      cashMinor = Math.floor(totalMinor / 2)
      gcashMinor = totalMinor - cashMinor
    }

    const sale = {
      id: saleId,
      branch,
      customer_id: customerId,
      booking_id: booking?.id || null,
      status,
      payment_method: effectiveMethod,
      payment_ref:
        method === 'gcash' || method === 'split'
          ? `GC${int(10000000, 99999999)}`
          : method === 'card'
            ? `CD-${int(1000, 9999)}`
            : null,
      cash_minor: cashMinor,
      gcash_minor: gcashMinor,
      subtotal_minor: subtotal,
      discount_minor: discountMinor,
      discount_reason: discountReason,
      total_minor: totalMinor,
      currency: 'PHP',
      notes: tagTimeline(note),
      recorded_by: recordedBy,
      occurred_at: at,
      created_at: at,
    }
    out.sales.push(sale)

    if (customerId && status === 'paid') {
      out.loyaltyLedger.push({
        id: id(),
        customer_id: customerId,
        delta: Math.max(10, Math.round(totalMinor / 1000)),
        reason: tagTimeline('service_sale'),
        sale_id: saleId,
        created_at: at,
      })
    }

    return { sale, saleLineRows }
  }

  const officeRoster = staff.officeRoster || [
    { id: staff.bacoor.ba, role: 'admin', branch_slug: 'bacoor', monthly_salary_minor: 1800000, full_name: 'Bacoor Branch Admin' },
    { id: staff.batangas.ba, role: 'admin', branch_slug: 'batangas', monthly_salary_minor: 1800000, full_name: 'Batangas Branch Admin' },
    ...(staff.asa ? [{ id: staff.asa, role: 'assistant_super_admin', branch_slug: 'bacoor', monthly_salary_minor: 2600000, full_name: 'Lucy (ASA)' }] : []),
    ...(staff.operationsLead ? [{ id: staff.operationsLead, role: 'operations_lead', branch_slug: 'bacoor', monthly_salary_minor: 2400000, full_name: 'Operations Lead' }] : []),
    ...(staff.sales ? [{ id: staff.sales, role: 'sales', branch_slug: 'bacoor', monthly_salary_minor: 2000000, full_name: 'Sales Desk' }] : []),
    ...(staff.marketing ? [{ id: staff.marketing, role: 'marketing', branch_slug: 'bacoor', monthly_salary_minor: 2000000, full_name: 'Marketing Lead' }] : []),
    ...(staff.videoEditor ? [{ id: staff.videoEditor, role: 'video_editor', branch_slug: 'bacoor', monthly_salary_minor: 1900000, full_name: 'Demo Video Editor' }] : []),
  ]

  const plannerLists = catalog.planLists || [
    { id: id(), title: 'Upcoming' },
    { id: id(), title: 'In Progress' },
    { id: id(), title: 'Done' },
  ]
  const plannerCategories = catalog.planCategories || [
    { id: null, name: 'Marketing' },
    { id: null, name: 'Ops' },
  ]
  const opsForms = catalog.opsForms || []

  let bdaySeq = 1
  const openCaByBranch = { bacoor: [], batangas: [] }

  months.forEach((ym, monthIdx) => {
    const isSkippedOpsMonth = skipOpsMonths.includes(ym)
    const [yearNum, monthNum] = ym.split('-').map(Number)
    const monthEndDay = String(lastDayOfMonth(yearNum, monthNum)).padStart(2, '0')

    // 1. Semi-Monthly Office Payroll (1st-15th & 16th-EOM) + matching Finance expenses
    const cutoffs = [payHalf(`${ym}-05`), payHalf(`${ym}-20`)]
    for (const period of cutoffs) {
      if (maxDate && period.start > maxDate) continue
      const isCurrentOpenCutoff = period.end > maxDate
      for (const person of officeRoster) {
        const branch = person.branch_slug || 'bacoor'
        const halfBaseMinor = Math.round(Number(person.monthly_salary_minor || 1800000) / 2)
        const incentiveMinor =
          person.role === 'sales' || person.role === 'marketing'
            ? int(1, 3) * 50000
            : monthIdx % 3 === 0
              ? 25000
              : 0
        const paidFrom = pick(['cash', 'gcash'])
        const status = isCurrentOpenCutoff ? pick(['sent', 'received']) : 'signed'
        const createdDate = period.end <= maxDate ? period.end : maxDate
        const createdIso = manilaAt(createdDate, 17 * 60)
        const slipId = id()
        const expenseId = id()
        const takeHomeMinor = halfBaseMinor + incentiveMinor

        out.payslips.push({
          id: slipId,
          staff_id: person.id,
          branch,
          period_start: period.start,
          period_end: period.end,
          salary_minor: halfBaseMinor,
          incentive_minor: incentiveMinor,
          paid_from: paidFrom,
          note: tagTimeline(`${period.label} ${yearNum} office payroll`),
          status,
          signed_name: status === 'signed' ? person.full_name : null,
          signed_at: status === 'signed' ? plusMinutes(createdIso, 90) : null,
          created_by: staff.sa,
          created_at: createdIso,
        })

        out.payrollExpenses.push({
          id: expenseId,
          title: `Payroll · ${person.full_name}`,
          description: `payslip:${slipId} · ${period.label} ${yearNum} ${FULL_TIMELINE_TAG}`,
          quantity: 1,
          unit_cost_minor: takeHomeMinor,
          total_minor: takeHomeMinor,
          branch,
          category_id: salaryAcctId,
          status: 'paid',
          expense_kind: 'salary_monthly',
          paid_from: paidFrom,
          payslip_id: slipId,
          created_by: staff.sa,
          approved_by: staff.sa,
          paid_by: staff.sa,
          created_at: createdIso,
        })
      }

      if (!isCurrentOpenCutoff) {
        for (const branch of SEED_BRANCHES) {
          out.payrollLocks.push({
            id: id(),
            branch,
            period_start: period.start,
            period_end: period.end,
            locked_by: staff.sa,
            locked_at: manilaAt(period.end, 18 * 60 + 30),
          })
        }
      }
    }

    // 2. Monthly Bills (Rent, Electricity, Fiber Internet + Periodic Marketing & Repairs)
    if (!isSkippedOpsMonth) {
      const RENT = { bacoor: 4500000, batangas: 3000000 }
      const POWER = {
        bacoor: 1180000 + (monthIdx % 5) * 45000,
        batangas: 790000 + (monthIdx % 4) * 35000,
      }
      const INTERNET = { bacoor: 249900, batangas: 199900 }
      for (const branch of SEED_BRANCHES) {
        const dueDay = `${ym}-05`
        const powerDay = `${ym}-${String(Math.min(28, Number(monthEndDay))).padStart(2, '0')}`
        if (!maxDate || dueDay <= maxDate) {
          out.bills.push({
            id: id(),
            title: `Rent — ${ym}`,
            description: tagTimeline(`Monthly branch lease (${branch})`),
            quantity: 1,
            unit_cost_minor: RENT[branch],
            total_minor: RENT[branch],
            branch,
            category_id: A['19'],
            status: 'paid',
            expense_kind: 'monthly',
            paid_from: 'gcash',
            bill_reference: `RENT-${ym}-${LETTER[branch]}`,
            due_date: dueDay,
            created_by: staff.sa,
            approved_by: staff.sa,
            paid_by: staff.sa,
            created_at: manilaAt(`${ym}-01`, 10 * 60),
          })
          out.bills.push({
            id: id(),
            title: `Fiber Internet — ${ym}`,
            description: tagTimeline(`Monthly business fiber (${branch})`),
            quantity: 1,
            unit_cost_minor: INTERNET[branch],
            total_minor: INTERNET[branch],
            branch,
            category_id: A['19'],
            status: 'paid',
            expense_kind: 'monthly',
            paid_from: 'gcash',
            bill_reference: `NET-${ym}-${LETTER[branch]}`,
            due_date: `${ym}-10`,
            created_by: staff.sa,
            approved_by: staff.sa,
            paid_by: staff.sa,
            created_at: manilaAt(`${ym}-03`, 11 * 60),
          })
          if (monthIdx % 2 === 0 && (A['17'] || A['16'])) {
            out.bills.push({
              id: id(),
              title: `Meta Ads & Bay Campaign — ${ym}`,
              description: tagTimeline(`Monthly digital promo spend (${branch})`),
              quantity: 1,
              unit_cost_minor: branch === 'bacoor' ? 350000 : 250000,
              total_minor: branch === 'bacoor' ? 350000 : 250000,
              branch,
              category_id: A['17'] || A['19'],
              status: 'paid',
              expense_kind: 'monthly',
              paid_from: 'gcash',
              bill_reference: `MKT-${ym}-${LETTER[branch]}`,
              due_date: `${ym}-15`,
              created_by: staff.sa,
              approved_by: staff.sa,
              paid_by: staff.sa,
              created_at: manilaAt(`${ym}-08`, 13 * 60),
            })
          }
        }
        if (!maxDate || powerDay <= maxDate) {
          const powerPaid = ym < '2026-11'
          out.bills.push({
            id: id(),
            title: `Electricity — ${ym}`,
            description: tagTimeline(`Monthly utility bill (${branch})`),
            quantity: 1,
            unit_cost_minor: POWER[branch],
            total_minor: POWER[branch],
            branch,
            category_id: A['19'],
            status: powerPaid ? 'paid' : 'approved',
            expense_kind: 'monthly',
            paid_from: powerPaid ? 'gcash' : null,
            bill_reference: `PWR-${ym}-${LETTER[branch]}`,
            due_date: plusDays(powerDay, 7),
            created_by: staff.sa,
            approved_by: staff.sa,
            paid_by: powerPaid ? staff.sa : null,
            created_at: manilaAt(powerDay, 14 * 60),
          })
        }
      }
    }

    // 3. Planner Tasks, Ops Forms, Restocks, Recons, Inquiries, Broadcasts
    const monthCardDate = `${ym}-10`
    if (!maxDate || monthCardDate <= maxDate) {
      const doneList = plannerLists.find((l) => /done/i.test(l.title)) || plannerLists[plannerLists.length - 1]
      const progList = plannerLists.find((l) => /progress/i.test(l.title)) || plannerLists[0]
      const opsCat = plannerCategories.find((c) => /ops/i.test(c.name))?.id || null
      const mktCat = plannerCategories.find((c) => /market/i.test(c.name))?.id || opsCat

      const roleCards = [
        {
          title: `Monthly Ceramic Reel & Before/After Cut (${ym})`,
          description: tagTimeline('Edit 60s reel of flagship ceramic coating & PPF bay release.'),
          list_id: ym < '2026-11' ? doneList.id : progList.id,
          category_id: mktCat,
          assignee: staff.videoEditor || staff.bacoor.ba,
          status: ym < '2026-11' ? 'done' : 'working',
        },
        {
          title: `Promo & Voucher Campaign (${ym})`,
          description: tagTimeline('Launch targeted voucher & loyalty campaign for wash customers.'),
          list_id: ym < '2026-11' ? doneList.id : progList.id,
          category_id: mktCat,
          assignee: staff.marketing || staff.bacoor.ba,
          status: ym < '2026-11' ? 'done' : 'working',
        },
        {
          title: `Corporate Fleet & Coating Quotes (${ym})`,
          description: tagTimeline('Follow up on fleet wash & detailing quotations.'),
          list_id: ym < '2026-11' ? doneList.id : plannerLists[0].id,
          category_id: opsCat,
          assignee: staff.sales || staff.bacoor.ba,
          status: ym < '2026-11' ? 'done' : 'todo',
        },
        {
          title: `Cross-Branch Bay SLA & Chemical Audit (${ym})`,
          description: tagTimeline('Verify SLA dwell times and Sunday chemical reconciliation.'),
          list_id: ym < '2026-11' ? doneList.id : progList.id,
          category_id: opsCat,
          assignee: staff.operationsLead || staff.batangas.ba,
          status: ym < '2026-11' ? 'done' : 'working',
        },
      ]
      roleCards.forEach((rc, idx) => {
        const cardId = id()
        out.planCards.push({
          id: cardId,
          list_id: rc.list_id,
          title: rc.title,
          description: rc.description,
          due_at: manilaAt(`${ym}-25`, 18 * 60),
          position: idx,
          labels: [],
          created_by: staff.sa,
          category_id: rc.category_id,
          proof_required: false,
          created_at: manilaAt(monthCardDate, 9 * 60),
        })
        out.planCardAssignees.push({
          id: id(),
          card_id: cardId,
          staff_id: rc.assignee,
          status: rc.status === 'done' ? 'done' : rc.status === 'working' ? 'in_progress' : 'todo',
          assigned_by: staff.sa,
          created_at: manilaAt(monthCardDate, 9 * 60),
        })
      })

      for (const branch of SEED_BRANCHES) {
        const team = staff[branch]
        const prod = pick(catalog.products)
        out.restockRequests.push({
          id: id(),
          product_id: prod.id,
          branch_slug: branch,
          add_qty: int(6, 24),
          status: ym < '2026-11' ? 'approved' : pick(['pending', 'approved']),
          requested_by: team.ba,
          reviewed_by: ym < '2026-11' ? (staff.asa || staff.sa) : null,
          reviewed_at: ym < '2026-11' ? manilaAt(`${ym}-12`, 14 * 60) : null,
          created_at: manilaAt(`${ym}-12`, 11 * 60),
        })

        const reconId = id()
        out.inventoryRecons.push({
          id: reconId,
          branch_slug: branch,
          week_of: `${ym}-14`,
          status: 'approved',
          submitted_by: team.ba,
          submitted_at: manilaAt(`${ym}-14`, 18 * 60),
          reviewed_by: staff.asa || staff.sa,
          reviewed_at: manilaAt(`${ym}-14`, 19 * 60),
          notes: tagTimeline(`Chemical inventory reconciliation (${ym})`),
          created_at: manilaAt(`${ym}-14`, 18 * 60),
        })
        for (const p of catalog.products.slice(0, 3)) {
          out.inventoryReconLines.push({
            id: id(),
            recon_id: reconId,
            product_id: p.id,
            previous_qty: 25,
            leftover_qty: int(14, 22),
            created_at: manilaAt(`${ym}-14`, 18 * 60),
          })
        }

        const formObj =
          opsForms.find((f) => f.kind === 'equipment_repair' && f.is_active) ||
          opsForms.find((f) => f.is_active) ||
          opsForms[0]
        if (formObj) {
          out.opsFormSubmissions.push({
            id: id(),
            form_id: formObj.id,
            payload: {
              branch,
              equipment: pick(['Pressure Washer #1', 'Foam Cannon', 'Vacuum Unit #2', 'Bay Lighting']),
              description: tagTimeline(`Routine bay equipment QA check (${ym})`),
              submitted_month: ym,
            },
            created_by: team.washTl[0],
            status: ym < '2026-11' ? 'resolved' : 'new',
            respondent_label: `${branch.toUpperCase()} Team Lead`,
            source: 'staff',
            resolved_at: ym < '2026-11' ? manilaAt(`${ym}-16`, 15 * 60) : null,
            created_at: manilaAt(`${ym}-15`, 16 * 60),
          })
        }

        out.contactInquiries.push({
          id: id(),
          name: `Inquiry Client ${ym} (${branch})`,
          phone: `0919${String(700000 + monthIdx * 10 + (branch === 'bacoor' ? 1 : 2)).padStart(7, '0')}`,
          email: `inquiry.${branch}.${ym}@seed.hakumautocare.local`,
          subject: 'Ceramic Coating & PPF Package Quote',
          message: tagTimeline(`Asking for ceramic coating + front PPF rate in ${branch}`),
          created_at: manilaAt(`${ym}-08`, 13 * 60),
        })
      }

      out.notificationBroadcasts.push({
        id: id(),
        kind: 'promo',
        channel: 'push',
        title: `Hakum Care Reminder (${ym})`,
        body: tagTimeline(`Monthly vehicle protection & wash reminder for ${ym}.`),
        url: '/book',
        target_audience: 'all',
        audience_group: 'customers',
        sent_count: int(25, 90),
        failed_count: 0,
        sent_by: staff.marketing || staff.sa,
        sent_at: manilaAt(`${ym}-04`, 10 * 60),
        created_at: manilaAt(`${ym}-04`, 10 * 60),
      })
    }

    // 4. Daily Operational Workflow (Attendance, Wash Queue, Detailing, POS Sales, Daily Sheets)
    if (isSkippedOpsMonth) return

    const repDays = timelineRepresentativeDays(ym, { daysPerMonth, maxDate })
    for (const date of repDays) {
      const growthFactor = 1 + monthIdx * 0.035

      for (const branch of SEED_BRANCHES) {
        const team = staff[branch]
        const washTl = pick(team.washTl)
        const detailTl = pick(team.detailTl)
        const detailer = pick(team.detailers)
        const onDutyCrew = team.crew.slice(0, branch === 'bacoor' ? 3 : 2)

        const attRecordsToday = []
        const addAtt = (staffId, roleName, fullName, dailyRateMinor, status, clockInMin) => {
          const k = `${staffId}:${date}`
          attRecordsToday.push({
            staff_id: staffId,
            full_name: fullName,
            role: roleName,
            status,
            checked_in_at: status === 'absent' ? null : manilaAt(date, clockInMin),
            daily_rate_minor: dailyRateMinor,
          })
          if (existingAttSet.has(k)) return
          existingAttSet.add(k)
          out.attendance.push({
            id: attId(),
            staff_id: staffId,
            branch_slug: branch,
            attendance_date: date,
            status,
            checked_in_at: status === 'absent' ? null : manilaAt(date, clockInMin),
            checked_out_at: status === 'absent' ? null : manilaAt(date, 19 * 60),
            marked_by: team.ba,
            source: 'manual',
            notes: tagTimeline(`Attendance ${date}`),
            created_at: manilaAt(date, clockInMin),
          })
        }

        const profileName = (sid, fallback) => staff.namesById?.[sid] || fallback
        const profileRate = (sid, fallback = 50000) => staff.dailyRatesById?.[sid] || fallback

        addAtt(washTl, 'team_lead', profileName(washTl, 'Team Lead'), profileRate(washTl, 65000), 'present', 7 * 60 + 52)
        if (detailTl !== washTl) {
          addAtt(detailTl, 'team_lead', profileName(detailTl, 'Detailing TL'), profileRate(detailTl, 65000), 'present', 7 * 60 + 55)
        }
        addAtt(detailer, 'detailer', profileName(detailer, 'Detailer'), profileRate(detailer, 60000), 'present', 7 * 60 + 58)
        onDutyCrew.forEach((cid, idx) => {
          const isLate = idx === onDutyCrew.length - 1 && date.endsWith('15')
          addAtt(cid, 'staff', profileName(cid, `Crew ${idx + 1}`), profileRate(cid, 45000), isLate ? 'late' : 'present', isLate ? 8 * 60 + 22 : 7 * 60 + 54)
        })

        const daySalesForSheet = []
        const baseWashes = branch === 'bacoor' ? 9 : 6
        const washCount = Math.max(4, Math.round(baseWashes * growthFactor))
        let queueNumber = 0
        for (let w = 0; w < washCount; w += 1) {
          queueNumber += 1
          const startMin = 8 * 60 + w * 40 + int(0, 12)
          const createdAt = manilaAt(date, startMin)
          const entry = pickOrCreateCustomer(branch, date, createdAt, monthIdx)
          const slug = pick([
            'express-wash-package',
            'express-wash-package',
            'premium-car-wash',
            'premium-car-wash',
            'engine-wash',
            'full-care-package',
            'hakum-custom-package',
          ])
          const svc = S[slug]
          const price = svc.prices[entry.vehicle.vehicle_type]
          const isCancelled = w === washCount - 1 && date.endsWith('20')
          const status = isCancelled ? 'cancelled' : 'completed'
          const inProgAt = plusMinutes(createdAt, 8)
          const checkAt = plusMinutes(inProgAt, 28)
          const payAt = plusMinutes(checkAt, 6)
          const doneAt = plusMinutes(payAt, 4)
          const referralSource = pick([
            'social_media',
            'facebook_ads',
            'facebook_page',
            'talked_to_employee',
          ])

          const booking = {
            id: id(),
            branch,
            customer_id: entry.customer.id,
            service_id: svc.id,
            vehicle_id: entry.vehicle.id,
            customer_name: entry.customer.full_name,
            customer_email: entry.customer.email,
            customer_phone: entry.customer.phone,
            vehicle_make: entry.vehicle.make,
            vehicle_model: entry.vehicle.model,
            vehicle_year: entry.vehicle.year,
            vehicle_plate: entry.vehicle.plate_number,
            vehicle_type: entry.vehicle.vehicle_type,
            scheduled_start: createdAt,
            queue_date: date,
            queue_number: queueNumber,
            status,
            referral_source: referralSource,
            referred_by_name: referralSource === 'talked_to_employee' ? 'Crew Referral' : null,
            notes: tagTimeline(isCancelled ? 'Walk-in wash — cancelled' : 'Walk-in wash — completed'),
            created_at: createdAt,
            created_by: team.ba,
            team_lead_id: washTl,
            in_progress_at: isCancelled ? null : inProgAt,
            final_checking_at: isCancelled ? null : checkAt,
            for_payment_at: isCancelled ? null : payAt,
            completed_at: isCancelled ? null : doneAt,
            cancelled_at: isCancelled ? plusMinutes(createdAt, 10) : null,
            cancellation_reason: isCancelled ? "Customer can't wait any longer" : null,
            price_minor: price,
            final_price_minor: isCancelled ? null : price,
          }
          out.bookings.push(booking)

          if (!isCancelled) {
            const assignedCrew = onDutyCrew[w % onDutyCrew.length]
            out.queueAssignments.push({
              id: id(),
              booking_id: booking.id,
              staff_id: assignedCrew,
              assigned_by: washTl,
              status: 'released',
              started_at: inProgAt,
              released_at: checkAt,
              completed_at: checkAt,
              created_at: inProgAt,
            })
            out.queueEvents.push(
              { id: id(), booking_id: booking.id, branch, old_status: null, new_status: 'waiting', changed_by: team.ba, notes: null, created_at: createdAt },
              { id: id(), booking_id: booking.id, branch, old_status: 'waiting', new_status: 'in_progress', changed_by: washTl, notes: null, created_at: inProgAt },
              { id: id(), booking_id: booking.id, branch, old_status: 'in_progress', new_status: 'final_checking', changed_by: washTl, notes: null, created_at: checkAt },
              { id: id(), booking_id: booking.id, branch, old_status: 'final_checking', new_status: 'for_payment', changed_by: washTl, notes: null, created_at: payAt },
              { id: id(), booking_id: booking.id, branch, old_status: 'for_payment', new_status: 'completed', changed_by: team.ba, notes: null, created_at: doneAt },
            )
            const items = [{ type: 'service', id: svc.id, slug, pay_category: svc.pay_category, name: svc.name, price }]
            if (w % 4 === 0 && catalog.products.length) {
              const p = pick(catalog.products)
              items.push({ type: 'product', id: p.id, name: p.name, price: p.price_minor, qty: 1 })
            }
            const isRefunded = w === 2 && date.endsWith('26')
            const { sale, saleLineRows } = addSale({
              branch,
              booking,
              customerId: entry.customer.id,
              items,
              at: doneAt,
              recordedBy: team.ba,
              discountMinor: w === 0 ? Math.round((price * 0.1) / 100) * 100 : 0,
              discountReason: w === 0 ? 'Member / loyalty 10% discount' : null,
              status: isRefunded ? 'refunded' : 'paid',
              note: isRefunded ? 'Wash ticket refunded after inspection' : 'Wash ticket settled at POS',
            })
            daySalesForSheet.push({
              ...sale,
              bookings: { services: { name: svc.name, pay_category: svc.pay_category || 'carwash' } },
              sale_line_items: saleLineRows,
            })
          }
        }

        // High-ticket Detailing job
        if (date.endsWith('06') || date.endsWith('15') || date.endsWith('26')) {
          const detCreated = manilaAt(date, 9 * 60 + 15)
          const entry = pickOrCreateCustomer(branch, date, detCreated, monthIdx)
          const slug = pick([
            'ceramic-coating',
            'paint-protection-film',
            'nano-ceramic-tint',
            'interior-detailing',
            'full-exterior-detailing',
            'paint-maintenance',
            'glass-detailing',
          ])
          const svc = S[slug]
          const price = svc.prices[entry.vehicle.vehicle_type]
          const doneAt = manilaAt(date, 17 * 60 + 20)
          const detBooking = {
            id: id(),
            branch,
            customer_id: entry.customer.id,
            service_id: svc.id,
            vehicle_id: entry.vehicle.id,
            customer_name: entry.customer.full_name,
            customer_email: entry.customer.email,
            customer_phone: entry.customer.phone,
            vehicle_make: entry.vehicle.make,
            vehicle_model: entry.vehicle.model,
            vehicle_year: entry.vehicle.year,
            vehicle_plate: entry.vehicle.plate_number,
            vehicle_type: entry.vehicle.vehicle_type,
            scheduled_start: detCreated,
            queue_date: date,
            queue_number: 1,
            status: 'completed',
            referral_source: 'social_media',
            notes: tagTimeline(`Detailing job (${svc.name}) — completed`),
            created_at: detCreated,
            created_by: team.ba,
            team_lead_id: detailTl,
            in_progress_at: plusMinutes(detCreated, 20),
            final_checking_at: plusMinutes(detCreated, 360),
            for_payment_at: plusMinutes(detCreated, 420),
            completed_at: doneAt,
            price_minor: price,
            final_price_minor: price,
          }
          out.bookings.push(detBooking)
          out.queueAssignments.push({
            id: id(),
            booking_id: detBooking.id,
            staff_id: detailer,
            assigned_by: detailTl,
            status: 'released',
            started_at: plusMinutes(detCreated, 20),
            released_at: plusMinutes(detCreated, 360),
            completed_at: plusMinutes(detCreated, 360),
            created_at: plusMinutes(detCreated, 20),
          })
          const { sale, saleLineRows } = addSale({
            branch,
            booking: detBooking,
            customerId: entry.customer.id,
            items: [{ type: 'service', id: svc.id, slug, pay_category: svc.pay_category || 'detailing', name: svc.name, price }],
            at: doneAt,
            recordedBy: team.ba,
            note: `Detailing job settled (${svc.name})`,
          })
          daySalesForSheet.push({
            ...sale,
            bookings: { services: { name: svc.name, pay_category: svc.pay_category || 'detailing' } },
            sale_line_items: saleLineRows,
          })

          if (slug === 'ceramic-coating' || slug === 'paint-protection-film') {
            entry.coated = true
            const mStatus = plusMonths(date, 6) <= maxDate ? 'completed' : 'scheduled'
            out.maintenance.push({
              id: id(),
              vehicle_id: entry.vehicle.id,
              booking_id: detBooking.id,
              customer_id: entry.customer.id,
              service_slug: slug,
              plate_number: entry.vehicle.plate_number,
              plate_normalized: entry.vehicle.normalized_plate_number,
              customer_phone: entry.customer.phone,
              customer_name: entry.customer.full_name,
              coated_at: date,
              last_maintenance_at: mStatus === 'completed' ? plusMonths(date, 6) : null,
              next_due_at: plusMonths(date, 6),
              branch_slug: branch,
              status: mStatus,
              last_notified_at: null,
              notes: tagTimeline(`Enrolled from ${ym} ${svc.name} install`),
            })
          }

          const score = pick([5, 5, 5, 4])
          out.serviceReviews.push({
            id: id(),
            booking_id: detBooking.id,
            customer_id: entry.customer.id,
            branch,
            customer_name: entry.customer.full_name,
            overall_rating: score,
            app_rating: score,
            service_rating: score,
            detailing_rating: score,
            comment: tagTimeline(`Mirror finish on ${entry.vehicle.make} ${entry.vehicle.model}!`),
            created_at: plusMinutes(doneAt, 60),
          })
        }

        // Counter merch/lounge sale (voided on the 15th in Bacoor)
        if (catalog.products.length) {
          const prod = pick(catalog.products)
          const isVoid = date.endsWith('15') && branch === 'bacoor'
          const { sale, saleLineRows } = addSale({
            branch,
            items: [{ type: 'product', id: prod.id, name: prod.name, price: prod.price_minor, qty: 1 }],
            at: manilaAt(date, 13 * 60 + 30),
            recordedBy: team.ba,
            status: isVoid ? 'voided' : 'paid',
            note: isVoid ? 'Counter sale — voided, wrong item rung up' : 'Counter lounge/merch sale',
          })
          if (!isVoid) {
            daySalesForSheet.push({
              ...sale,
              bookings: null,
              sale_line_items: saleLineRows,
            })
          }
        }

        // Daily Sheet + Lines + Reconciled Posted Expenses
        const sheetKey = `${branch}:${date}`
        if (!existingSheetSet.has(sheetKey)) {
          existingSheetSet.add(sheetKey)
          const sheetId = id()
          const isSubmittedOnly = date === maxDate && branch === 'batangas'
          const sheetStatus = isSubmittedOnly ? 'submitted' : 'approved'
          const dailyRates = Object.fromEntries(attRecordsToday.map((a) => [a.staff_id, a.daily_rate_minor]))
          const suggestions = suggestSalaries({
            date,
            branch,
            sales: daySalesForSheet,
            attendance: attRecordsToday,
            rules: catalog.compensationSettings || {},
            dailyRates,
          })

          const lines = []
          let sortIdx = 0
          const pushExpenseLine = (code, description, amountMinor, paidFrom = 'cash') => {
            const acctId = A[String(code)] || A[code]
            if (!acctId || !(amountMinor > 0)) return
            const lineId = id()
            lines.push({
              id: lineId,
              sheet_id: sheetId,
              kind: 'expense',
              staff_id: null,
              account_id: acctId,
              description,
              suggested_minor: null,
              amount_minor: amountMinor,
              reason: null,
              paid_from: paidFrom,
              sort: sortIdx++,
              created_at: manilaAt(date, 19 * 60),
            })
            if (sheetStatus === 'approved') {
              out.dailySheetExpenses.push({
                id: id(),
                title: description,
                description: `daily_sheet:${sheetId}:${lineId} ${FULL_TIMELINE_TAG}`,
                quantity: 1,
                unit_cost_minor: amountMinor,
                total_minor: amountMinor,
                branch,
                category_id: acctId,
                status: 'paid',
                expense_kind: 'daily',
                daily_sheet_line_id: lineId,
                paid_from: paidFrom,
                created_by: team.ba,
                approved_by: staff.sa,
                paid_by: staff.sa,
                created_at: manilaAt(date, 12 * 60),
              })
            }
          }

          pushExpenseLine(10, pick(['Crew lunch', 'Crew merienda', 'Lunch for crew and TL']), int(35, 80) * 500, 'cash')
          if (date.endsWith('06') || date.endsWith('20')) {
            pushExpenseLine(12, pick(['Car shampoo & wax refill', 'Tire black & microfiber cloths']), int(180, 420) * 500, pick(['cash', 'gcash']))
          }
          if (date.endsWith('11')) {
            pushExpenseLine(13, pick(['Customer lounge coffee & cups', 'Drinking water refill']), int(50, 95) * 500, 'cash')
          }
          if (date.endsWith('15') && A['16']) {
            pushExpenseLine(16, 'Bay hose & pressure nozzle maintenance', int(200, 350) * 500, 'cash')
          }

          for (const s of suggestions) {
            if (!(s.suggested_minor > 0)) continue
            const lineId = id()
            lines.push({
              id: lineId,
              sheet_id: sheetId,
              kind: 'salary',
              staff_id: s.staff_id,
              account_id: null,
              description: null,
              suggested_minor: s.suggested_minor,
              amount_minor: s.suggested_minor,
              reason: null,
              paid_from: 'cash',
              sort: sortIdx++,
              created_at: manilaAt(date, 19 * 60),
            })
            if (sheetStatus === 'approved') {
              out.dailySheetExpenses.push({
                id: id(),
                title: `Salary · ${s.staff_name}`,
                description: `daily_sheet:${sheetId}:${lineId} ${FULL_TIMELINE_TAG}`,
                quantity: 1,
                unit_cost_minor: s.suggested_minor,
                total_minor: s.suggested_minor,
                branch,
                category_id: salaryAcctId,
                status: 'paid',
                expense_kind: s.role === 'detailer' ? 'salary_detailer' : 'salary_carwash',
                daily_sheet_line_id: lineId,
                paid_from: 'cash',
                created_by: team.ba,
                approved_by: staff.sa,
                paid_by: staff.sa,
                created_at: manilaAt(date, 12 * 60),
              })
            }
          }

          // Cash advance release / repay
          if (date.endsWith('06')) {
            const caLineId = id()
            const caStaff = onDutyCrew[0]
            lines.push({
              id: caLineId,
              sheet_id: sheetId,
              kind: 'ca_release',
              staff_id: caStaff,
              account_id: null,
              description: tagTimeline('Crew cash advance'),
              suggested_minor: null,
              amount_minor: 50000,
              reason: `CA-${ym.replace('-', '')}-${LETTER[branch]}`,
              paid_from: 'cash',
              sort: sortIdx++,
              created_at: manilaAt(date, 19 * 60),
            })
            openCaByBranch[branch].push({ staff_id: caStaff, amount_minor: 50000 })
          } else if (date.endsWith('15') && openCaByBranch[branch].length) {
            const rel = openCaByBranch[branch].shift()
            lines.push({
              id: id(),
              sheet_id: sheetId,
              kind: 'ca_repay',
              staff_id: rel.staff_id,
              account_id: null,
              description: tagTimeline('Cash advance repayment'),
              suggested_minor: null,
              amount_minor: rel.amount_minor,
              reason: 'Repaid from payroll cutoff',
              paid_from: 'cash',
              sort: sortIdx++,
              created_at: manilaAt(date, 19 * 60),
            })
          }

          const overShortMinor = date.endsWith('11') ? -10000 : 0
          let preCount = computeSheetTotals({ sales: daySalesForSheet, lines, countedCashMinor: null })
          if (preCount.expectedCashMinor + overShortMinor < 0) {
            const postedByLineId = new Map(out.dailySheetExpenses.map((e) => [e.daily_sheet_line_id, e]))
            for (const ln of lines) {
              if (preCount.expectedCashMinor + overShortMinor >= 0) break
              if (ln.paid_from !== 'gcash' && ln.kind !== 'ca_repay') {
                ln.paid_from = 'gcash'
                const exp = postedByLineId.get(ln.id)
                if (exp) exp.paid_from = 'gcash'
                preCount = computeSheetTotals({ sales: daySalesForSheet, lines, countedCashMinor: null })
              }
            }
          }
          const countedCashMinor = Math.max(0, preCount.expectedCashMinor + overShortMinor)
          const totals = computeSheetTotals({ sales: daySalesForSheet, lines, countedCashMinor })

          out.dailySheets.push({
            id: sheetId,
            branch,
            business_date: date,
            status: sheetStatus,
            opening_float_minor: OPENING_FLOAT_MINOR,
            counted_cash_minor: countedCashMinor,
            totals,
            notes: date.endsWith('11')
              ? tagTimeline('Short ₱100 — coin variance')
              : tagTimeline(`Daily sheet ${date}`),
            created_by: team.ba,
            submitted_by: team.ba,
            submitted_at: manilaAt(date, 19 * 60 + 15),
            reviewed_by: sheetStatus === 'approved' ? (monthIdx % 2 === 0 ? staff.sa : (staff.asa || staff.sa)) : null,
            reviewed_at: sheetStatus === 'approved' ? manilaAt(date, 20 * 60) : null,
            created_at: manilaAt(date, 19 * 60),
          })
          out.dailySheetLines.push(...lines)
        }
      }
    }

    // 5. Referrals, Birthday Perks & Customer Notes per month
    for (const branch of SEED_BRANCHES) {
      const pool = pools[branch]
      if (pool.length >= 2) {
        const refEntry = pool[(monthIdx * 3) % Math.max(1, pool.length - 1)]
        const referrer = refEntry.customer
        const friend = pool[pool.length - 1].customer
        if (referrer.id !== friend.id) {
          const refId = id()
          const refAt = manilaAt(`${ym}-11`, 14 * 60)
          out.customerReferrals.push({
            id: refId,
            referrer_id: referrer.id,
            friend_id: friend.id,
            code: referrer.referral_code,
            status: 'qualified',
            qualified_at: refAt,
            created_at: refAt,
          })
          out.customerReferralRewards.push({
            id: id(),
            customer_id: referrer.id,
            referral_id: refId,
            role: 'referrer',
            status: ym < '2026-11' ? 'claimed' : 'available',
            granted_at: refAt,
            expires_at: manilaAt(plusDays(`${ym}-11`, 30), 23 * 60 + 59),
            claimed_at: ym < '2026-11' ? manilaAt(`${ym}-20`, 12 * 60) : null,
          })
        }

        const bdayKey = `${referrer.id}:${yearNum}`
        if (!bdayKeys.has(bdayKey)) {
          bdayKeys.add(bdayKey)
          bdaySeq += 1
          const bdayAt = manilaAt(`${ym}-15`, 9 * 60)
          out.birthdayPerks.push({
            id: id(),
            customer_id: referrer.id,
            perk_year: yearNum,
            status: ym < '2026-11' ? 'claimed' : 'available',
            granted_at: bdayAt,
            expires_at: manilaAt(plusDays(`${ym}-15`, 30), 23 * 60 + 59),
            claimed_at: ym < '2026-11' ? manilaAt(`${ym}-20`, 14 * 60) : null,
            code: `BFT${String(bdaySeq).padStart(4, '0')}`,
            created_at: bdayAt,
          })
        }

        out.customerNotes.push({
          id: id(),
          customer_id: referrer.id,
          vehicle_id: refEntry.vehicle.id,
          plate_normalized: refEntry.vehicle.normalized_plate_number,
          note_type: 'general',
          body: tagTimeline(`Prefers ceramic-safe pH neutral shampoo (${ym}).`),
          created_by: staff[branch].ba,
          branch_slug: branch,
          created_at: manilaAt(`${ym}-11`, 15 * 60),
        })
      }
    }
  })

  const paidSales = out.sales.filter((s) => s.status === 'paid')
  const refundedSales = out.sales.filter((s) => s.status === 'refunded')
  const voidedSales = out.sales.filter((s) => s.status === 'voided')

  out.expected = {
    monthsCovered: months.length,
    opsMonthsSeeded: months.filter((m) => !skipOpsMonths.includes(m)).length,
    rolesCovered: ALL_SYSTEM_ROLES,
    customers: out.customers.length,
    vehicles: out.vehicles.length,
    customerMemberships: out.customerMemberships.length,
    loyaltyLedger: out.loyaltyLedger.length,
    birthdayPerks: out.birthdayPerks.length,
    customerNotes: out.customerNotes.length,
    customerReferrals: out.customerReferrals.length,
    bookings: out.bookings.length,
    attendance: out.attendance.length,
    sales: {
      total: out.sales.length,
      paid: paidSales.length,
      refunded: refundedSales.length,
      voided: voidedSales.length,
    },
    saleLines: out.saleLines.length,
    netSalesMinor: paidSales.reduce((acc, s) => acc + s.total_minor, 0),
    sheets: out.dailySheets.length,
    sheetLines: out.dailySheetLines.length,
    dailySheetExpenses: out.dailySheetExpenses.length,
    bills: out.bills.length,
    payslips: out.payslips.length,
    payrollLocks: out.payrollLocks.length,
    payrollExpenses: out.payrollExpenses.length,
    payrollTotalMinor: out.payrollExpenses.reduce((acc, e) => acc + e.total_minor, 0),
    maintenance: out.maintenance.length,
    planCards: out.planCards.length,
    opsFormSubmissions: out.opsFormSubmissions.length,
    contactInquiries: out.contactInquiries.length,
    serviceReviews: out.serviceReviews.length,
    restockRequests: out.restockRequests.length,
    inventoryRecons: out.inventoryRecons.length,
    notificationBroadcasts: out.notificationBroadcasts.length,
  }

  return out
}
