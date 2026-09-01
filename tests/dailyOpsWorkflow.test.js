/**
 * Principal QA — one branch/day from crew clock-in through Finance P&L.
 * Tracer bullets at public seams (no browser): attendance → queue/POS → EoS → payroll → books.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canUseAttendanceClock,
  canViewQueueOperations,
  canEditQueueOperations,
} from '../src/auth/permissions.js'
import { canClockAttendance, isInsideGeofence } from '../src/lib/attendanceGeo.js'
import { isAssignableAttendanceStatus } from '../src/queue/queueLogic.js'
import { buildShopDaySettlementReport, shopDayShouldClose } from '../src/lib/shopDaySettlement.js'
import {
  buildPayrollPreview,
  buildRunPayrollPayload,
  buildPendingFloorPayrollQueue,
  floorPayrollCoversDay,
  posProofTotalsByBranchDay,
  shiftClosePayrollCoverage,
} from '../src/lib/payroll.js'
import { buildCeramicCompensationExpenses } from '../src/lib/compensation.js'
import { moneySnapshotFromReport, validateShiftCloseSubmit } from '../src/lib/shiftClose.js'
import { rollupPl } from '../src/lib/financeData.js'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const DAY = '2026-08-22'
const BRANCH = 'bacoor'

const attendance = [
  {
    staff_id: 'crew-a',
    full_name: 'Alex',
    role: 'staff',
    branch_slug: BRANCH,
    attendance_date: DAY,
    status: 'present',
  },
  {
    staff_id: 'crew-b',
    full_name: 'Blake',
    role: 'staff',
    branch_slug: BRANCH,
    attendance_date: DAY,
    status: 'present',
  },
  {
    staff_id: 'tl-1',
    full_name: 'TL Kim',
    role: 'team_lead',
    branch_slug: BRANCH,
    attendance_date: DAY,
    status: 'present',
  },
]

const washSale = {
  id: 'sale-wash-1',
  branch: BRANCH,
  status: 'paid',
  total_minor: 200_000,
  payment_method: 'cash',
  occurred_at: `${DAY}T09:30:00+08:00`,
  pos_handoff_id: 'handoff-q1',
  sale_line_items: [
    { name: 'Premium Car Wash', line_total_minor: 200_000, pay_category: 'wash', catalog_kind: 'service' },
  ],
}

const ceramicSale = {
  id: 'sale-ceramic-1',
  branch: BRANCH,
  status: 'paid',
  total_minor: 1_000_000,
  payment_method: 'gcash',
  occurred_at: `${DAY}T14:00:00+08:00`,
  booking_id: 'booking-d1',
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

const ceramicDrafts = buildCeramicCompensationExpenses({
  saleId: ceramicSale.id,
  branch: BRANCH,
  salesMinor: ceramicSale.total_minor,
  toggles: { freeShirt: true, cardPayment: false, detailerAssigned: true },
  roster: attendance.filter((r) => r.role === 'staff'),
})

describe('Principal QA — daily ops RBAC gates', () => {
  it('crew/TL clock; TL manages queue; BA POS + close; SA payroll + finance', () => {
    assert.equal(canUseAttendanceClock({ role: ROLES.STAFF }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.ADMIN }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.SUPER_ADMIN }), false)

    assert.equal(canViewQueueOperations({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canEditQueueOperations({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(allowRoute({ role: ROLES.TEAM_LEAD }, 'queue'), true)
    assert.equal(allowRoute({ role: ROLES.SALES }, 'bookings'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'pos'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'payroll'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'finance'), true)
  })

  it('only present/late crew are assignable on the floor', () => {
    assert.equal(isAssignableAttendanceStatus('present'), true)
    assert.equal(isAssignableAttendanceStatus('late'), true)
    assert.equal(isAssignableAttendanceStatus('absent'), false)
  })

  it('attendance clock respects People toggles and geofence math', () => {
    assert.equal(canClockAttendance({ attendance_enabled: true }), true)
    assert.equal(canClockAttendance({ attendance_enabled: false }), false)
    const hit = isInsideGeofence({
      userLat: 14.45,
      userLng: 120.95,
      branchLat: 14.45,
      branchLng: 120.95,
      radiusM: 100,
    })
    assert.equal(hit.ok, true)
    assert.ok(typeof hit.distanceM === 'number')
  })
})

describe('Principal QA — Bacoor day: wash queue + detailing booking → paid POS', () => {
  it('classifies wash handoff vs ceramic booking into separate close buckets', () => {
    assert.equal(classifySaleBucket(washSale), 'carwash')
    assert.equal(classifySaleBucket(ceramicSale), 'coating')
  })

  it('shop-day settlement preview salary matches payroll engine (35% wash pool)', () => {
    const sales = [washSale, ceramicSale]
    const report = buildShopDaySettlementReport({
      branchSlug: BRANCH,
      branchDisplay: 'Bacoor',
      date: DAY,
      sales,
      expenses: ceramicDrafts,
      cashAdvances: [],
      attendance,
      rules: { wash_pool_pct: 35 },
    })

    assert.equal(report.salary_from_preview, true)
    assert.equal(report.wash_pool_pct, 35)
    assert.equal(report.car_wash_sales_minor, 200_000)
    assert.equal(report.ceramic_coating_sales_minor, 1_000_000)
    // 35% of 200k wash = 70k split across two present crew
    assert.equal(report.carwash_salary_minor, 70_000)
    assert.ok(report.detailer_salary_minor >= 0)

    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: { wash_pool_pct: 35 },
      sales,
      attendance,
      ceramicExpenses: ceramicDrafts,
      runKind: 'floor',
    })
    const washLines = preview.lines.filter((l) => l.kind === 'wash_pool')
    assert.equal(washLines.length, 2)
    assert.equal(washLines.reduce((s, l) => s + l.pay_minor, 0), 70_000)
    assert.equal(report.carwash_salary_minor, washLines.reduce((s, l) => s + l.pay_minor, 0))
  })

  it('end-of-shift baseline validates when attestation matches POS proof', () => {
    const sales = [washSale, ceramicSale]
    const report = buildShopDaySettlementReport({
      branchSlug: BRANCH,
      date: DAY,
      sales,
      attendance,
      rules: { wash_pool_pct: 35 },
    })
    const baseline = moneySnapshotFromReport(report)
    const submitted = { ...baseline }
    const result = validateShiftCloseSubmit({
      baseline,
      submitted,
      reasons: {},
      fieldConfig: [{ field_key: 'total_gcash_minor', allow_override: true, is_active: true }],
    })
    assert.equal(result.ok, true)
    assert.equal(shopDayShouldClose({ sales, expenses: [], cashAdvances: [] }), true)
  })
})

describe('Principal QA — Finance accept → payroll confirm → books', () => {
  it('pending floor queue surfaces accepted close until floor run posts', () => {
    const close = {
      id: 'close-1',
      branch: BRANCH,
      business_date: DAY,
      status: 'accepted',
      submitted: { total_sales_minor: 1_200_000, square_sales_minor: 1_200_000 },
    }
    const pending = buildPendingFloorPayrollQueue({ closes: [close], runs: [] })
    assert.equal(pending.length, 1)
    assert.equal(pending[0].branch, BRANCH)
    assert.equal(pending[0].business_date, DAY)

    const proof = posProofTotalsByBranchDay([washSale, ceramicSale])
    assert.equal(proof.get(`${BRANCH}|${DAY}`), 1_200_000)

    const coverageBefore = shiftClosePayrollCoverage(close, [])
    assert.equal(coverageBefore.covered, false)
    assert.match(coverageBefore.label, /pending confirm/i)

    const postedRun = {
      run_kind: 'floor',
      status: 'paid',
      branch: BRANCH,
      period_start: DAY,
      period_end: DAY,
      payroll_run_sales: [{ branch: BRANCH, business_date: DAY, sale_id: washSale.id }],
    }
    assert.equal(floorPayrollCoversDay(postedRun, DAY, BRANCH), true)
    const coverageAfter = shiftClosePayrollCoverage(close, [postedRun])
    assert.equal(coverageAfter.covered, true)
  })

  it('run_payroll payload claims wash proof; Finance P&L income equals paid sales', () => {
    const preview = buildPayrollPreview({
      period: { start: DAY, end: DAY },
      rules: { wash_pool_pct: 35 },
      sales: [washSale],
      attendance,
      runKind: 'floor',
    })
    const payload = buildRunPayrollPayload({
      preview,
      branch: BRANCH,
      frequency: 'daily',
      runKind: 'floor',
    })
    assert.equal(payload.sales[0].sale_id, washSale.id)
    assert.equal(payload.sales[0].wash_pool_minor, 200_000)
    assert.equal(payload.lines.reduce((s, l) => s + l.amount_minor, 0), 70_000)

    const plRows = [
      { kind: 'income', amount_minor: 200_000, category: 'POS · wash' },
      { kind: 'income', amount_minor: 1_000_000, category: 'POS · coating' },
      { kind: 'expense', amount_minor: 70_000, category: 'Payroll · wash pool' },
    ]
    const pl = rollupPl(plRows)
    assert.equal(pl.income, 1_200_000)
    assert.equal(pl.expenses, 70_000)
    assert.equal(pl.net, 1_130_000)
  })
})

describe('Principal QA — wiring scan (pages + RPCs exist)', () => {
  it('daily ops surfaces chain attendance → queue → POS → Finance shift tab → Payroll', () => {
    assert.match(read('src/pages/crew/CrewAttendancePanels.jsx'), /geoTimeIn|geofence/)
    assert.match(read('src/pages/OperationsPages.jsx'), /queue/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /assignStaff/)
    assert.match(read('src/pages/PosPage.jsx'), /submit_shift_close|ShiftCloseWizard/)
    assert.match(read('src/pages/finance/FinanceShiftCloseTab.jsx'), /review_shift_close/)
    assert.match(read('src/pages/PayrollPage.jsx'), /buildPendingFloorPayrollQueue|run_payroll/)
    assert.match(read('src/pages/FinancePage.jsx'), /finance_daily_pl/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /booking_status|detailing/)
  })
})
