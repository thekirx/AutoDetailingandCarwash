import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  rollupSales,
  paymentTypes,
  salesCompareWindow,
  salesPeriodLabel,
  salesByLocation,
  laborMinor,
  laborPct,
  vsPrior,
  topItems,
  grossByMonth,
} from '../src/lib/salesSummary.js'

// 2026-09-28 16:17 Manila (Monday)
const NOW = new Date('2026-09-28T08:17:00Z')

const sale = (over = {}) => ({
  id: over.id || Math.random().toString(36).slice(2),
  branch: 'bacoor',
  occurred_at: '2026-09-28T02:00:00Z',
  status: 'paid',
  total_minor: 10000,
  discount_minor: 0,
  payment_method: 'cash',
  ...over,
})

describe('rollupSales', () => {
  it('matches Square gross, net, discounts, refunds and average', () => {
    const s = rollupSales([
      sale({ total_minor: 90000, discount_minor: 10000 }),
      sale({ total_minor: 50000, payment_method: 'gcash' }),
      sale({ total_minor: 20000, status: 'refunded' }),
      sale({ total_minor: 99999, status: 'voided' }),
      sale({ total_minor: 99999, status: 'pending' }),
    ])
    assert.equal(s.grossMinor, 170000)
    assert.equal(s.discountsMinor, 10000)
    assert.equal(s.refundsMinor, 20000)
    assert.equal(s.netMinor, 140000)
    assert.equal(s.netMinor, s.grossMinor - s.refundsMinor - s.discountsMinor)
    assert.equal(s.count, 3)
    assert.equal(s.avgMinor, Math.round(170000 / 3))
    assert.equal(s.collectedMinor, 140000)
  })

  it('is all zeros for no rows', () => {
    const s = rollupSales([])
    assert.equal(s.grossMinor, 0)
    assert.equal(s.avgMinor, 0)
  })
})

describe('paymentTypes', () => {
  it('buckets cash / gcash / card (online counts as card) and shares add to 100', () => {
    const s = rollupSales([
      sale({ total_minor: 60000 }),
      sale({ total_minor: 25000, payment_method: 'gcash' }),
      sale({ total_minor: 10000, payment_method: 'card' }),
      sale({ total_minor: 5000, payment_method: 'online' }),
    ])
    const types = paymentTypes(s)
    assert.deepEqual(types.map((t) => t.id), ['cash', 'gcash', 'card'])
    assert.equal(types.reduce((a, t) => a + t.minor, 0), s.collectedMinor)
    assert.equal(types.find((t) => t.id === 'card').minor, 15000)
    assert.equal(types.find((t) => t.id === 'cash').share, 60)
    assert.equal(Math.round(types.reduce((a, t) => a + t.share, 0)), 100)
  })

  it('shows Other only when a paid sale has no known method', () => {
    const types = paymentTypes(rollupSales([sale({ payment_method: null })]))
    assert.ok(types.some((t) => t.id === 'other' && t.minor === 10000))
  })
})

describe('salesCompareWindow', () => {
  it('Today compares the same weekday last week up to the same time', () => {
    const w = salesCompareWindow('today', { start: '2026-09-28', end: '2026-09-28' }, NOW)
    assert.equal(w.start, '2026-09-21')
    assert.equal(w.end, '2026-09-21')
    assert.equal(w.cutoffIso, '2026-09-21T16:17:00+08:00')
    assert.equal(w.endIso, w.cutoffIso)
    assert.equal(w.label, 'vs Sep 21, 2026 (up to 4:17 pm)')
  })

  it('Month to date compares last month to the same day', () => {
    const w = salesCompareWindow('month', { start: '2026-09-01', end: '2026-09-30' }, NOW)
    assert.equal(w.start, '2026-08-01')
    assert.equal(w.end, '2026-08-28')
    assert.equal(w.cutoffIso, '2026-08-28T16:17:00+08:00')
    assert.equal(w.label, 'vs Aug 1 to Aug 28, 2026')
  })

  it('Month clamps to the end of a shorter prior month', () => {
    const w = salesCompareWindow('month', { start: '2026-03-01', end: '2026-03-31' }, new Date('2026-03-31T04:00:00Z'))
    assert.equal(w.start, '2026-02-01')
    assert.equal(w.end, '2026-02-28')
  })

  it('Quarter to date compares the previous quarter', () => {
    const w = salesCompareWindow('quarter', { start: '2026-07-01', end: '2026-09-30' }, NOW)
    assert.equal(w.start, '2026-04-01')
    assert.equal(w.end, '2026-06-28')
  })

  it('Year to date compares last year to the same date', () => {
    const w = salesCompareWindow('year', { start: '2026-01-01', end: '2026-12-31' }, NOW)
    assert.equal(w.start, '2025-01-01')
    assert.equal(w.end, '2025-09-28')
    assert.equal(w.label, 'vs Jan 1 to Sep 28, 2025')
  })

  it('Week to date compares last week', () => {
    const w = salesCompareWindow('week', { start: '2026-09-28', end: '2026-10-04' }, NOW)
    assert.equal(w.start, '2026-09-21')
    assert.equal(w.end, '2026-09-21')
  })

  it('Other presets use the equal-length previous window with no cutoff', () => {
    const w = salesCompareWindow('last_7', { start: '2026-09-22', end: '2026-09-28' }, NOW)
    assert.equal(w.start, '2026-09-15')
    assert.equal(w.end, '2026-09-21')
    assert.equal(w.cutoffIso, null)
    assert.equal(w.endIso, '2026-09-21T23:59:59.999+08:00')
  })
})

