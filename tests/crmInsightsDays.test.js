import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateSalesByWeekday,
  bestWeekday,
  countWeekdays,
  filterSalesByWeekdays,
  insightsDateRange,
  topSalesDates,
  weekdayBranchBreakdown,
} from '../src/lib/crmInsights.js'

const TODAY = '2026-10-09' // Friday
const sale = (date, branch, pesos, hour = 10) => ({ id: `${date}-${branch}-${pesos}`, branch, total_minor: pesos * 100, occurred_at: `${date}T${String(hour).padStart(2, '0')}:00:00+08:00` })

describe('CRM Insights date presets (Asia/Manila keys)', () => {
  it('resolves presets against today and never runs past it', () => {
    assert.deepEqual(insightsDateRange('today', '', '', TODAY), { start: TODAY, end: TODAY })
    assert.deepEqual(insightsDateRange('yesterday', '', '', TODAY), { start: '2026-10-08', end: '2026-10-08' })
    assert.deepEqual(insightsDateRange('last7', '', '', TODAY), { start: '2026-10-03', end: TODAY })
    assert.deepEqual(insightsDateRange('week', '', '', TODAY), { start: '2026-10-05', end: TODAY })
    assert.deepEqual(insightsDateRange('month', '', '', TODAY), { start: '2026-10-01', end: TODAY })
    assert.deepEqual(insightsDateRange('last_month', '', '', TODAY), { start: '2026-09-01', end: '2026-09-30' })
    assert.deepEqual(insightsDateRange('last_month', '', '', '2026-01-15'), { start: '2025-12-01', end: '2025-12-31' })
    assert.deepEqual(insightsDateRange('3mo', '', '', TODAY), { start: '2026-07-09', end: TODAY })
    assert.deepEqual(insightsDateRange('3mo', '', '', '2026-05-31'), { start: '2026-02-28', end: '2026-05-31' })
    assert.deepEqual(insightsDateRange('year', '', '', TODAY), { start: '2026-01-01', end: TODAY })
  })

  it('custom needs both dates and swaps a reversed range', () => {
    assert.equal(insightsDateRange('custom', '2026-09-01', '', TODAY), null)
    assert.deepEqual(insightsDateRange('custom', '2026-09-30', '2026-09-01', TODAY), { start: '2026-09-01', end: '2026-09-30' })
  })
})

describe('Profitable days', () => {
  // Oct 2026: Oct 3 Sat, Oct 4 Sun, Oct 5 Mon, Oct 9 Fri (today)
  const sales = [
    sale('2026-10-03', 'bacoor', 900), sale('2026-10-03', 'imus', 300),
    sale('2026-10-04', 'bacoor', 200),
    sale('2026-10-05', 'imus', 1000),
    sale('2026-10-09', 'bacoor', 100, 23),
  ]

  it('counts weekdays up to today only', () => {
    const c = countWeekdays('2026-10-01', '2026-10-31', TODAY)
    assert.equal(c[5], 2) // Oct 2, Oct 9
    assert.equal(c[6], 1) // Oct 3 (Oct 10+ is in the future)
  })

  it('averages revenue per day of that weekday and picks the best', () => {
    const rows = aggregateSalesByWeekday(sales, { start: '2026-10-01', end: '2026-10-31', today: TODAY })
    assert.deepEqual(rows.map((r) => r.short), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    const sat = rows.find((r) => r.short === 'Sat')
    assert.equal(sat.total_minor, 120000)
    assert.equal(sat.avg_minor, 120000)
    assert.equal(rows.find((r) => r.short === 'Fri').avg_minor, 5000) // ₱100 over 2 Fridays
    assert.equal(bestWeekday(rows).label, 'Saturday')
  })

  it('day filter keeps only chosen weekdays (Manila time, late sales stay on their day)', () => {
    assert.deepEqual(filterSalesByWeekdays(sales, [5]).map((s) => s.branch), ['bacoor'])
    const rows = aggregateSalesByWeekday(filterSalesByWeekdays(sales, [1, 5]), { start: '2026-10-01', end: TODAY, days: [1, 5], today: TODAY })
    assert.deepEqual(rows.map((r) => r.short), ['Mon', 'Fri'])
  })

  it('breaks down by branch with each branch best day, and lists top dates', () => {
    const opts = { start: '2026-10-01', end: TODAY, today: TODAY }
    const b = weekdayBranchBreakdown(sales, opts)
    assert.deepEqual(b.map((x) => [x.branch, x.best.label]), [['imus', 'Monday'], ['bacoor', 'Saturday']])
    const only = weekdayBranchBreakdown(sales, { ...opts, branches: ['silang'] })
    assert.equal(only[0].best, null)
    const top = topSalesDates(sales, 2)
    assert.deepEqual(top.map((d) => [d.date, d.total_minor, d.topBranch]), [['2026-10-03', 120000, 'bacoor'], ['2026-10-05', 100000, 'imus']])
  })
})
