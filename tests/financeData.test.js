import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FINANCE_TABS,
  DATE_PRESETS,
  COMPARE_PRESETS,
  financeRange,
  financeRangeIso,
  financeCompareRange,
  mergePlByCategory,
  rollupPl,
  plByCategory,
  salesByDay,
  salesByBranch,
  retentionBuckets,
  toCsv,
  toExcelHtml,
  branchScopeList,
} from '../src/lib/financeData.js'

const FIXED_NOW = new Date(2026, 7, 11, 13, 0, 0) // Aug 11, 2026 1pm PHT

describe('financeData tabs + presets', () => {
  it('exposes six tabs with stable ids', () => {
    assert.deepEqual(
      FINANCE_TABS.map((t) => t.id),
      ['overview', 'sales', 'purchases', 'pl', 'categories', 'reports'],
    )
    assert.ok(FINANCE_TABS.every((t) => t.label && t.hint))
  })

  it('date presets cover today through custom', () => {
    const ids = DATE_PRESETS.map((p) => p.value)
    assert.ok(ids.includes('today'))
    assert.ok(ids.includes('custom'))
    assert.ok(ids.includes('3mo'))
    assert.ok(ids.includes('6mo'))
  })
})

describe('financeRange', () => {
  it('today returns the same Manila day for start and end', () => {
    const r = financeRange('today', '', '', FIXED_NOW)
    assert.equal(r.start, r.end)
    assert.match(r.start, /^2026-08-11$/)
  })

  it('month returns first and last day of the current month', () => {
    const r = financeRange('month', '', '', FIXED_NOW)
    assert.equal(r.start, '2026-08-01')
    assert.equal(r.end, '2026-08-31')
  })

  it('year covers Jan 1 to Dec 31', () => {
    const r = financeRange('year', '', '', FIXED_NOW)
    assert.equal(r.start, '2026-01-01')
    assert.equal(r.end, '2026-12-31')
  })

  it('custom passes through the provided days', () => {
    const r = financeRange('custom', '2026-01-05', '2026-01-10', FIXED_NOW)
    assert.equal(r.start, '2026-01-05')
    assert.equal(r.end, '2026-01-10')
  })

  it('3mo ends today and starts 3 months earlier', () => {
    const r = financeRange('3mo', '', '', FIXED_NOW)
    assert.equal(r.end, '2026-08-11')
    assert.equal(r.start, '2026-05-11')
  })

  it('financeRangeIso wraps Manila timestamps', () => {
    const r = financeRangeIso('today', '', '', FIXED_NOW)
    assert.equal(r.startIso, `${r.start}T00:00:00+08:00`)
    assert.equal(r.endIso, `${r.end}T23:59:59.999+08:00`)
  })
})

describe('rollupPl', () => {
  it('sums income and expenses and computes net + margin', () => {
    const rows = [
      { kind: 'income', category: 'POS sales', amount_minor: 100000 },
      { kind: 'income', category: 'POS sales', amount_minor: 50000 },
      { kind: 'expense', category: 'Rent', amount_minor: 30000 },
      { kind: 'expense', category: 'Payroll', amount_minor: 80000 },
    ]
    const r = rollupPl(rows)
    assert.equal(r.income, 150000)
    assert.equal(r.expenses, 110000)
    assert.equal(r.net, 40000)
    assert.equal(r.margin, 26.7)
  })

  it('margin is zero when income is zero', () => {
    const r = rollupPl([{ kind: 'expense', category: 'Rent', amount_minor: 5000 }])
    assert.equal(r.income, 0)
    assert.equal(r.net, -5000)
    assert.equal(r.margin, 0)
  })
})

describe('financeCompareRange', () => {
  it('returns null for none', () => {
    assert.equal(financeCompareRange('2026-08-01', '2026-08-31', 'none'), null)
  })

  it('previous period is the equal-length window before start', () => {
    const r = financeCompareRange('2026-08-01', '2026-08-31', 'previous')
    assert.equal(r.start, '2026-07-01')
    assert.equal(r.end, '2026-07-31')
  })

  it('previous year shifts both ends back one year', () => {
    const r = financeCompareRange('2026-08-01', '2026-08-31', 'previous_year')
    assert.equal(r.start, '2025-08-01')
    assert.equal(r.end, '2025-08-31')
  })

  it('exposes compare presets', () => {
    assert.deepEqual(COMPARE_PRESETS.map((p) => p.value), ['none', 'previous', 'previous_year'])
  })
})

describe('mergePlByCategory', () => {
  it('joins current and prior amounts with delta', () => {
    const current = [
      { kind: 'income', category: 'POS sales', amount_minor: 100000 },
      { kind: 'expense', category: 'Rent', amount_minor: 40000 },
    ]
    const prior = [
      { kind: 'income', category: 'POS sales', amount_minor: 80000 },
      { kind: 'expense', category: 'Payroll', amount_minor: 10000 },
    ]
    const out = mergePlByCategory(current, prior)
    const sales = out.find((r) => r.category === 'POS sales')
    const rent = out.find((r) => r.category === 'Rent')
    const payroll = out.find((r) => r.category === 'Payroll')
    assert.equal(sales.current, 100000)
    assert.equal(sales.prior, 80000)
    assert.equal(sales.delta, 20000)
    assert.equal(sales.deltaPct, 25)
    assert.equal(rent.prior, 0)
    assert.equal(payroll.current, 0)
    assert.equal(payroll.prior, 10000)
  })
})