describe('salesPeriodLabel', () => {
  it('names the period like Square', () => {
    assert.equal(salesPeriodLabel('today', { start: '2026-09-28', end: '2026-09-28' }), 'Today, Sep 28, 2026')
    assert.equal(salesPeriodLabel('year', { start: '2026-01-01', end: '2026-12-31' }), 'This year, 2026')
    assert.equal(salesPeriodLabel('quarter', { start: '2026-07-01', end: '2026-09-30' }), 'This quarter, Q3 2026')
    assert.equal(salesPeriodLabel('month', { start: '2026-09-01', end: '2026-09-30' }), 'This month, Sep 2026')
  })
})

describe('vsPrior / laborPct', () => {
  it('is N/A (null) when the prior value is 0', () => {
    assert.equal(vsPrior(500, 0), null)
    assert.equal(vsPrior(0, 0), null)
    assert.equal(vsPrior(50, 100), -50)
  })

  it('labor % is null when net is 0', () => {
    assert.equal(laborPct(1000, 0), null)
    assert.equal(laborPct(2500, 10000), 25)
  })
})

describe('laborMinor', () => {
  const cats = [{ id: 'c-pay', kind: 'payroll' }, { id: 'c-gen', kind: 'general' }]
  const exps = [
    { branch: 'bacoor', status: 'posted', expense_kind: 'salary_carwash', total_minor: 3000 },
    { branch: 'bacoor', status: 'paid', category_id: 'c-pay', total_minor: 2000 },
    { branch: 'batangas', status: 'paid', expense_kind: 'salary_detailer', total_minor: 4000 },
    { branch: 'bacoor', status: 'draft', expense_kind: 'salary_carwash', total_minor: 9999 },
    { branch: 'bacoor', status: 'paid', category_id: 'c-gen', total_minor: 9999 },
  ]
  it('sums paid/posted salary or payroll-category expenses', () => {
    assert.equal(laborMinor(exps, cats), 9000)
    assert.equal(laborMinor(exps, cats, 'bacoor'), 5000)
  })
})

describe('salesByLocation', () => {
  it('computes net, transactions and change per branch', () => {
    const cur = [
      sale({ branch: 'bacoor', total_minor: 964000 }),
      sale({ branch: 'batangas', total_minor: 619000 }),
    ]
    const prior = [sale({ branch: 'bacoor', total_minor: 1313000 })]
    const rows = salesByLocation(cur, prior, { bacoor: 96400 })
    assert.equal(rows[0].branch, 'bacoor')
    assert.equal(rows[0].netMinor, 964000)
    assert.equal(rows[0].count, 1)
    assert.equal(rows[0].netPct, -26.6)
    assert.equal(rows[0].countPct, 0)
    assert.equal(rows[0].laborPct, 10)
    assert.equal(rows[1].netPct, null)
    assert.equal(rows[1].laborPct, 0)
  })
})

describe('topItems', () => {
  it('sums count (quantity) and gross per item, sorted by gross', () => {
    const items = topItems([
      { name: 'Premium Car Wash', item_type: 'service', quantity: 2, line_total_minor: 50000 },
      { name: 'Premium Car Wash', item_type: 'service', quantity: 1, line_total_minor: 25000 },
      { name: 'Basic', item_type: 'service', quantity: null, line_total_minor: 74000 },
    ], 10)
    assert.deepEqual(items[0], { name: 'Premium Car Wash', count: 3, grossMinor: 75000 })
    assert.deepEqual(items[1], { name: 'Basic', count: 1, grossMinor: 74000 })
  })
})

describe('grossByMonth', () => {
  it('buckets gross by Manila month for this year vs last year', () => {
    const series = grossByMonth(
      [sale({ occurred_at: '2026-01-31T17:00:00Z', total_minor: 10000 })],
      [sale({ occurred_at: '2025-02-10T02:00:00Z', total_minor: 5000, discount_minor: 1000 })],
      NOW,
    )
    assert.equal(series.length, 9)
    assert.equal(series[1].month, 'Feb')
    assert.equal(series[1].current, 100)
    assert.equal(series[1].prior, 60)
    assert.equal(series[0].current, 0)
  })
})
