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
  attendanceWeight,
  buildCeramicCompensationExpenses,
  hhmmToMinutes,
} from '../src/lib/compensation.js'
import {
  addPayrollAdjustment,
  applyCashAdvanceDeductions,
  buildPayrollPreview,
  buildPendingFloorPayrollQueue,
  buildRunPayrollPayload,
  floorPayrollCoversDay,
  netPayrollLinesMinor,
  payrollBlocksConfirm,
  posProofTotalsByBranchDay,
  shiftClosePayrollCoverage,
} from '../src/lib/payroll.js'
import { buildShopDaySettlementReport, shopDayShouldClose } from '../src/lib/shopDaySettlement.js'
import { moneySnapshotFromReport, validateShiftCloseSubmit } from '../src/lib/shiftClose.js'
import { rollupPl } from '../src/lib/financeData.js'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const DAY = '2026-08-22'
const BACOOR = 'bacoor'
const IMUS = 'imus'
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
const imusDetailerAbsent = staff('imus-det-out', 'No Show Detailer', IMUS, 'absent', {
  role: 'detailer',
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

  it('assigned but absent detailer gets no commission (held as missing assignee)', () => {
    const ceramicDrafts = buildCeramicCompensationExpenses({
      saleId: imusCeramic.id,
      branch: IMUS,
      salesMinor: imusCeramic.total_minor,
      toggles: { detailerAssigned: true },
      assignedDetailerId: 'imus-det-out',
    })
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales: [imusCeramic],
      attendance: [imusCrew, imusDetailerAbsent],
      ceramicExpenses: ceramicDrafts,
      runKind: 'floor',
    })
    const det = preview.lines.filter((l) => l.kind === 'ceramic_detailer')
    assert.equal(det.length, 1)
    assert.equal(det[0].missing_assignee, true)
    assert.equal(det[0].staff_id, null)
    assert.equal(payrollBlocksConfirm(preview).blocked, true)
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
})

describe('Principal QA — cash advance is a deduct, not sales', () => {
  it('SA wizard applyCashAdvanceDeductions cuts net pay; CA never funds the wash pool', () => {
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales: [bacoorWash],
      attendance: [bacoorOnTime, bacoorLate],
      runKind: 'floor',
    })
    const withCa = applyCashAdvanceDeductions(preview.lines, [
      {
        id: 'ca-1',
        status: 'approved',
        staff_id: 'crew-on',
        staff_name: 'On Time',
        branch: BACOOR,
        amount_minor: 20_000,
      },
    ])
    assert.equal(preview.lines.reduce((s, l) => s + l.pay_minor, 0), 70_000)
    assert.equal(netPayrollLinesMinor(withCa), 50_000)
    const deduct = withCa.find((l) => l.kind === 'adjustment_deduct')
    assert.equal(deduct.staff_id, 'crew-on')
    assert.equal(deduct.pay_minor, 20_000)
    assert.equal(deduct.direction, 'deduct')
  })

  it('pending / draft cash advances are ignored until approved', () => {
    const lines = addPayrollAdjustment([], {
      staff: bacoorOnTime,
      branch: BACOOR,
      direction: 'add',
      label: 'seed',
      amountMinor: 10_000,
    })
    const next = applyCashAdvanceDeductions(lines, [
      { id: 'ca-draft', status: 'pending', staff_id: 'crew-on', amount_minor: 99_000, branch: BACOOR },
    ])
    assert.equal(netPayrollLinesMinor(next), 10_000)
  })
})

