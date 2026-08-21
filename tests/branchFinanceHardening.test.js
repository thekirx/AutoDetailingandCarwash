/**
 * Multi-branch + Finance integrity hardening seams.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireBranchSlug, branchSlugsForOwnPay } from '../src/lib/branchScope.js'
import { buildPayrollPreview, addPayrollAdjustment } from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('requireBranchSlug fail-closed', () => {
  it('never invents bacoor; prefers preferred then branch_slugs then home', () => {
    assert.equal(requireBranchSlug(null), null)
    assert.equal(requireBranchSlug({}), null)
    assert.equal(requireBranchSlug({ branch_slug: 'batangas' }), 'batangas')
    assert.equal(requireBranchSlug({ branch_slugs: ['imus'], branch_slug: 'batangas' }), 'imus')
    assert.equal(requireBranchSlug({ branch_slug: 'batangas' }, 'bacoor'), 'bacoor')
  })

  it('branchSlugsForOwnPay uses scope list or home only', () => {
    assert.deepEqual(
      branchSlugsForOwnPay({ branch_slug: 'batangas' }, () => ['batangas', 'imus']),
      ['batangas', 'imus'],
    )
    assert.deepEqual(branchSlugsForOwnPay({ branch_slug: 'batangas' }, () => null), ['batangas'])
    assert.deepEqual(branchSlugsForOwnPay({}, () => []), [])
  })
})

describe('packages are branch-keyed', () => {
  it('skips packages without branch; includes matching branch only', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-21', end: '2026-08-21' },
      rules: { wash_pool_pct: 35 },
      sales: [],
      attendance: [],
      packages: [
        { id: 'p1', staff_id: 's1', amount_minor: 50000, package_kind: 'fixed', branch: 'batangas', staff_name: 'A' },
        { id: 'p2', staff_id: 's2', amount_minor: 40000, package_kind: 'fixed', staff_name: 'B' },
      ],
    })
    assert.equal(preview.lines.length, 1)
    assert.equal(preview.lines[0].branch, 'batangas')
  })

  it('addPayrollAdjustment skips when branch missing', () => {
    const next = addPayrollAdjustment([], {
      staff: { id: 's1', full_name: 'Ty' },
      branch: '',
      direction: 'add',
      label: 'Bonus',
      amountMinor: 100,
    })
    assert.equal(next.length, 0)
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
    const myPay = readFileSync(join(root, 'src/pages/MyPayPage.jsx'), 'utf8')
    assert.doesNotMatch(myPay, /\|\| 'bacoor'/)
    assert.match(myPay, /branchSlugsForOwnPay/)
  })
})
