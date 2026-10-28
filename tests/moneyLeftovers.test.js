import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('money leftovers (C2/C3/C6)', () => {
  it('wires expense paid_from cash|gcash through sheet save UI and SQL', () => {
    const mig = readFileSync(join(root, 'supabase/migrations/20261019140000_expense_paid_from.sql'), 'utf8')
    const totals = readFileSync(join(root, 'supabase/migrations/20261019210000_daily_sheet_expected_cash_paid_from.sql'), 'utf8')
    const sheet = readFileSync(join(root, 'src/lib/dailySheet.js'), 'utf8')
    const panel = readFileSync(join(root, 'src/pages/pos/DailySheetPanel.jsx'), 'utf8')
    assert.match(mig, /paid_from/)
    assert.match(mig, /assert_cash_advance_release/)
    assert.match(totals, /v_cash_exp/)
    assert.match(totals, /v_expected := coalesce\(s\.opening_float_minor, 0\) \+ v_cash \+ v_rep - v_cash_exp - v_sal - v_rel/)
    assert.match(sheet, /expensePaidFrom/)
    assert.match(sheet, /cashExpensesMinor/)
    assert.match(panel, /Paid from/)
    assert.match(panel, /gcash/)
  })

  it('ships monthly payroll page posting account 14 with cash or GCash', () => {
    const page = readFileSync(join(root, 'src/pages/MonthlyPayrollPage.jsx'), 'utf8')
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    const perms = readFileSync(join(root, 'src/auth/permissions.js'), 'utf8')
    const post = readFileSync(join(root, 'supabase/migrations/20261028140000_payslip_posts_finance.sql'), 'utf8')
    assert.match(page, /send_payslip/)
    assert.match(page, /paid_from/)
    assert.match(post, /salary_monthly/)
    assert.match(post, /code = '14'/)
    assert.match(app, /monthly-payroll/)
    assert.match(perms, /Monthly salaries/)
    assert.match(perms, /'monthly-payroll': canEditFinanceBooks/)
  })

  it('shows detailing labels for compensation settings (ceramic keys stay)', () => {
    const rules = readFileSync(join(root, 'src/pages/settings/DailySheetRulesPage.jsx'), 'utf8')
    const comp = readFileSync(join(root, 'src/lib/compensation.js'), 'utf8')
    assert.match(rules, /Detailing crew split/)
    assert.match(rules, /Detailer split/)
    assert.match(comp, /ceramic_crew_split_pct/)
    assert.match(comp, /detailing:/)
  })
})
