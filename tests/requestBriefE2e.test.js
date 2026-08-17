/**
 * Principal QA contract for request.md — public seams only.
 * Helpers + UI wiring + RBAC. Live portal/RLS lives in scripts/e2e-request-brief.mjs.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  allowRoute,
  canAccessReviews,
  canMarkFailedQa,
  getOperationsNav,
  getVideoEditorDock,
  getDetailerDock,
  redirectForRole,
  ROLES,
} from '../src/auth/permissions.js'
import { buildAdminRoster, ADMIN_ROSTER_GROUPS } from '../src/lib/floorBoardRoster.js'
import { plannerTabsForAccess } from '../src/lib/plannerBoard.js'
import { DETAILING_BOARD_STATUSES } from '../src/lib/detailingBoardStatuses.js'
import { buildBacoorDailyReport, formatBacoorReportText } from '../src/lib/bacoorDailyReport.js'
import { splitWashPool, computeCeramicPay, DEFAULT_COMPENSATION_RULES } from '../src/lib/compensation.js'
import { bookingSalesTotal, aggregateLineItemsByFamily } from '../src/lib/crmInsights.js'
import { topCustomersBySpend, insightsToCsv } from '../src/lib/crmInsightsExport.js'
import { failedQaCount, averageCycleMinutes, averageWaitMinutes, kpiStatHover } from '../src/lib/kpiPart8.js'
import { PAYMENT_METHODS } from '../src/lib/paymentMethods.js'
import { MERCH_FAMILIES } from '../src/lib/posSellables.js'
import { shareOfTotal } from '../src/lib/financeData.js'
import {
  buildCompletedVisitReview,
  VISIT_REVIEW_AXES,
} from '../src/lib/serviceReviews.js'
import { isValidCustomerPlate, safeVehiclePhotoUrl } from '../src/lib/customerAuth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('request.md floor + people', () => {
  it('renames wash roster and lists admin tiles with hover names', () => {
    const floor = read('src/pages/SuperAdminFloorBoard.jsx')
    assert.match(floor, /Carwash crew on shift/)
    assert.match(floor, /Detailing operations summary/)
    assert.match(floor, /group-hover:block/)
    assert.deepEqual(
      ADMIN_ROSTER_GROUPS.map((g) => g.label),
      ['Marketing', 'Video editor', 'Branch Admin', 'ASA', 'Team Lead'],
    )
    const tiles = buildAdminRoster([
      { role: 'marketing', full_name: 'Mika Santos', is_active: true },
      { role: 'video_editor', full_name: 'Rico Films', is_active: true },
    ])
    assert.deepEqual(tiles.find((t) => t.role === 'marketing').names, ['Mika Santos'])
    assert.deepEqual(tiles.find((t) => t.role === 'video_editor').names, ['Rico Films'])
  })

  it('People create form toggles attendance, geofence, and on-call', () => {
    const people = read('src/pages/PeopleManagePage.jsx')
    assert.match(people, /attendance_enabled/)
    assert.match(people, /geofence_enabled/)
    assert.match(people, /on_call/)
    assert.match(people, /permanent/)
    assert.match(people, /detailer/)
    assert.match(people, /video_editor/)
    assert.match(people, /investor/)
  })
})

describe('request.md roles + planner', () => {
  it('detailer, video editor, investor homes and docks', () => {
    assert.equal(redirectForRole(ROLES.DETAILER), '/operations/queue?family=detailing')
    assert.equal(redirectForRole(ROLES.VIDEO_EDITOR), '/operations/planning?tab=calendar')
    assert.equal(redirectForRole(ROLES.INVESTOR), '/operations/finance')
    assert.ok(getDetailerDock({ role: ROLES.DETAILER }).some((i) => i.to.includes('family=detailing')))
    assert.deepEqual(
      getVideoEditorDock({ role: ROLES.VIDEO_EDITOR }).map((i) => i.label),
      ['Calendar', 'Tasks'],
    )
    const investorNav = getOperationsNav({ role: ROLES.INVESTOR })
    assert.deepEqual(
      investorNav.map((i) => i.to),
      ['/operations/finance', '/operations/reports'],
    )
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'people'), false)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'pos'), false)
  })

  it('video editor planner tabs are Tasks + Calendar only', () => {
    const tabs = plannerTabsForAccess({ canEdit: false, role: 'video_editor' })
    assert.deepEqual(
      tabs.map((t) => t.id),
      ['board', 'calendar'],
    )
    const board = read('src/pages/PlanningBoardPage.jsx')
    assert.match(board, /plannerTabsForAccess/)
    assert.match(board, /proof|for_review/)
  })
})

describe('request.md detailing pipeline + Failed QA', () => {
  it('pipeline labels match the owner brief', () => {
    assert.deepEqual(
      DETAILING_BOARD_STATUSES.map((s) => s.label),
      [
        'Booking Placeholder',
        'Assign to branch',
        'Vehicle intake',
        'In progress',
        'Final checking',
        'For releasing',
        'For payment',
        'Completed',
      ],
    )
  })

  it('TL can Failed QA; sales cannot; apology copy is editable', () => {
    assert.equal(canMarkFailedQa({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canMarkFailedQa({ role: ROLES.SALES }), false)
    const copy = read('src/lib/notificationTemplates.js')
    assert.match(copy, /booking\.redo\.customer/)
    assert.match(copy, /We are sorry/)
    const editor = read('src/components/QueueTicketEditor.jsx')
    assert.match(editor, /Failed QA/)
  })

  it('KPI hover includes failed QA, wait, and cycle', () => {
    const bookings = [
      {
        status: 'completed',
        waiting_at: '2026-08-17T01:00:00Z',
        in_progress_at: '2026-08-17T01:10:00Z',
        completed_at: '2026-08-17T01:40:00Z',
        redo_at: '2026-08-17T01:20:00Z',
      },
    ]
    assert.equal(failedQaCount(bookings), 1)
    assert.equal(averageWaitMinutes(bookings), 10)
    assert.equal(averageCycleMinutes(bookings), 30)
    const hover = kpiStatHover(bookings, { salesTotal: 100, complaintsCount: 0 })
    assert.ok(hover.failedQa.lines.length > 0)
    const kpi = read('src/pages/KpiPage.jsx')
    assert.match(kpi, /kpiStatHover/)
  })
})

describe('request.md money + POS + Bacoor', () => {
  it('payment methods and merch families', () => {
    assert.deepEqual(
      PAYMENT_METHODS.map((m) => m.value),
      ['cash', 'gcash', 'card'],
    )
    assert.ok(MERCH_FAMILIES.some((f) => f.id === 'coffee'))
    assert.ok(MERCH_FAMILIES.some((f) => f.id === 'accessories'))
    assert.ok(MERCH_FAMILIES.some((f) => f.id === 'clothing'))
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /cash-advance/)
    assert.match(pos, /salary_carwash/)
    assert.match(pos, /salary_detailer/)
    assert.match(pos, /pending/)
  })

  it('finance hover percent is a real share, not a hardcoded 50', () => {
    assert.deepEqual(shareOfTotal(2500, 10000), { value: 2500, percent: 25 })
    const finance = read('src/pages/finance/FinanceOverviewTab.jsx')
    assert.match(finance, /shareOfTotal/)
  })

  it('Bacoor close text matches the paper sections with known amounts', () => {
    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      date: '2026-08-17',
      sales: [
        { status: 'paid', total_minor: 1078000, payment_method: 'cash', booking_id: 'w1', service_name: 'Wash' },
        { status: 'paid', total_minor: 62000, payment_method: 'gcash', service_name: 'Coffee' },
        { status: 'paid', total_minor: 22000, payment_method: 'cash', service_name: 'Accessories' },
      ],
      expenses: [
        { expense_kind: 'salary_carwash', amount_minor: 377300, label: 'Carwash Salary' },
        { expense_kind: 'daily', amount_minor: 2000, label: 'ice' },
      ],
      cashAdvances: [{ status: 'approved', amount_minor: 50000, employee_name: 'Darel' }],
    })
    assert.equal(report.queue_app_sales_minor, 1078000)
    assert.equal(report.car_wash_sales_minor, 1078000)
    assert.equal(report.refreshment_sales_minor, 62000)
    assert.equal(report.car_accessories_minor, 22000)
    assert.equal(report.carwash_salary_minor, 377300)
    const text = formatBacoorReportText(report, (n) => String(n))
    assert.match(text, /Queue App Sales: 1078000/)
    assert.match(text, /Refreshment Sales: 62000/)
    assert.match(text, /Darel-50000/)
    assert.match(text, /ice-2000/)
    assert.match(text, /Cash Advance Payment/)
  })
})

describe('request.md compensation', () => {
  it('wash pool 35% splits present vs late 1.0 / 0.7', () => {
    assert.equal(DEFAULT_COMPENSATION_RULES.wash_pool_pct, 35)
    const { pool_minor, rows } = splitWashPool({
      totalSalesMinor: 2000000,
      poolPct: 35,
      roster: [
        { staff_id: 'a', attendance_status: 'present' },
        { staff_id: 'b', attendance_status: 'late' },
      ],
    })
    assert.equal(pool_minor, 700000)
    assert.equal(rows.find((r) => r.staff_id === 'a').pay_minor, 411765)
    assert.equal(rows.find((r) => r.staff_id === 'b').pay_minor, 288235)
  })

  it('ceramic: shirt 500 + 3.5% card, then 20% solo or 10/10 split', () => {
    const base = { salesMinor: 1000000, toggles: { freeShirt: true, cardPayment: true } }
    const solo = computeCeramicPay({ ...base, toggles: { ...base.toggles, detailerAssigned: false } })
    assert.equal(solo.remaining_minor, 916750)
    assert.equal(solo.crew_pct, 20)
    assert.equal(solo.crew_minor, 183350)
    assert.equal(solo.detailer_minor, 0)
    const split = computeCeramicPay({ ...base, toggles: { ...base.toggles, detailerAssigned: true } })
    assert.equal(split.crew_pct, 10)
    assert.equal(split.detailer_pct, 10)
    assert.equal(split.crew_minor, 91675)
    assert.equal(split.detailer_minor, 91675)
  })
})

describe('request.md CRM insights', () => {
  it('top 20, booking sales, wash vs detailing, CSV', () => {
    const sales = [
      { status: 'paid', customer_name: 'Liza Cruz', total_minor: 50000, sale_id: '1', booking_id: 'b1' },
      { status: 'paid', customer_name: 'Liza Cruz', total_minor: 25000, sale_id: '2', booking_id: 'b2' },
      { status: 'paid', customer_name: 'Paolo Reyes', total_minor: 10000, sale_id: '3' },
    ]
    const top = topCustomersBySpend(sales, 20)
    assert.equal(top[0].name, 'Liza Cruz')
    assert.equal(top[0].total_minor, 75000)
    assert.equal(bookingSalesTotal(sales), 75000)
    const families = aggregateLineItemsByFamily([
      { name: 'Premium Wash', pay_category: 'wash', line_total_minor: 40000, quantity: 1 },
      { name: 'Ceramic Coating', pay_category: 'detailing', line_total_minor: 90000, quantity: 1 },
    ])
    assert.equal(families.wash[0].total_minor, 40000)
    assert.equal(families.detailing[0].total_minor, 90000)
    const csv = insightsToCsv(top, [
      { key: 'name', label: 'Name' },
      { key: 'total_minor', label: 'Spend' },
    ])
    assert.match(csv, /Name,Spend/)
    assert.match(csv, /Liza Cruz,75000/)
    const panel = read('src/pages/CrmInsightsPanel.jsx')
    assert.match(panel, /Top 20 customers/)
    assert.match(panel, /Top detailing/)
    assert.match(panel, /bookingSalesTotal/)
    assert.match(panel, /downloadCsv/)
  })
})

describe('request.md reviews + garage', () => {
  it('requires four axes and wires customer + ops pages', () => {
    assert.deepEqual(
      VISIT_REVIEW_AXES.map((a) => a.label),
      ['Overall', 'App', 'Services / packages', 'Detailing'],
    )
    assert.deepEqual(buildCompletedVisitReview({ overall: 5, app: 4, service: 5, detailing: 3 }, '  ok  '), {
      overall_rating: 5,
      app_rating: 4,
      service_rating: 5,
      detailing_rating: 3,
      comment: 'ok',
    })
    assert.equal(buildCompletedVisitReview({ overall: 5, app: 4, service: 5 }, ''), null)
    const home = read('src/pages/CustomerAccountPage.jsx')
    const reviews = read('src/pages/ReviewsPage.jsx')
    const css = read('src/styles-customer-app.css')
    const app = read('src/App.jsx')
    assert.match(home, /buildCompletedVisitReview/)
    assert.match(home, /VISIT_REVIEW_AXES/)
    assert.match(reviews, /VISIT_REVIEW_AXES/)
    assert.match(css, /min-width: 44px/)
    assert.match(app, /path="reviews"/)
    assert.equal(canAccessReviews({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canAccessReviews({ role: ROLES.ADMIN }), true)
    assert.equal(canAccessReviews({ role: ROLES.STAFF }), false)
  })

  it('plate letters+digits and http(s) photo on portal + garage UI', () => {
    assert.equal(isValidCustomerPlate('ABC 1234'), true)
    assert.equal(isValidCustomerPlate('847291'), true)
    assert.equal(isValidCustomerPlate('TMP 1234'), true)
    assert.equal(isValidCustomerPlate('AAA'), false)
    assert.equal(safeVehiclePhotoUrl('https://cdn.example.com/car.jpg'), 'https://cdn.example.com/car.jpg')
    assert.equal(safeVehiclePhotoUrl('javascript:alert(1)'), null)
    const portal = read('server/customerPortal.mjs')
    const garage = read('src/components/CustomerSettingsModal.jsx')
    const tl = read('src/pages/OperationsPages.jsx')
    const identity = read('src/lib/queueCustomerName.js')
    const book = read('server/publicBook.mjs')
    assert.match(portal, /isValidCustomerPlate/)
    assert.match(portal, /safeVehiclePhotoUrl/)
    assert.match(garage, /isValidCustomerPlate/)
    assert.match(garage, /safeVehiclePhotoUrl/)
    assert.match(garage, /Upload photo/)
    assert.match(tl, /plateValidationError/)
    assert.match(identity, /plateValidationError/)
    assert.match(book, /plateValidationError/)
    const plateSql = read('supabase/migrations/20260817061825_plate_lookup_indexes.sql')
    assert.match(plateSql, /normalize_plate_number/)
    assert.match(plateSql, /bookings_normalized_plate_created_idx/)
    assert.match(plateSql, /bookings_vehicle_id_created_idx/)
  })
})
