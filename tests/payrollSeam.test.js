/**
 * Payroll public seams:
 * - payrollPeriodRange / buildPayrollPreview / adjustPayrollLine / payrollBlocksConfirm
 * - POS sale ids as payout proof
 * - Daily Sheet RBAC that replaced Payroll / My pay
 * - run_payroll migration history (source scan)
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FIXED_SALARY_BOOKS_BRANCH, buildPayrollPreview, prorateMonthlyPackageMinor } from '../src/lib/payroll.js'
import {
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '../src/lib/compensation.js'
import {
  ROLES,
  allowRoute,
  canEditFinanceBooks,
  getOperationsNav,
  getStaffDock,
} from '../src/auth/permissions.js'
import { canEditDailySheet, canReviewDailySheet } from '../src/lib/dailySheet.js'

describe('payroll preview from POS + attendance', () => {
  const ty = { id: 'staff-ty', full_name: 'Ty', role: 'staff', branch_slug: 'bacoor' }
  const jen = { id: 'staff-jen', full_name: 'Jen', role: 'staff', branch_slug: 'bacoor' }

  it('splits wash pool from paid POS sales and skips detailing + already-claimed sales', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-wash',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 100000,
          occurred_at: '2026-08-19T10:00:00+08:00',
          sale_line_items: [{ line_total_minor: 100000, services: { pay_category: 'wash' } }],
        },
        {
          id: 'sale-detail',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 500000,
          occurred_at: '2026-08-19T11:00:00+08:00',
          sale_line_items: [{ line_total_minor: 500000, pay_category: 'detailing' }],
        },
        {
          id: 'sale-old',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 80000,
          occurred_at: '2026-08-19T09:00:00+08:00',
        },
      ],
      attendance: [
        { ...ty, attendance_date: '2026-08-19', status: 'present' },
        { ...jen, attendance_date: '2026-08-19', status: 'present' },
      ],
      claimedSaleIds: ['sale-old'],
    })
    assert.equal(preview.pos_sales_minor, 100000)
    assert.equal(preview.proof.find((p) => p.sale_id === 'sale-wash')?.wash_pool_minor, 100000)
    assert.equal(preview.proof.some((p) => p.sale_id === 'sale-old'), false)
    assert.equal(preview.proof.some((p) => p.sale_id === 'sale-detail'), false)
    const wash = preview.lines.filter((l) => l.kind === 'wash_pool')
    assert.equal(wash.length, 2)
    assert.equal(wash.reduce((s, l) => s + l.pay_minor, 0), 35000)
    assert.equal(wash[0].pay_minor, 17500)
  })

})

describe('payroll compensation settings persist frequency', () => {
  it('normalizes payout_frequency and weekday onto the singleton row', () => {
    const n = normalizeCompensationSettings({
      wash_pool_pct: 40,
      payout_frequency: 'biweekly',
      payout_weekday: 5,
    })
    assert.equal(n.payout_frequency, 'biweekly')
    assert.equal(n.payout_weekday, 5)
    const row = toCompensationSettingsRow(n)
    assert.equal(row.payout_frequency, 'biweekly')
    assert.equal(row.payout_weekday, 5)
    assert.equal(row.wash_pool_pct, 40)
    assert.equal(normalizeCompensationSettings({ payout_frequency: 'nope' }).payout_frequency, 'semimonthly')
  })
})

describe('crew pay RBAC after the Daily Sheet', () => {
  it('BA submits the sheet; SA / ASA finance_view approve; only finance_write edits books', () => {
    const sa = { role: ROLES.SUPER_ADMIN }
    const asaWrite = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: true, finance_write: true } }
    const asaView = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: true, finance_write: false } }
    const asaNone = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: false, finance_write: false } }
    const staff = { role: ROLES.STAFF, branch_slug: 'bacoor' }
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }

    assert.equal(canReviewDailySheet(sa), true)
    assert.equal(canEditFinanceBooks(sa), true)
    assert.equal(canReviewDailySheet(asaWrite), true)
    assert.equal(canEditFinanceBooks(asaWrite), true)
    assert.equal(canReviewDailySheet(asaView), true)
    assert.equal(canEditFinanceBooks(asaView), false)
    assert.equal(canReviewDailySheet(asaNone), false)

    assert.equal(canEditDailySheet(ba), true)
    assert.equal(canReviewDailySheet(ba), false)
    assert.equal(canEditFinanceBooks(ba), false)
    assert.equal(canEditDailySheet(staff), false)
    assert.equal(canReviewDailySheet(staff), false)

    for (const p of [sa, asaWrite, staff, ba]) {
      assert.equal(allowRoute(p, 'payroll'), false, p.role)
      assert.equal(allowRoute(p, 'my-pay'), false, p.role)
    }
  })

  it('no sidebar or dock links to Payroll or My pay', () => {
    for (const p of [{ role: ROLES.SUPER_ADMIN }, { role: ROLES.STAFF, branch_slug: 'bacoor' }, { role: ROLES.ADMIN, branch_slug: 'bacoor' }]) {
      const nav = getOperationsNav(p).map((i) => i.to)
      assert.equal(nav.some((to) => /\/operations\/(payroll|my-pay)/.test(to)), false, p.role)
    }
    assert.equal(getStaffDock({ role: ROLES.STAFF }).some((i) => i.to === '/operations/my-pay'), false)
  })
})

describe('monthly salary proration + dual run kinds', () => {
  it('prorates monthly package by frequency', () => {
    assert.equal(prorateMonthlyPackageMinor(3_000_000, 'monthly'), 3_000_000)
    assert.equal(prorateMonthlyPackageMinor(3_000_000, 'semimonthly'), 1_500_000)
    assert.equal(prorateMonthlyPackageMinor(3_000_000, 'weekly'), Math.round((3_000_000 * 12) / 52))
    assert.equal(prorateMonthlyPackageMinor(3_000_000, 'daily'), 100_000)
  })

  it('fixed run includes packages only; floor run excludes packages', () => {
    const pkg = {
      id: 'pkg-1',
      staff_id: 'staff-ba',
      package_kind: 'fixed',
      amount_minor: 3_000_000,
      branch: null,
      effective_from: '2026-01-01',
      staff: { id: 'staff-ba', full_name: 'BA' },
    }
    const sales = [
      {
        id: 'sale-wash',
        branch: 'bacoor',
        status: 'paid',
        total_minor: 100000,
        occurred_at: '2026-08-19T10:00:00+08:00',
        sale_line_items: [{ line_total_minor: 100000, services: { pay_category: 'wash' } }],
      },
    ]
    const attendance = [
      {
        id: 'staff-ty',
        staff_id: 'staff-ty',
        full_name: 'Ty',
        role: 'staff',
        branch_slug: 'bacoor',
        attendance_date: '2026-08-19',
        status: 'present',
      },
    ]
    const floor = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales,
      attendance,
      packages: [pkg],
      runKind: 'floor',
      frequency: 'weekly',
    })
    assert.equal(floor.lines.some((l) => l.kind === 'package_fixed'), false)
    assert.ok(floor.lines.some((l) => l.kind === 'wash_pool'))

    const fixed = buildPayrollPreview({
      period: { start: '2026-08-17', end: '2026-08-23' },
      rules: { wash_pool_pct: 35 },
      sales,
      attendance,
      packages: [pkg],
      runKind: 'fixed',
      frequency: 'weekly',
    })
    assert.equal(fixed.proof.length, 0)
    const line = fixed.lines.find((l) => l.kind === 'package_fixed')
    assert.ok(line)
    assert.equal(line.branch, FIXED_SALARY_BOOKS_BRANCH)
    assert.equal(line.pay_minor, Math.round((3_000_000 * 12) / 52))
  })

})

