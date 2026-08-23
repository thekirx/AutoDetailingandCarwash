import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAdminRoster } from '../src/lib/floorBoardRoster.js'
import { aggregateSalesFinancials, classifyFloorSaleBucket } from '../src/lib/paymentMethods.js'
import {
  splitWashPool,
  computeCeramicPay,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
  compensationExpenseKey,
  buildDailyCompensationExpense,
  findPostedCompensationExpense,
  buildCompensationPostPlan,
} from '../src/lib/compensation.js'
import { approvedCaForCloseDay, buildBacoorDailyReport } from '../src/lib/bacoorDailyReport.js'
import { topCustomersBySpend, insightsToCsv } from '../src/lib/crmInsightsExport.js'
import { DETAILING_BOARD_STATUSES, detailingBoardStatusLabel } from '../src/lib/detailingBoardStatuses.js'

describe('floor board roster + financials', () => {
  it('groups admin roster with hover names', () => {
    const roster = buildAdminRoster([
      { role: 'marketing', full_name: 'Mia', is_active: true },
      { role: 'team_lead', full_name: 'Ty', is_active: true },
      { role: 'admin', full_name: 'Ada', is_active: true },
    ])
    const marketing = roster.find((g) => g.role === 'marketing')
    assert.equal(marketing.count, 1)
    assert.deepEqual(marketing.names, ['Mia'])
  })

  it('splits queue carwash vs counter buckets', () => {
    assert.equal(classifyFloorSaleBucket({ booking_id: '1', pay_category: 'wash' }), 'carwash')
    assert.equal(classifyFloorSaleBucket({ booking_id: '2', pay_category: 'detailing' }), 'detailing')
    assert.equal(classifyFloorSaleBucket({ product_tags: ['coffee'] }), 'coffee')
    const fin = aggregateSalesFinancials([
      { status: 'paid', total_minor: 1000, booking_id: 'a', pay_category: 'wash', payment_method: 'cash' },
      { status: 'paid', total_minor: 500, pay_category: 'detailing', payment_method: 'gcash' },
      { status: 'paid', total_minor: 200, product_tags: ['coffee'], payment_method: 'cash' },
    ])
    assert.equal(fin.queue_sales_minor, 1000)
    assert.equal(fin.detailing_sales_minor, 500)
    assert.equal(fin.coffee_sales_minor, 200)
    assert.equal(fin.pos_sales_minor, 700)
  })

  it('delegates floor buckets to posSellables classifier', async () => {
    const { classifySaleBucket, posBucketToBacoor } = await import('../src/lib/posSellables.js')
    const row = { booking_id: 'b1', pay_category: 'wash', service_name: 'Carwash' }
    const posBucket = classifySaleBucket({
      itemType: 'service',
      payCategory: row.pay_category,
      serviceName: row.service_name,
    })
    assert.equal(posBucket, 'car_wash')
    assert.equal(classifyFloorSaleBucket(row), 'carwash')
    assert.equal(posBucketToBacoor(posBucket), 'carwash')
  })
})

