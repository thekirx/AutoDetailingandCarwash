/**
 * Phase 5 — Finance dashboard / P&L audit + Overview export wiring.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  financeOwnerInsights,
  rollupPl,
  salesByBranch,
  topExpenseCategories,
} from '../src/lib/financeData.js'
import {
  buildExpenses,
  buildFinanceSalesRows,
  buildPlRows,
  buildShopDaySales,
  BACOOR,
  IMUS,
} from '../src/lib/auditFixtures.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sales = buildShopDaySales()
const expenses = buildExpenses()
const plRows = buildPlRows(sales, expenses)
const salesRows = buildFinanceSalesRows(sales)

describe('finance audit', () => {
  it('1 rollupPl returns correct income / expense / net', () => {
    const pl = rollupPl(plRows)
    assert.equal(pl.income, 1_700_000)
    // expenses exclude ca_repayment (not in buildExpenses list used here)
    assert.equal(pl.expenses, 25_000 + 15_000 + 50_000 + 80_000 + 120_000)
    assert.equal(pl.net, pl.income - pl.expenses)
    assert.ok(typeof pl.margin === 'number')
  })

  it('2 topExpenseCategories sorted by spend', () => {
    const top = topExpenseCategories(plRows, 6)
    assert.ok(top.length >= 3)
    for (let i = 1; i < top.length; i++) {
      assert.ok(top[i - 1].amount_minor >= top[i].amount_minor)
    }
    assert.equal(top[0].category, 'Rent')
    assert.equal(top[0].amount_minor, 120_000)
  })

  it('3 salesByBranch returns Bacoor and Imus', () => {
    const by = salesByBranch(salesRows)
    const branches = by.map((b) => b.branch)
    assert.ok(branches.includes(BACOOR))
    assert.ok(branches.includes(IMUS))
    const bacoor = by.find((b) => b.branch === BACOOR)
    const imus = by.find((b) => b.branch === IMUS)
    assert.equal(bacoor.total_sales_minor, 600_000)
    assert.equal(imus.total_sales_minor, 1_100_000)
  })

  it('4 financeOwnerInsights returns actionable cues', () => {
    const insights = financeOwnerInsights(salesRows, plRows)
    assert.ok(Array.isArray(insights.cues))
    assert.ok(insights.cues.length >= 1)
    assert.ok(insights.paidCount >= 5)
    assert.ok(insights.avgTicketMinor > 0)
  })

  it('5 Overview wires export helpers and expense/branch charts', () => {
    const src = readFileSync(join(root, 'src/pages/finance/FinanceOverviewTab.jsx'), 'utf8')
    assert.match(src, /topExpenseCategories/)
    assert.match(src, /salesByBranch/)
    assert.match(src, /rollupPl/)
    assert.match(src, /downloadCsv/)
    assert.match(src, /downloadExcel/)
    assert.match(src, /printAsPdf/)
    assert.match(src, /Where spend goes|expenseBars/)
    assert.match(src, /Revenue by branch|branchChart/)
  })

  it('6–7 Finance page still hosts shift-close and expense-reports tabs', () => {
    const src = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    assert.match(src, /FinanceShiftCloseTab/)
    assert.match(src, /FinanceExpenseReportsTab/)
    assert.match(src, /FinancePLTab/)
    assert.match(src, /FinanceReportsTab/)
  })

  it('8 Reports expense fallback matches finance_daily_pl (paid+posted only)', () => {
    const src = readFileSync(join(root, 'src/pages/finance/FinanceReportsTab.jsx'), 'utf8')
    assert.match(src, /\['paid', 'posted'\]/)
    assert.doesNotMatch(src, /\['paid', 'approved', 'posted'\]/)
  })
})
