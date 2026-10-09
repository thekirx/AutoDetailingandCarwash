/**
 * Principal QA — multi-branch shop day.
 * Clock-in → TL wash tickets → detailing booking → POS → EoS → Finance → payroll.
 * Late / absent / cash advance / assigned detailer. Expected ₱ are literals.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLES, allowRoute } from '../src/auth/permissions.js'
import { isAssignableAttendanceStatus } from '../src/queue/queueLogic.js'
import {
  attendanceRowForPayroll,
  attendanceWeight,
  buildCeramicCompensationExpenses,
  hhmmToMinutes,
  hoursForAttendanceDay,
  indexBranchOperatingHours,
} from '../src/lib/compensation.js'
import { buildPayrollPreview } from '../src/lib/payroll.js'
import { rollupPl } from '../src/lib/financeData.js'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const DAY = '2026-08-22'
const BACOOR = 'bacoor'
const IMUS = 'imus'
const SILANG = 'silang'
const RULES = { wash_pool_pct: 35 }
const SHIFT = { shift_start: '08:00', shift_end: '16:00' }

function staff(id, name, branch, status, extras = {}) {
  return {
    staff_id: id,
    id,
    full_name: name,
    role: extras.role || 'staff',
    branch_slug: branch,
    attendance_date: DAY,
    status,
    attendance_status: status,
    ...SHIFT,
    ...extras,
  }
}

const bacoorOnTime = staff('crew-on', 'On Time', BACOOR, 'present', { clock_in_at: '08:00' })
const bacoorLate = staff('crew-late', 'Late Ana', BACOOR, 'late', { clock_in_at: '09:00' })
const bacoorAbsent = staff('crew-out', 'Absent Jun', BACOOR, 'absent')
const imusCrew = staff('imus-crew', 'Imus Crew', IMUS, 'present', { clock_in_at: '08:00' })
const imusDetailer = staff('imus-det', 'Imus Detailer', IMUS, 'present', {
  role: 'detailer',
  clock_in_at: '08:00',
})

const bacoorWash = {
  id: 'sale-bacoor-wash',
  branch: BACOOR,
  status: 'paid',
  total_minor: 200_000,
  payment_method: 'cash',
  occurred_at: `${DAY}T09:30:00+08:00`,
  pos_handoff_id: 'q-bacoor-1',
  sale_line_items: [
    { name: 'Premium Car Wash', line_total_minor: 200_000, pay_category: 'wash', catalog_kind: 'service' },
  ],
}

const imusWash = {
  id: 'sale-imus-wash',
  branch: IMUS,
  status: 'paid',
  total_minor: 100_000,
  payment_method: 'gcash',
  occurred_at: `${DAY}T10:00:00+08:00`,
  pos_handoff_id: 'q-imus-1',
  sale_line_items: [
    { name: 'Express Wash', line_total_minor: 100_000, pay_category: 'wash', catalog_kind: 'service' },
  ],
}

const imusCeramic = {
  id: 'sale-imus-ceramic',
  branch: IMUS,
  status: 'paid',
  total_minor: 1_000_000,
  payment_method: 'card',
  occurred_at: `${DAY}T14:00:00+08:00`,
  booking_id: 'book-imus-1',
  assigned_staff_id: 'imus-det',
  detailer_staff_id: 'imus-det',
  sale_line_items: [
    {
      name: 'Ceramic Coating',
      line_total_minor: 1_000_000,
      pay_category: 'detailing',
      service_slug: 'ceramic-coating',
      catalog_kind: 'service',
    },
  ],
}

describe('Principal QA — clock math (naabutan nila)', () => {
  it('maps HH:MM and ISO clock-in to minutes', () => {
    assert.equal(hhmmToMinutes('08:00'), 480)
    assert.equal(hhmmToMinutes('09:00'), 540)
    assert.equal(hhmmToMinutes(`${DAY}T09:00:00+08:00`), 540)
  })

  it('on-time present keeps full weight; 60 min late on 8h shift is 7/8; absent is 0', () => {
    assert.equal(attendanceWeight('present', {}, { ...SHIFT, clock_in_at: '08:00' }), 1)
    assert.equal(attendanceWeight('late', {}, { ...SHIFT, clock_in_at: '09:00' }), 0.875)
    assert.equal(attendanceWeight('absent', {}, { ...SHIFT, clock_in_at: '10:00' }), 0)
  })

  it('uses live DB field checked_in_at (ISO) the same as clock_in_at', () => {
    assert.equal(
      attendanceWeight('late', {}, { ...SHIFT, checked_in_at: `${DAY}T09:00:00+08:00` }),
      0.875,
    )
    assert.equal(
      attendanceWeight('late', {}, { ...SHIFT, checked_in_at: `${DAY}T08:00:00+08:00` }),
      1,
    )
  })

  it('maps geo time-in UTC ISO (toISOString) to Asia/Manila wall clock, not UTC digits', () => {
    // 09:00 Manila = 01:00 UTC — naive T(\d\d) parse would yield 01:00 and overpay
    assert.equal(hhmmToMinutes(`${DAY}T01:00:00.000Z`), 540)
    assert.equal(
      attendanceWeight('late', {}, { ...SHIFT, checked_in_at: `${DAY}T01:00:00.000Z` }),
      0.875,
    )
    // 08:00 Manila = 00:00 UTC
    assert.equal(
      attendanceWeight('present', {}, { ...SHIFT, checked_in_at: `${DAY}T00:00:00.000Z` }),
      1,
    )
  })

  it('status late without any clock falls back to 0.7', () => {
    assert.equal(attendanceWeight('late', {}, { ...SHIFT }), 0.7)
  })

  it('payroll maps DB attendance rows with checked_in_at into remaining-shift weights', () => {
    const mapped = attendanceRowForPayroll(
      {
        staff_id: 'crew-late',
        branch_slug: BACOOR,
        attendance_date: DAY,
        status: 'late',
        checked_in_at: `${DAY}T09:00:00+08:00`,
        staff_profiles: { full_name: 'Late Ana', role: 'staff' },
      },
      { opens_at: '08:00', closes_at: '16:00' },
    )
    assert.equal(mapped.checked_in_at.slice(0, 13), `${DAY}T09`)
    assert.equal(attendanceWeight(mapped.status, {}, mapped), 0.875)
  })

  it('indexes operating hours per branch×weekday so multi-branch payroll does not share one shift', () => {
    const index = indexBranchOperatingHours([
      { branch_slug: BACOOR, day_of_week: 6, opens_at: '08:00', closes_at: '16:00' },
      { branch_slug: IMUS, day_of_week: 6, opens_at: '09:00', closes_at: '18:00' },
      { branch_slug: SILANG, day_of_week: 6, opens_at: '10:00', closes_at: '19:00', is_closed: true },
    ])
    const bacoorH = hoursForAttendanceDay(index, BACOOR, DAY)
    const imusH = hoursForAttendanceDay(index, IMUS, DAY)
    assert.equal(bacoorH.opens_at, '08:00')
    assert.equal(imusH.opens_at, '09:00')
    assert.equal(hoursForAttendanceDay(index, SILANG, DAY), null)

    const lateBacoor = attendanceRowForPayroll(
      { staff_id: 'a', branch_slug: BACOOR, attendance_date: DAY, status: 'late', checked_in_at: `${DAY}T09:00:00+08:00` },
      bacoorH,
    )
    const lateImus = attendanceRowForPayroll(
      { staff_id: 'b', branch_slug: IMUS, attendance_date: DAY, status: 'late', checked_in_at: `${DAY}T10:00:00+08:00` },
      imusH,
    )
    // Bacoor 08–16, in 09:00 → 7/8; Imus 09–18, in 10:00 → 8/9
    assert.equal(attendanceWeight('late', {}, lateBacoor), 0.875)
    assert.equal(Number(attendanceWeight('late', {}, lateImus).toFixed(6)), Number((8 / 9).toFixed(6)))
  })

  it('absent crew cannot be assigned a car; late still can', () => {
    assert.equal(isAssignableAttendanceStatus('absent'), false)
    assert.equal(isAssignableAttendanceStatus('late'), true)
    assert.equal(isAssignableAttendanceStatus('present'), true)
  })
})

describe('Principal QA — Bacoor vs Imus isolation + late/absent wash pool', () => {
  const attendance = [bacoorOnTime, bacoorLate, bacoorAbsent, imusCrew, imusDetailer]
  const sales = [bacoorWash, imusWash, imusCeramic]

  it('classifies wash vs coating from sale line items', () => {
    assert.equal(classifySaleBucket(bacoorWash), 'carwash')
    assert.equal(classifySaleBucket(imusCeramic), 'coating')
  })

  it('Bacoor wash pool ignores Imus sales and pays 0 to the absent crew', () => {
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales,
      attendance,
      runKind: 'floor',
    })
    const bacoorWashLines = preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === BACOOR)
    const imusWashLines = preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === IMUS)
    assert.equal(bacoorWashLines.length, 2)
    assert.equal(
      bacoorWashLines.reduce((s, l) => s + l.pay_minor, 0),
      70_000,
    )
    const onTime = bacoorWashLines.find((l) => l.staff_id === 'crew-on')
    const late = bacoorWashLines.find((l) => l.staff_id === 'crew-late')
    assert.equal(onTime.pay_minor, 37_333)
    assert.equal(late.pay_minor, 32_667)
    assert.ok(late.pay_minor < onTime.pay_minor)
    assert.equal(
      bacoorWashLines.some((l) => l.staff_id === 'crew-out'),
      false,
    )
    assert.equal(imusWashLines.length, 1)
    assert.equal(imusWashLines[0].staff_id, 'imus-crew')
    assert.equal(imusWashLines[0].pay_minor, 35_000)
  })

  it('assigned present detailer takes the detailing commission; it stays on Imus', () => {
    const ceramicDrafts = buildCeramicCompensationExpenses({
      saleId: imusCeramic.id,
      branch: IMUS,
      salesMinor: imusCeramic.total_minor,
      toggles: { freeShirt: true, cardPayment: false, detailerAssigned: true },
      assignedDetailerId: 'imus-det',
    })
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales,
      attendance,
      ceramicExpenses: ceramicDrafts,
      runKind: 'floor',
    })
    const det = preview.lines.filter((l) => l.kind === 'ceramic_detailer')
    assert.equal(det.length, 1)
    assert.equal(det[0].staff_id, 'imus-det')
    assert.equal(det[0].branch, IMUS)
    assert.equal(det[0].pay_minor, 95_000)
    assert.equal(
      preview.lines.some((l) => l.kind === 'ceramic_detailer' && l.branch === BACOOR),
      false,
    )
  })


  it('walk-in POS detailing with assigned_staff_id still pays that detailer', () => {
    const walkIn = {
      ...imusCeramic,
      id: 'sale-walkin-det',
      booking_id: null,
      assigned_staff_id: 'imus-det',
    }
    const drafts = buildCeramicCompensationExpenses({
      saleId: walkIn.id,
      branch: IMUS,
      salesMinor: walkIn.total_minor,
      toggles: { detailerAssigned: true },
      assignedDetailerId: walkIn.assigned_staff_id,
    })
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales: [walkIn],
      attendance: [imusDetailer],
      ceramicExpenses: drafts,
      runKind: 'floor',
    })
    assert.equal(preview.lines.find((l) => l.kind === 'ceramic_detailer')?.staff_id, 'imus-det')
  })

  it('solo crew (no detailer) gets 20% ceramic share; detailer line is 0', () => {
    const drafts = buildCeramicCompensationExpenses({
      saleId: 'sale-solo',
      branch: IMUS,
      salesMinor: 1_000_000,
      toggles: { freeShirt: false, cardPayment: false, detailerAssigned: false, crewAssisted: true },
    })
    const crew = drafts.find((d) => /:crew$/i.test(d.description))
    const det = drafts.find((d) => /:detailer$/i.test(d.description))
    assert.equal(crew?.total_minor, 200_000)
    assert.equal(det?.total_minor ?? 0, 0)
  })

  it('card payment applies card fee before crew/detailer split', () => {
    const drafts = buildCeramicCompensationExpenses({
      saleId: 'sale-card',
      branch: IMUS,
      salesMinor: 1_000_000,
      toggles: { freeShirt: false, cardPayment: true, detailerAssigned: true, crewAssisted: true },
      assignedDetailerId: 'imus-det',
    })
    // 3.5% card → 965_000 net; 10/10 split → 96_500 each
    const crew = drafts.find((d) => /:crew$/i.test(d.description))
    const det = drafts.find((d) => /:detailer$/i.test(d.description))
    assert.equal(crew?.total_minor, 96_500)
    assert.equal(det?.total_minor, 96_500)
  })

  it('Silang wash pool stays isolated from Bacoor and Imus', () => {
    const SILANG = 'silang'
    const silangCrew = staff('silang-crew', 'Silang Crew', SILANG, 'present', { clock_in_at: '08:00' })
    const silangWash = {
      id: 'sale-silang-wash',
      branch: SILANG,
      status: 'paid',
      total_minor: 80_000,
      occurred_at: `${DAY}T11:00:00+08:00`,
      sale_line_items: [{ line_total_minor: 80_000, services: { pay_category: 'wash' } }],
    }
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales: [bacoorWash, imusWash, silangWash],
      attendance: [bacoorOnTime, imusCrew, silangCrew],
      runKind: 'floor',
    })
    const silangLines = preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === SILANG)
    assert.equal(silangLines.length, 1)
    assert.equal(silangLines[0].pay_minor, 28_000)
    assert.equal(
      preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === BACOOR).reduce((s, l) => s + l.pay_minor, 0),
      70_000,
    )
  })
})


describe('Principal QA — close → Finance accept → payroll → books (both branches)', () => {


  it('Finance P&L does not mix Bacoor wash into Imus coating books', () => {
    const bacoorPl = rollupPl([
      { kind: 'income', amount_minor: 200_000, category: 'POS · wash' },
      { kind: 'expense', amount_minor: 70_000, category: 'Payroll · wash pool' },
      { kind: 'expense', amount_minor: 20_000, category: 'Cash advance' },
    ])
    assert.equal(bacoorPl.income, 200_000)
    assert.equal(bacoorPl.expenses, 90_000)
    assert.equal(bacoorPl.net, 110_000)

    const imusPl = rollupPl([
      { kind: 'income', amount_minor: 100_000, category: 'POS · wash' },
      { kind: 'income', amount_minor: 1_000_000, category: 'POS · coating' },
      { kind: 'expense', amount_minor: 35_000, category: 'Payroll · wash pool' },
      { kind: 'expense', amount_minor: 95_000, category: 'Payroll · crew' },
      { kind: 'expense', amount_minor: 95_000, category: 'Payroll · detailer' },
    ])
    assert.equal(imusPl.income, 1_100_000)
    assert.equal(imusPl.net, 875_000)
  })

  it('BA closes; SA finance; investor views POS but cannot open the Queue', () => {
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'pos'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'payroll'), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'finance'), true)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'queue'), false)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'pos'), true)
  })
})

describe('Principal QA — wiring scan includes booking assign + geo clock', () => {
  it('crew clock uses geo time-in; bookings assign staff; POS submits the Daily Sheet', () => {
    assert.match(read('src/pages/crew/CrewAttendancePanels.jsx'), /geoTimeIn|geofence/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /assignStaff/)
    assert.match(read('src/pages/PosPage.jsx'), /DailySheetPanel/)
    assert.match(read('src/lib/dailySheetApi.js'), /submit_daily_sheet/)
    assert.match(read('src/lib/dailySheetApi.js'), /review_daily_sheet/)
    assert.match(read('src/lib/dailySheet.js'), /buildPayrollPreview/)
    assert.match(read('src/lib/payroll.js'), /export function buildPayrollPreview/)
    assert.match(read('src/lib/dailySheet.js'), /ca_repay/)
    assert.match(read('src/lib/compensation.js'), /checked_in_at/)
  })
})