describe('compensation engine', () => {
  it('splits wash pool by attendance weight', () => {
    const { pool_minor, rows } = splitWashPool({
      totalSalesMinor: 2000000,
      poolPct: 35,
      roster: [
        { staff_id: '1', attendance_status: 'present' },
        { staff_id: '2', attendance_status: 'late' },
      ],
    })
    assert.equal(pool_minor, 700000)
    assert.equal(rows.length, 2)
    assert.ok(rows[0].pay_minor > rows[1].pay_minor)
  })

  it('computes ceramic pay with shirt + card + detailer split', () => {
    const result = computeCeramicPay({
      salesMinor: 1000000,
      toggles: { freeShirt: true, cardPayment: true, detailerAssigned: true },
    })
    assert.ok(result.remaining_minor < 1000000 - 50000)
    assert.equal(result.crew_pct, 10)
    assert.equal(result.detailer_pct, 10)
  })

  it('maps live scalar compensation_settings columns (not a rules json blob)', () => {
    const rules = normalizeCompensationSettings({
      id: 1,
      wash_pool_pct: 40,
      ceramic_shirt_deduction_minor: 25000,
      ceramic_card_fee_pct: 2.5,
      ceramic_crew_solo_pct: 15,
      ceramic_crew_split_pct: 8,
      ceramic_detailer_split_pct: 12,
    })
    assert.equal(rules.wash_pool_pct, 40)
    assert.equal(rules.ceramic_shirt_deduction_minor, 25000)
    assert.deepEqual(toCompensationSettingsRow(rules), {
      id: 1,
      wash_pool_pct: 40,
      ceramic_shirt_deduction_minor: 25000,
      ceramic_card_fee_pct: 2.5,
      ceramic_crew_solo_pct: 15,
      ceramic_crew_split_pct: 8,
      ceramic_detailer_split_pct: 12,
      payout_frequency: 'semimonthly',
      payout_weekday: 5,
      attendance_present_weight: 1,
      attendance_late_weight: 0.7,
      pending_floor_optional: false,
      cash_advance_auto_deduct: false,
    })
    assert.equal(normalizeCompensationSettings(null).wash_pool_pct, 35)
  })

  it('builds an idempotent salary_carwash expense draft for Finance', () => {
    const draft = buildDailyCompensationExpense({
      date: '2026-08-13',
      branch: 'bacoor',
      poolMinor: 700000,
      crewCount: 3,
    })
    assert.equal(draft.expense_kind, 'salary_carwash')
    assert.equal(draft.branch, 'bacoor')
    assert.equal(draft.total_minor, 700000)
    assert.equal(draft.unit_cost_minor, 700000)
    assert.equal(draft.quantity, 1)
    assert.equal(draft.status, 'draft')
    assert.equal(draft.description, compensationExpenseKey({ date: '2026-08-13', branch: 'bacoor' }))
    assert.match(draft.title, /2026-08-13/)
    assert.match(draft.title, /bacoor/)
    assert.equal(
      findPostedCompensationExpense(
        [{ description: 'compensation:bacoor:2026-08-13', total_minor: 700000 }],
        { date: '2026-08-13', branch: 'bacoor' },
      )?.total_minor,
      700000,
    )
    assert.equal(
      findPostedCompensationExpense([], { date: '2026-08-13', branch: 'bacoor' }),
      null,
    )
    assert.equal(buildDailyCompensationExpense({ date: '2026-08-13', branch: 'bacoor', poolMinor: 0 }), null)
  })

  it('builds per-branch salary drafts, keeps late weight, skips already posted', () => {
    const plan = buildCompensationPostPlan({
      date: '2026-08-13',
      poolPct: 35,
      salesRows: [
        { branch: 'bacoor', total_minor: 2000000 },
        { branch: 'imus', total_minor: 1000000 },
      ],
      roster: [
        { id: '1', full_name: 'Ann', branch_slug: 'bacoor', is_present_today: true, attendance_status: 'present' },
        { id: '2', full_name: 'Ben', branch_slug: 'bacoor', is_present_today: true, attendance: { status: 'late' } },
        { id: '3', full_name: 'Cara', branch_slug: 'imus', is_present_today: true, attendance_status: 'present' },
      ],
      posted: [{ description: 'compensation:imus:2026-08-13' }],
    })
    assert.equal(plan.totalSales, 3000000)
    assert.equal(plan.pool_minor, 1050000)
    const bacoor = plan.rows.filter((r) => r.branch === 'bacoor')
    assert.equal(bacoor.length, 2)
    const ann = bacoor.find((r) => r.full_name === 'Ann')
    const ben = bacoor.find((r) => r.full_name === 'Ben')
    assert.ok(ann.pay_minor > ben.pay_minor)
    assert.equal(plan.pending.length, 1)
    assert.equal(plan.pending[0].branch, 'bacoor')
    assert.equal(plan.pending[0].total_minor, 700000)
    assert.equal(plan.pending[0].expense_kind, 'salary_carwash')
  })
})

describe('bacoor report + crm export', () => {
  it('builds bacoor daily report fields', () => {
    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      date: '2026-08-11',
      sales: [
        { status: 'paid', total_minor: 1078000, payment_method: 'cash', booking_id: '1', service_name: 'Wash' },
        { status: 'paid', total_minor: 62000, payment_method: 'gcash', service_name: 'Coffee' },
      ],
      expenses: [{ expense_kind: 'salary_carwash', amount_minor: 377300, label: 'Carwash Salary' }],
    })
    assert.equal(report.car_wash_sales_minor, 1078000)
    assert.equal(report.refreshment_sales_minor, 62000)
    assert.equal(report.carwash_salary_minor, 377300)
  })

  it('counts cash advances on the approve day, not the submit day', () => {
    const overnight = {
      status: 'resolved',
      created_at: '2026-08-15T22:10:00+08:00',
      resolved_at: '2026-08-16T09:05:00+08:00',
    }
    assert.equal(approvedCaForCloseDay(overnight, '2026-08-16'), true)
    assert.equal(approvedCaForCloseDay(overnight, '2026-08-15'), false)
    assert.equal(
      approvedCaForCloseDay({ status: 'new', created_at: '2026-08-16T08:00:00+08:00' }, '2026-08-16'),
      false,
    )
  })

  it('exports top customers csv', () => {
    const top = topCustomersBySpend([
      { status: 'paid', customer_id: 'c1', customer_name: 'Ann', total_minor: 500 },
      { status: 'paid', customer_id: 'c1', customer_name: 'Ann', total_minor: 300 },
      { status: 'paid', customer_id: 'c2', customer_name: 'Bob', total_minor: 100 },
    ])
    assert.equal(top[0].name, 'Ann')
    assert.equal(top[0].total_minor, 800)
    const csv = insightsToCsv(top, [
      { key: 'name', label: 'Name' },
      { key: 'total_minor', label: 'Spend' },
    ])
    assert.match(csv, /Name,Spend/)
    assert.match(csv, /Ann,800/)
  })
})

describe('detailing status labels', () => {
  it('uses owner pipeline names', () => {
    assert.equal(detailingBoardStatusLabel('waiting'), 'Vehicle intake')
    assert.equal(detailingBoardStatusLabel('for_releasing'), 'For releasing')
    assert.ok(DETAILING_BOARD_STATUSES.some((s) => s.id === 'for_payment'))
    assert.ok(DETAILING_BOARD_STATUSES.every((s) => String(s.tone || '').startsWith('is-')))
    assert.ok(!DETAILING_BOARD_STATUSES.some((s) => /border-l-/.test(s.tone || '')))
  })
})
