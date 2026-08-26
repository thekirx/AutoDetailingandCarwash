import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildShopDaySettlementReport,
  shopDayShouldClose,
} from '../src/lib/shopDaySettlement.js'
import { buildRunPayrollPayload, buildPayrollPreview } from '../src/lib/payroll.js'
import { buildShiftCloseAcceptCopy } from '../server/notifyShiftClose.mjs'

describe('shop day settlement + money contract continue', () => {
  it('builds report with attendance-split wash salary from preview', () => {
    const report = buildShopDaySettlementReport({
      branchSlug: 'bacoor',
      branchDisplay: 'Bacoor',
      date: '2026-08-22',
      sales: [
        {
          id: 's1',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 100000,
          payment_method: 'cash',
          occurred_at: '2026-08-22T10:00:00+08:00',
          sale_line_items: [
            { name: 'Wash', line_total_minor: 100000, catalog_kind: 'service', pay_category: 'wash' },
          ],
        },
      ],
      expenses: [],
      cashAdvances: [],
      attendance: [
        {
          staff_id: 'a1',
          full_name: 'Alex',
          role: 'crew',
          branch_slug: 'bacoor',
          attendance_date: '2026-08-22',
          status: 'present',
        },
        {
          staff_id: 'b1',
          full_name: 'Blake',
          role: 'crew',
          branch_slug: 'bacoor',
          attendance_date: '2026-08-22',
          status: 'present',
        },
      ],
      rules: { wash_pool_pct: 35 },
    })
    assert.equal(report.salary_from_preview, true)
    assert.equal(report.wash_pool_pct, 35)
    assert.ok(report.carwash_salary_minor > 0)
    // 35% of 100000 = 35000 split across two present
    assert.equal(report.carwash_salary_minor, 35000)
  })

  it('shopDayShouldClose mirrors activity gate', () => {
    assert.equal(shopDayShouldClose({ sales: [], expenses: [], cashAdvances: [] }), false)
    assert.equal(
      shopDayShouldClose({
        sales: [{ status: 'paid', total_minor: 1 }],
        expenses: [],
        cashAdvances: [],
      }),
      true,
    )
  })

  it('buildRunPayrollPayload preserves package_fixed / package_hybrid kinds', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-01', end: '2026-08-15' },
      rules: { wash_pool_pct: 35 },
      sales: [],
      attendance: [],
      packages: [
        {
          staff_id: 'p1',
          staff_name: 'Pat',
          branch: 'bacoor',
          package_kind: 'fixed',
          amount_minor: 1500000,
          label: 'Fixed package',
        },
        {
          staff_id: 'p2',
          staff_name: 'Quin',
          branch: 'bacoor',
          package_kind: 'hybrid',
          amount_minor: 800000,
          label: 'Hybrid package',
        },
      ],
      runKind: 'fixed',
    })
    const payload = buildRunPayrollPayload({
      preview,
      branch: 'bacoor',
      frequency: 'semimonthly',
      runKind: 'fixed',
    })
    const kinds = payload.lines.map((l) => l.kind).sort()
    assert.deepEqual(kinds, ['package_fixed', 'package_hybrid'])
  })

  it('shift-close accept push copy targets payroll pending', () => {
    const copy = buildShiftCloseAcceptCopy({
      branch: 'bacoor',
      businessDate: '2026-08-22',
      closeId: 'c1',
    })
    assert.equal(copy.kind, 'payroll.pending_floor')
    assert.match(copy.title, /Floor pay ready/i)
    assert.equal(copy.url, '/operations/payroll')
    assert.equal(copy.tag, 'shift_close:c1')
  })
})
