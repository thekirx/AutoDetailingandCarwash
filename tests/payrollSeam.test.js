/**
 * Payroll public seams:
 * - payrollPeriodRange / buildPayrollPreview / adjustPayrollLine / payrollBlocksConfirm
 * - POS sale ids as payout proof
 * - canAccessPayroll / canRunPayroll / canViewOwnPay
 * - wizard + RPC wiring (source scan)
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PAYOUT_FREQUENCIES,
  PAYROLL_WIZARD_STEPS,
  FIXED_SALARY_BOOKS_BRANCH,
  addPayrollCommission,
  adjustPayrollLine,
  buildPayrollPreview,
  groupPayrollLinesByStaff,
  ownPayTotalMinor,
  payrollBlocksConfirm,
  payrollPeriodRange,
  payrollWizardSteps,
  prorateMonthlyPackageMinor,
  rebuildWashPoolLines,
  removeStaffFromPayrollPreview,
  resolveFixedSalaryBranch,
} from '../src/lib/payroll.js'
import {
  DEFAULT_COMPENSATION_RULES,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '../src/lib/compensation.js'
import {
  ROLES,
  allowRoute,
  canAccessPayroll,
  canApproveCashAdvance,
  canRunPayroll,
  canViewOwnPay,
  getOperationsNav,
  getStaffDock,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('payroll period range', () => {
  it('daily / weekly / biweekly / monthly / custom use Manila calendar literals', () => {
    assert.deepEqual(PAYOUT_FREQUENCIES, [
      'daily',
      'weekly',
      'biweekly',
      'semimonthly',
      'monthly',
      'custom',
    ])
    assert.deepEqual(payrollPeriodRange('daily', '2026-08-19'), {
      start: '2026-08-19',
      end: '2026-08-19',
    })
    assert.deepEqual(payrollPeriodRange('weekly', '2026-08-19'), {
      start: '2026-08-17',
      end: '2026-08-23',
    })
    assert.deepEqual(payrollPeriodRange('biweekly', '2026-08-19'), {
      start: '2026-08-17',
      end: '2026-08-30',
    })
    assert.deepEqual(payrollPeriodRange('semimonthly', '2026-08-10'), {
      start: '2026-08-01',
      end: '2026-08-15',
    })
    assert.deepEqual(payrollPeriodRange('semimonthly', '2026-08-20'), {
      start: '2026-08-16',
      end: '2026-08-31',
    })
    assert.deepEqual(payrollPeriodRange('monthly', '2026-08-19'), {
      start: '2026-08-01',
      end: '2026-08-31',
    })
    assert.deepEqual(payrollPeriodRange('custom', '2026-08-19', { start: '2026-08-01', end: '2026-08-15' }), {
      start: '2026-08-01',
      end: '2026-08-15',
    })
  })
})

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

  it('attributes ceramic crew share to present roster and blocks unpaid assignee', () => {
    const withCrew = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-cer',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 200000,
          occurred_at: '2026-08-19T12:00:00+08:00',
          sale_line_items: [{ line_total_minor: 200000, pay_category: 'detailing' }],
        },
      ],
      attendance: [{ ...ty, attendance_date: '2026-08-19', status: 'present' }],
      ceramicExpenses: [
        { description: 'ceramic:sale-cer:crew', total_minor: 40000, branch: 'bacoor', expense_kind: 'salary_carwash' },
      ],
    })
    const crew = withCrew.lines.find((l) => l.kind === 'ceramic_crew')
    assert.equal(crew.staff_id, 'staff-ty')
    assert.equal(crew.pay_minor, 40000)
    assert.equal(crew.source_sale_id, 'sale-cer')

    const orphan = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [],
      attendance: [],
      ceramicExpenses: [
        { description: 'ceramic:sale-x:detailer', total_minor: 10000, branch: 'bacoor', expense_kind: 'salary_detailer' },
      ],
    })
    assert.equal(orphan.lines[0].missing_assignee, true)
    assert.equal(payrollBlocksConfirm(orphan).blocked, true)
  })

  it('lets SA adjust a line and rebuild wash pool at a new commission %', () => {
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
        },
      ],
      attendance: [{ ...ty, attendance_date: '2026-08-19', status: 'present' }],
    })
    const key = preview.lines[0].key
    const bumped = adjustPayrollLine(preview.lines, key, 20000)
    assert.equal(bumped.find((l) => l.key === key).pay_minor, 20000)
    const rebuilt = rebuildWashPoolLines(preview, 50)
    assert.equal(rebuilt.lines[0].pay_minor, 50000)
    assert.equal(rebuilt.rules.wash_pool_pct, 50)
  })

  it('own pay totals a staff row and ignores Super Admin viewing', () => {
    const lines = [
      { staff_id: 'staff-ty', pay_minor: 17500 },
      { staff_id: 'staff-jen', pay_minor: 17500 },
    ]
    assert.equal(ownPayTotalMinor(lines, 'staff-ty'), 17500)
    assert.equal(ownPayTotalMinor(lines, 'staff-missing'), 0)
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

describe('payroll RBAC', () => {
  it('SA and ASA with finance grants run payroll; crew sees own pay; SA does not', () => {
    const sa = { role: ROLES.SUPER_ADMIN }
    const asaWrite = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: true, finance_write: true } }
    const asaView = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: true, finance_write: false } }
    const asaNone = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_view: false, finance_write: false } }
    const staff = { role: ROLES.STAFF, branch_slug: 'bacoor' }
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }

    assert.equal(canAccessPayroll(sa), true)
    assert.equal(canRunPayroll(sa), true)
    assert.equal(canApproveCashAdvance(sa), true)
    assert.equal(canViewOwnPay(sa), false)
    assert.equal(allowRoute(sa, 'payroll'), true)
    assert.equal(allowRoute(sa, 'my-pay'), false)

    assert.equal(canAccessPayroll(asaWrite), true)
    assert.equal(canRunPayroll(asaWrite), true)
    assert.equal(canApproveCashAdvance(asaWrite), true)
    assert.equal(canViewOwnPay(asaWrite), true)
    assert.equal(canRunPayroll(asaView), false)
    assert.equal(canApproveCashAdvance(asaView), false)
    assert.equal(canAccessPayroll(asaView), true)
    assert.equal(canAccessPayroll(asaNone), false)

    assert.equal(canAccessPayroll(staff), false)
    assert.equal(canViewOwnPay(staff), true)
    assert.equal(allowRoute(staff, 'my-pay'), true)
    assert.equal(allowRoute(staff, 'payroll'), false)
    assert.equal(canViewOwnPay(ba), true)
    assert.equal(canAccessPayroll(ba), false)
    assert.equal(canApproveCashAdvance(ba), false)
  })

  it('sidebar lists Payroll for SA and My pay for crew, not SA', () => {
    const saNav = getOperationsNav({ role: ROLES.SUPER_ADMIN }).map((i) => i.to)
    assert.ok(saNav.includes('/operations/payroll'))
    assert.equal(saNav.includes('/operations/my-pay'), false)
    const staffNav = getOperationsNav({ role: ROLES.STAFF, branch_slug: 'bacoor' }).map((i) => i.to)
    assert.ok(staffNav.includes('/operations/my-pay'))
    assert.equal(staffNav.includes('/operations/payroll'), false)
    assert.ok(getStaffDock({ role: ROLES.STAFF }).some((i) => i.to === '/operations/my-pay'))
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

  it('fixed wizard steps are period → people → extras → review', () => {
    assert.deepEqual(
      payrollWizardSteps('fixed').map((s) => s.id),
      ['period', 'people', 'extras', 'review'],
    )
    assert.equal(resolveFixedSalaryBranch({}), FIXED_SALARY_BOOKS_BRANCH)
  })

  it('groups employees and supports commission + skip', () => {
    const pkgLine = {
      key: 'package_fixed:staff-ba:hq:package:1',
      kind: 'package_fixed',
      staff_id: 'staff-ba',
      staff_name: 'BA',
      branch: 'hq',
      pay_minor: 1500000,
      amount_minor: 1500000,
      direction: 'add',
      label: 'Monthly salary',
    }
    let lines = [pkgLine]
    lines = addPayrollCommission(lines, {
      staff: { id: 'staff-ba', full_name: 'BA' },
      label: 'Sales commission',
      amountMinor: 50000,
    })
    const groups = groupPayrollLinesByStaff(lines)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].salary_minor, 1500000)
    assert.equal(groups[0].commission_minor, 50000)
    assert.equal(groups[0].total_minor, 1550000)
    const trimmed = removeStaffFromPayrollPreview(lines, 'staff-ba')
    assert.equal(trimmed.length, 0)
  })
})

describe('payroll wizard + RPC wiring', () => {
  it('four wizard steps and run_payroll settles POS-proofed lines', () => {
    assert.deepEqual(
      PAYROLL_WIZARD_STEPS.map((s) => s.id),
      ['period', 'proof', 'lines', 'confirm'],
    )
    const page = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
    assert.match(page, /async function loadProof/)
    assert.match(page, /onClick=\{loadProof\}/)
    assert.match(page, /payrollWizardSteps/)
    assert.match(page, /PAYROLL_RUN_KINDS/)
    assert.match(page, /groupPayrollLinesByStaff/)
    assert.match(page, /addPayrollCommission/)
    assert.match(page, /Load salaried employees/)
    assert.match(page, /run_payroll/)
    assert.match(page, /canRunPayroll/)
    assert.match(page, /hakum-payroll/)
    assert.match(page, /Floor pay|Fixed salary/)
    assert.match(page, /Company-wide salaries|no bay/)
    const mine = readFileSync(join(root, 'src/pages/MyPayPage.jsx'), 'utf8')
    assert.match(mine, /payroll_run_lines/)
    assert.match(mine, /canViewOwnPay/)
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    assert.match(app, /path="payroll"/)
    assert.match(app, /path="my-pay"/)
    const sql = readFileSync(join(root, 'supabase/migrations/20260819100000_payroll_runs.sql'), 'utf8')
    assert.match(sql, /create table if not exists public.payroll_runs/)
    assert.match(sql, /create table if not exists public.payroll_run_lines/)
    assert.match(sql, /create table if not exists public.payroll_run_sales/)
    assert.match(sql, /create or replace function public.run_payroll/)
    assert.match(sql, /sale already paid in another payroll run/)
    assert.match(sql, /payout_frequency/)
    assert.match(sql, /security definer/)
    assert.match(sql, /enable row level security/)
  })
})