describe('Principal QA — close → Finance accept → payroll → books (both branches)', () => {
  it('each branch close attests only its POS; pending floor stays per branch-day', () => {
    const bacoorReport = buildShopDaySettlementReport({
      branchSlug: BACOOR,
      date: DAY,
      sales: [bacoorWash],
      attendance: [bacoorOnTime, bacoorLate],
      rules: RULES,
      cashAdvances: [{ status: 'approved', amount_minor: 20_000, employee_name: 'On Time' }],
    })
    assert.equal(bacoorReport.car_wash_sales_minor, 200_000)
    assert.equal(bacoorReport.carwash_salary_minor, 70_000)
    const baseline = moneySnapshotFromReport(bacoorReport)
    assert.equal(
      validateShiftCloseSubmit({ baseline, submitted: { ...baseline }, reasons: {}, fieldConfig: [] }).ok,
      true,
    )
    assert.equal(
      shopDayShouldClose({ sales: [bacoorWash], expenses: [], cashAdvances: [{ amount_minor: 20_000 }] }),
      true,
    )

    const imusReport = buildShopDaySettlementReport({
      branchSlug: IMUS,
      date: DAY,
      sales: [imusWash, imusCeramic],
      attendance: [imusCrew, imusDetailer],
      rules: RULES,
    })
    assert.equal(imusReport.car_wash_sales_minor, 100_000)
    assert.notEqual(imusReport.car_wash_sales_minor, bacoorReport.car_wash_sales_minor)

    const closes = [
      { id: 'c-b', branch: BACOOR, business_date: DAY, status: 'accepted', submitted: { total_sales_minor: 200_000 } },
      { id: 'c-i', branch: IMUS, business_date: DAY, status: 'accepted', submitted: { total_sales_minor: 1_100_000 } },
    ]
    const pending = buildPendingFloorPayrollQueue({ closes, runs: [] })
    assert.equal(pending.length, 2)
    assert.deepEqual(pending.map((p) => p.branch).sort(), [BACOOR, IMUS])

    const proof = posProofTotalsByBranchDay([bacoorWash, imusWash, imusCeramic])
    assert.equal(proof.get(`${BACOOR}|${DAY}`), 200_000)
    assert.equal(proof.get(`${IMUS}|${DAY}`), 1_100_000)
  })

  it('run_payroll payload is branch-scoped; posted floor covers only that branch-day', () => {
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: RULES,
      sales: [bacoorWash],
      attendance: [bacoorOnTime, bacoorLate],
      runKind: 'floor',
    })
    const payload = buildRunPayrollPayload({
      preview,
      branch: BACOOR,
      frequency: 'daily',
      runKind: 'floor',
    })
    assert.ok(payload.sales.every((s) => s.sale_id === bacoorWash.id || s.branch === BACOOR))
    const posted = {
      run_kind: 'floor',
      status: 'paid',
      branch: BACOOR,
      period_start: DAY,
      period_end: DAY,
      payroll_run_sales: [{ branch: BACOOR, business_date: DAY, sale_id: bacoorWash.id }],
    }
    assert.equal(floorPayrollCoversDay(posted, DAY, BACOOR), true)
    assert.equal(floorPayrollCoversDay(posted, DAY, IMUS), false)
    const coverage = shiftClosePayrollCoverage(
      { branch: BACOOR, business_date: DAY, status: 'accepted' },
      [posted],
    )
    assert.equal(coverage.covered, true)
  })

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

  it('BA closes; SA payroll+finance; investor cannot open queue or POS', () => {
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'pos'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'payroll'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'finance'), true)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'queue'), false)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'pos'), false)
  })
})

describe('Principal QA — wiring scan includes booking assign + geo clock', () => {
  it('crew clock uses geo time-in; bookings assign staff; POS submits close', () => {
    assert.match(read('src/pages/crew/CrewAttendancePanels.jsx'), /geoTimeIn|geofence/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /assignStaff/)
    assert.match(read('src/pages/PosPage.jsx'), /submit_shift_close/)
    assert.match(read('src/pages/finance/FinanceShiftCloseTab.jsx'), /review_shift_close/)
    assert.match(read('src/pages/PayrollPage.jsx'), /run_payroll/)
    assert.match(read('src/lib/payroll.js'), /applyCashAdvanceDeductions/)
  })
})