describe('plByCategory', () => {
  it('groups by kind+category and sorts by amount desc', () => {
    const rows = [
      { kind: 'income', category: 'POS sales', amount_minor: 100000 },
      { kind: 'expense', category: 'Rent', amount_minor: 30000 },
      { kind: 'expense', category: 'Rent', amount_minor: 10000 },
      { kind: 'expense', category: 'Payroll', amount_minor: 80000 },
    ]
    const out = plByCategory(rows)
    assert.equal(out.length, 3)
    assert.equal(out[0].category, 'POS sales')
    assert.equal(out[0].amount_minor, 100000)
    assert.equal(out.find((r) => r.category === 'Rent').amount_minor, 40000)
  })
})

describe('salesByDay + salesByBranch', () => {
  const rows = [
    { sale_date: '2026-08-10', branch: 'bacoor', total_sales_minor: 10000, paid_count: 2, transaction_count: 3, cash_sales_minor: 6000, gcash_sales_minor: 4000, card_sales_minor: 0, online_sales_minor: 4000 },
    { sale_date: '2026-08-10', branch: 'batangas', total_sales_minor: 5000, paid_count: 1, transaction_count: 1, cash_sales_minor: 5000, gcash_sales_minor: 0, card_sales_minor: 0, online_sales_minor: 0 },
    { sale_date: '2026-08-11', branch: 'bacoor', total_sales_minor: 7000, paid_count: 1, transaction_count: 1, cash_sales_minor: 7000, gcash_sales_minor: 0, card_sales_minor: 0, online_sales_minor: 0 },
  ]

  it('salesByDay aggregates by date and sorts newest first', () => {
    const out = salesByDay(rows)
    assert.equal(out.length, 2)
    assert.equal(out[0].sale_date, '2026-08-11')
    assert.equal(out[1].sale_date, '2026-08-10')
    assert.equal(out[1].total_sales_minor, 15000)
    assert.equal(out[1].paid_count, 3)
  })

  it('salesByBranch aggregates by branch and sorts by revenue', () => {
    const out = salesByBranch(rows)
    assert.equal(out.length, 2)
    assert.equal(out[0].branch, 'bacoor')
    assert.equal(out[0].total_sales_minor, 17000)
    assert.equal(out[1].branch, 'batangas')
  })
})

describe('retentionBuckets', () => {
  it('splits customers into fresh / returning / loyal', () => {
    const out = retentionBuckets([
      { paid_sales: 1 },
      { paid_sales: 1 },
      { paid_sales: 3 },
      { paid_sales: 5 },
      { paid_sales: 12 },
      { paid_sales: 0 },
    ])
    assert.equal(out.fresh, 2)
    assert.equal(out.returning, 1)
    assert.equal(out.loyal, 2)
    assert.equal(out.total, 5)
  })
})

describe('exports', () => {
  it('toCsv produces a header + rows with proper escaping', () => {
    const rows = [{ name: 'Rent', amount: 30000 }, { name: 'Pay,roll', amount: 80000 }]
    const cols = [
      { key: 'name', label: 'Category' },
      { key: 'amount', label: 'Amount' },
    ]
    const csv = toCsv(rows, cols)
    const lines = csv.split('\n')
    assert.equal(lines[0], 'Category,Amount')
    assert.equal(lines[1], 'Rent,30000')
    assert.equal(lines[2], '"Pay,roll",80000')
  })

  it('toExcelHtml wraps rows in an HTML table', () => {
    const html = toExcelHtml([{ name: 'Rent', amount: 30000 }], [
      { key: 'name', label: 'Category' },
      { key: 'amount', label: 'Amount' },
    ], 'Hakum P&L')
    assert.match(html, /<table border="1">/)
    assert.match(html, /Hakum P&amp;L/)
    assert.match(html, /<td>Rent<\/td>/)
  })
})

describe('branchScopeList', () => {
  it('super_admin sees all branches', () => {
    assert.equal(branchScopeList({ role: 'super_admin' }), null)
  })

  it('admin with one branch slug is scoped to that branch', () => {
    assert.deepEqual(branchScopeList({ role: 'admin', branch_slug: 'bacoor' }), ['bacoor'])
  })

  it('admin with multiple branch_slugs is scoped to that list', () => {
    assert.deepEqual(
      branchScopeList({ role: 'admin', branch_slugs: ['bacoor', 'batangas'] }),
      ['bacoor', 'batangas'],
    )
  })

  it('assistant_super_admin with branches_all grant sees all', () => {
    assert.equal(
      branchScopeList({ role: 'assistant_super_admin', grants: ['branches_all'] }),
      null,
    )
  })
})
