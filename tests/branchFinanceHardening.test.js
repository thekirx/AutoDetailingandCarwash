/**
 * Multi-branch + Finance integrity hardening seams.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireBranchSlug } from '../src/lib/branchScope.js'
import { buildPayrollPreview } from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('requireBranchSlug fail-closed', () => {
  it('never invents bacoor; prefers preferred then branch_slugs then home', () => {
    assert.equal(requireBranchSlug(null), null)
    assert.equal(requireBranchSlug({}), null)
    assert.equal(requireBranchSlug({ branch_slug: 'batangas' }), 'batangas')
    assert.equal(requireBranchSlug({ branch_slugs: ['imus'], branch_slug: 'batangas' }), 'imus')
    assert.equal(requireBranchSlug({ branch_slug: 'batangas' }, 'bacoor'), 'bacoor')
  })
})

describe('packages are branch-keyed', () => {
  it('company packages use HQ books branch; bay packages keep their branch', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-21', end: '2026-08-21' },
      rules: { wash_pool_pct: 35 },
      sales: [],
      attendance: [],
      packages: [
        { id: 'p1', staff_id: 's1', amount_minor: 50000, package_kind: 'fixed', branch: 'batangas', staff_name: 'A' },
        { id: 'p2', staff_id: 's2', amount_minor: 40000, package_kind: 'fixed', staff_name: 'B' },
      ],
      runKind: 'fixed',
      frequency: 'monthly',
    })
    assert.equal(preview.lines.length, 2)
    assert.equal(preview.lines.find((l) => l.staff_id === 's1')?.branch, 'batangas')
    assert.equal(preview.lines.find((l) => l.staff_id === 's2')?.branch, 'hq')
  })

})

describe('finance integrity wiring', () => {
  it('run_payroll posts paid payroll expenses; Finance loads expenses + finance_daily_pl', () => {
    const payrollSql = readFileSync(
      join(root, 'supabase/migrations/20260821020000_payroll_custom_packages.sql'),
      'utf8',
    )
    assert.match(payrollSql, /status = 'paid'/)
    assert.match(payrollSql, /payroll:/)
    const finance = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    assert.match(finance, /from\('expenses'\)/)
    assert.match(finance, /from\('finance_daily_pl'\)/)
    const reports = readFileSync(join(root, 'src/pages/finance/FinanceReportsTab.jsx'), 'utf8')
    assert.match(reports, /shift_close_reports/)
    assert.match(reports, /accepted.*locked|locked.*accepted/s)
  })

  it('expense reports filter by branchFilter; packages migration has branch column', () => {
    const exp = readFileSync(join(root, 'src/pages/finance/FinanceExpenseReportsTab.jsx'), 'utf8')
    assert.match(exp, /branchFilter/)
    assert.match(exp, /\.eq\('branch'/)
    const pkgMig = readFileSync(
      join(root, 'supabase/migrations/20260821100000_staff_pay_packages_branch.sql'),
      'utf8',
    )
    assert.match(pkgMig, /staff_pay_packages/)
    assert.match(pkgMig, /add column if not exists branch/)
    const acl = readFileSync(
      join(root, 'supabase/migrations/20260821110000_submit_expense_report_branch_acl.sql'),
      'utf8',
    )
    assert.match(acl, /user_has_branch_access/)
  })

  it('SA expense report approve lands on pending_payment; mark_paid later', () => {
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821140000_expense_approve_pending_payment.sql'),
      'utf8',
    )
    assert.match(mig, /pending_payment/)
    assert.match(mig, /approve_paid/)
    assert.match(mig, /mark_paid/)
    assert.match(mig, /expenses_pending_payment_idx/)
    const ui = readFileSync(join(root, 'src/pages/finance/FinanceExpenseReportsTab.jsx'), 'utf8')
    assert.match(ui, /Approve · pending payment/)
    assert.match(ui, /approve_paid/)
    assert.match(ui, /mark_paid/)
    const purchases = readFileSync(join(root, 'src/pages/finance/FinancePurchasesTab.jsx'), 'utf8')
    assert.match(purchases, /pending_payment/)
  })
})
