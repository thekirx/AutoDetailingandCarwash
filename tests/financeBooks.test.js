import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accountWatchlist,
  billLineMinor,
  buildBillRows,
  buildComparePeriods,
  calendarPeriod,
  monthlyProfitYtd,
  pivotExportRows,
  plByBranches,
  plByPeriods,
  DISCOUNTS_ROW,
  parsePlLayout,
  tradingIncomeRows,
  yearMonths,
} from '../src/lib/financeBooks.js'

const rows = [
  { branch: 'bacoor', period_date: '2026-10-01', kind: 'income', category: 'POS sales', amount_minor: 500000 },
  { branch: 'bacoor', period_date: '2026-10-01', kind: 'expense', category: 'Employee Salary and Incentives', amount_minor: 120000 },
  { branch: 'imus', period_date: '2026-09-15', kind: 'income', category: 'POS sales', amount_minor: 300000 },
  { branch: 'imus', period_date: '2026-09-15', kind: 'expense', category: 'Meals and Entertainment', amount_minor: 10000 },
  { branch: 'bacoor', period_date: '2025-10-03', kind: 'income', category: 'POS sales', amount_minor: 200000 },
  { branch: 'bacoor', period_date: '2025-10-03', kind: 'expense', category: 'Meals and Entertainment', amount_minor: 50000 },
]
const accounts = [
  { name: 'Meals and Entertainment', code: '10' },
  { name: 'Employee Salary and Incentives', code: '14' },
  { name: 'Old thing', code: null },
]

describe('financeBooks periods', () => {
  it('builds calendar month / quarter / year periods', () => {
    assert.deepEqual(calendarPeriod('2026-02-10', 'month'), { key: '2026-02', label: 'Feb 2026', start: '2026-02-01', end: '2026-02-28' })
    assert.deepEqual(calendarPeriod('2026-01-05', 'month', 1), { key: '2025-12', label: 'Dec 2025', start: '2025-12-01', end: '2025-12-31' })
    assert.deepEqual(calendarPeriod('2026-11-05', 'quarter'), { key: '2026-10', label: 'Q4 2026', start: '2026-10-01', end: '2026-12-31' })
    assert.equal(calendarPeriod('2026-02-01', 'quarter', 1).label, 'Q4 2025')
    assert.equal(calendarPeriod('2026-06-01', 'year', 2).start, '2024-01-01')
  })

  it('compare with N previous periods, oldest first, capped at 12', () => {
    const p = buildComparePeriods({ end: '2026-10-02', unit: 'month', count: 2 })
    assert.deepEqual(p.map((x) => x.label), ['Aug 2026', 'Sep 2026', 'Oct 2026'])
    assert.equal(buildComparePeriods({ end: '2026-10-02', count: 40 }).length, 13)
    assert.equal(yearMonths('2026-10-02').length, 12)
  })
})

describe('financeBooks pivots', () => {
  it('P&L by period sums each account into its column and nets the totals', () => {
    const periods = buildComparePeriods({ end: '2026-10-02', unit: 'month', count: 1 })
    const pv = plByPeriods(rows, periods)
    assert.deepEqual(pv.totals.income, [300000, 500000])
    assert.deepEqual(pv.totals.expenses, [10000, 120000])
    assert.deepEqual(pv.totals.net, [290000, 380000])
    assert.equal(pv.expense.length, 2)
  })

  it('P&L by branch keeps branches apart and skips unknown branches', () => {
    const pv = plByBranches(rows, ['imus', 'bacoor'])
    assert.deepEqual(pv.totals.income, [300000, 700000])
    assert.deepEqual(plByBranches(rows, ['nope']).totals.income, [0])
  })

  it('export rows end with net profit per column', () => {
    const periods = buildComparePeriods({ end: '2026-10-02', unit: 'month', count: 1 })
    const out = pivotExportRows(plByPeriods(rows, periods), periods.map((p) => p.label))
    const net = out.at(-1)
    assert.equal(net.account, 'Net profit')
    assert.equal(net['Oct 2026'], '3800.00')
    assert.equal(net.total, '6700.00')
  })
})

