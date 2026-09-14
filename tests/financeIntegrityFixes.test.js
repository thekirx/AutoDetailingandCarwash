/**
 * Finance deep-audit leftovers: range honesty, retention window, tabs/URL, copy.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FINANCE_DEFAULT_PERIOD,
  FINANCE_PRIMARY_TAB_IDS,
  FINANCE_TABS,
  buildFinanceSearchParams,
  financeEmptyWindowCue,
  financeRange,
  financeStatementCues,
  parseFinanceSearch,
  postedPayrollExpenseMinor,
  resolveFinanceTab,
  retentionInWindow,
  validateFinanceCustomRange,
} from '../src/lib/financeData.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const FIXED_NOW = new Date(2026, 7, 11, 13, 0, 0)

describe('finance custom range', () => {
  it('rejects inverted custom ranges', () => {
    const check = validateFinanceCustomRange('2026-09-01', '2020-01-01')
    assert.equal(check.ok, false)
    assert.match(check.reason, /on or after start/)
  })

  it('accepts a forward custom range', () => {
    const check = validateFinanceCustomRange('2026-08-01', '2026-08-31')
    assert.equal(check.ok, true)
    assert.equal(check.start, '2026-08-01')
    assert.equal(check.end, '2026-08-31')
  })

  it('does not query-swap inverted custom dates in financeRange', () => {
    const r = financeRange('custom', '2026-09-01', '2020-01-01', FIXED_NOW)
    assert.equal(r.start, '2026-09-01')
    assert.equal(r.end, '2020-01-01')
  })
})

describe('retention window', () => {
  it('drops July last_paid from an August range', () => {
    const rows = [
      { customer_id: 'maria', last_paid_at: '2026-07-23T10:00:00+08:00', paid_sales: 4 },
      { customer_id: 'june', last_paid_at: '2026-08-08', paid_sales: 2 },
    ]
    const inWindow = retentionInWindow(rows, { start: '2026-08-01', end: '2026-08-31' })
    assert.equal(inWindow.length, 1)
    assert.equal(inWindow[0].customer_id, 'june')
  })
})

describe('empty window + unposted pay cues', () => {
  it('points at last paid POS outside the current window', () => {
    const cue = financeEmptyWindowCue({
      income: 0,
      expenses: 0,
      lastPaidDate: '2026-08-08',
      lastPaidMinor: 285000,
      range: { start: '2026-09-01', end: '2026-09-30' },
    })
    assert.equal(cue.id, 'last-paid-outside')
    assert.match(cue.text, /2026-08-08/)
    assert.equal(cue.lastPaidMinor, 285000)
  })

  it('names unposted crew pay and missing shift closes', () => {
    const cues = financeStatementCues({
      income: 285000,
      payrollExpenseMinor: 0,
      shiftCloseCount: 0,
      paidCount: 2,
    })
    assert.ok(cues.some((c) => c.id === 'unposted-pay' && c.href === '/operations/payroll'))
    assert.ok(cues.some((c) => c.id === 'no-close' && c.href === '/operations/pos'))
  })

  it('treats Payroll category rows as posted payroll expense', () => {
    assert.equal(
      postedPayrollExpenseMinor([
        { kind: 'expense', category: 'Payroll', amount_minor: 90000 },
        { kind: 'income', category: 'POS sales', amount_minor: 285000 },
      ]),
      90000,
    )
  })
})

describe('finance URL + primary tabs', () => {
  it('keeps all 11 tab ids and 5 primary tabs', () => {
    assert.equal(FINANCE_TABS.length, 11)
    assert.equal(FINANCE_PRIMARY_TAB_IDS.length, 5)
    assert.deepEqual(FINANCE_PRIMARY_TAB_IDS, ['overview', 'sales', 'purchases', 'pl', 'shift-close'])
  })

  it('still aliases expenses → purchases', () => {
    assert.equal(resolveFinanceTab('expenses'), 'purchases')
  })

  it('defaults period to last_30 and preserves filters when tab changes', () => {
    assert.equal(FINANCE_DEFAULT_PERIOD, 'last_30')
    const parsed = parseFinanceSearch(new URLSearchParams('tab=reports&period=last_month&branch=bacoor'))
    assert.equal(parsed.tab, 'reports')
    assert.equal(parsed.period, 'last_month')
    assert.equal(parsed.branch, 'bacoor')
    const next = buildFinanceSearchParams({
      tab: 'overview',
      period: parsed.period,
      branch: parsed.branch,
      compare: 'none',
      defaultBranch: 'all',
    })
    assert.equal(next.tab, undefined)
    assert.equal(next.period, 'last_month')
    assert.equal(next.branch, 'bacoor')
  })
})

describe('finance leftover source scans', () => {
  it('defaults to last_30, closes the guide, and keeps More + deep links', () => {
    const page = read('src/pages/FinancePage.jsx')
    assert.match(page, /FINANCE_DEFAULT_PERIOD|parseFinanceSearch/)
    assert.match(page, /defaultOpen=\{false\}/)
    assert.match(page, /FINANCE_PRIMARY_TAB_IDS/)
    assert.match(page, /More finance pages/)
    assert.match(page, /buildFinanceSearchParams/)
    assert.match(page, /validateFinanceCustomRange/)
    assert.match(page, /financeStatementCues/)
    assert.match(page, /Open Payroll/)
    assert.match(page, /onVendorsChange=\{onVendorsChange\}/)
    assert.match(page, /useCallback\(\(rows\) =>/)
    assert.doesNotMatch(page, /opsTabSearchParams/)
    assert.match(page, /TabsContent value="reports"/)
    assert.match(page, /TabsContent value="quotes"/)
  })

  it('does not invent commission editors on Finance', () => {
    const page = read('src/pages/FinancePage.jsx')
    const cats = read('src/pages/finance/FinanceCategoriesTab.jsx')
    const lib = read('src/lib/financeData.js')
    assert.doesNotMatch(page, /wash_pool_pct/)
    assert.match(cats, /not commission %/)
    assert.match(cats, /P&L bucket/)
    assert.match(lib, /Crew pay is not in this statement/)
    assert.match(lib, /\/operations\/payroll/)
  })

  it('windows Reports retention and labels crew KPI as roster', () => {
    const tab = read('src/pages/finance/FinanceReportsTab.jsx')
    assert.match(tab, /retentionInWindow/)
    assert.match(tab, /Crew in KPI \(current roster\)/)
  })

  it('shows inverted-range error under the date fields', () => {
    const filters = read('src/pages/finance/FinanceFilters.jsx')
    assert.match(filters, /finance-start/)
    assert.match(filters, /finance-end/)
    assert.match(filters, /rangeError/)
    assert.match(filters, /aria-invalid/)
  })

  it('vendors load does not depend on a new parent callback each render', () => {
    const vendors = read('src/pages/finance/FinanceVendorsTab.jsx')
    assert.match(vendors, /onVendorsChangeRef/)
    assert.match(vendors, /useCallback\(async \(\) =>/)
    assert.match(vendors, /Vendors failed to load/)
    assert.doesNotMatch(vendors, /}, \[onVendorsChange\]\)/)
  })

  it('expense report fields have htmlFor + id', () => {
    const src = read('src/pages/finance/FinanceExpenseReportsTab.jsx')
    assert.match(src, /htmlFor="er-branch"/)
    assert.match(src, /htmlFor="er-title"/)
    assert.match(src, /htmlFor="er-period-start"/)
    assert.match(src, /htmlFor="er-period-end"/)
  })

  it('Payroll handoff guide step links to Payroll', () => {
    const copy = read('src/components/ops/opsGuideCopy.js')
    const card = read('src/components/ops/OpsGuideCard.jsx')
    assert.match(copy, /href: '\/operations\/payroll'/)
    assert.match(card, /step\.href/)
    assert.match(card, /step\.linkLabel/)
  })

  it('Reports and ledgers export CSV only; Dashboard keeps the trio', () => {
    const reports = read('src/pages/finance/FinanceReportsTab.jsx')
    const sales = read('src/pages/finance/FinanceSalesTab.jsx')
    const pl = read('src/pages/finance/FinancePLTab.jsx')
    const overview = read('src/pages/finance/FinanceOverviewTab.jsx')
    assert.match(reports, /downloadCsv/)
    assert.doesNotMatch(reports, /downloadExcel|printAsPdf/)
    assert.doesNotMatch(sales, /downloadExcel|printAsPdf/)
    assert.doesNotMatch(pl, /pl-compare/)
    assert.match(overview, /downloadExcel/)
    assert.match(overview, /printAsPdf/)
  })
})