describe('financeBooks Home', () => {
  it('watchlist: income first, accounts by code, this month vs YTD, never future or last year', () => {
    const w = accountWatchlist(rows, accounts, { today: '2026-10-02' })
    assert.deepEqual(w.map((r) => r.category), ['POS sales', 'Meals and Entertainment', 'Employee Salary and Incentives'])
    assert.deepEqual([w[0].monthMinor, w[0].ytdMinor], [500000, 800000])
    assert.deepEqual([w[1].code, w[1].monthMinor, w[1].ytdMinor], ['10', 0, 10000])
  })

  it('YTD chart: net by month this year, last year as a ghost', () => {
    const m = monthlyProfitYtd(rows, { today: '2026-10-02' })
    assert.equal(m.length, 12)
    assert.equal(m[9].net, 3800)
    assert.equal(m[8].net, 2900)
    assert.equal(m[9].priorNet, 1500)
    assert.equal(m[10].net, 0)
  })
})

describe('financeBooks trading income', () => {
  it('splits POS income by family and reconciles discounts to the paid total', () => {
    const kinds = [
      { branch: 'bacoor', period_date: '2026-10-01', line_kind: 'service', amount_minor: 400000 },
      { branch: 'bacoor', period_date: '2026-10-01', line_kind: 'ppf', amount_minor: 150000 },
      { branch: 'bacoor', period_date: '2026-10-01', line_kind: 'mystery', amount_minor: 10000 },
    ]
    const out = tradingIncomeRows(rows, kinds, { service: 'Services', ppf: 'PPF' })
    const oct = out.filter((r) => r.kind === 'income' && r.period_date === '2026-10-01')
    assert.deepEqual(oct.map((r) => [r.category, r.amount_minor]), [['Services', 400000], ['PPF', 150000], ['Other sales', 10000], [DISCOUNTS_ROW, -60000]])
    const sum = (list) => list.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount_minor, 0)
    assert.equal(sum(out), sum(rows))
    assert.equal(out.filter((r) => r.kind === 'expense').length, rows.filter((r) => r.kind === 'expense').length)
    assert.equal(tradingIncomeRows(rows, []), rows)
  })

  it('P&L layout from the URL: compare units, clamps n to 1–12, unknown falls back to statement', () => {
    assert.deepEqual(parsePlLayout('quarter', '30'), { layout: 'compare', unit: 'quarter', count: 12 })
    assert.deepEqual(parsePlLayout('fy', ''), { layout: 'fy', unit: 'month', count: 1 })
    assert.equal(parsePlLayout('branches').layout, 'branches')
    assert.equal(parsePlLayout('compare').layout, '')
    assert.equal(parsePlLayout('<script>').layout, '')
  })
})

describe('financeBooks bills', () => {
  const header = { vendor_id: 'v1', date: '2026-10-02', due_date: '2026-10-30', reference: ' INV-9 ' }
  const line = { item: 'Shampoo', description: '5L', quantity: '2', unit_price: '1,250.50', category_id: 'c12', branch: 'bacoor' }

  it('one expense row per line, amounts in centavos, dated noon Manila, blank lines skipped', () => {
    const res = buildBillRows(header, [line, { item: '', unit_price: '' }, { ...line, item: 'Towels', quantity: '3', unit_price: '99.99' }])
    assert.equal(res.ok, true)
    assert.deepEqual(res.rows.map((r) => r.total_minor), [250100, 29997])
    assert.equal(res.totalMinor, 280097)
    assert.equal(res.rows[0].created_at, '2026-10-02T12:00:00+08:00')
    assert.equal(res.rows[0].bill_reference, 'INV-9')
    assert.equal(res.rows[0].unit_cost_minor, 125050)
    assert.equal(billLineMinor({ quantity: '0', unit_price: '5' }), NaN)
  })

  it('says what is missing', () => {
    assert.match(buildBillRows({ ...header, vendor_id: '' }, [line]).error, /who the bill is from/)
    assert.match(buildBillRows({ ...header, due_date: '2026-10-01' }, [line]).error, /Due date/)
    assert.match(buildBillRows(header, []).error, /at least one line/)
    assert.match(buildBillRows(header, [{ ...line, category_id: '' }]).error, /Line 1: choose an account/)
    assert.match(buildBillRows(header, [{ ...line, unit_price: 'abc' }]).error, /Line 1: enter a quantity/)
  })
})
