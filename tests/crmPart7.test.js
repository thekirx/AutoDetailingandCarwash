import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateBestSellers,
  aggregateLineItemsByService,
  aggregateSalesByBranch,
  aggregateSalesByHour,
  peakSalesHour,
  resolveKpiRpcBranch,
} from '../src/lib/crmInsights.js'
import { getDashboardDateRange } from '../src/queue/queueLogic.js'

describe('CRM insights Part 7', () => {
  it('aggregates hours and finds peak', () => {
    const sales = [
      { occurred_at: '2026-07-26T02:00:00.000Z', total_minor: 1000, branch: 'bacoor' }, // 10:00 Manila UTC+8
      { occurred_at: '2026-07-26T02:30:00.000Z', total_minor: 2000, branch: 'bacoor' },
      { occurred_at: '2026-07-26T04:00:00.000Z', total_minor: 500, branch: 'imus' },
    ]
    const hourly = aggregateSalesByHour(sales)
    const ten = hourly.find((h) => h.hour === 10)
    assert.equal(ten.count, 2)
    assert.equal(ten.total_minor, 3000)
    const peak = peakSalesHour(hourly)
    assert.equal(peak.hour, 10)
    const branches = aggregateSalesByBranch(sales)
    assert.equal(branches[0].branch, 'bacoor')
  })

  it('aggregates service lines', () => {
    const rows = aggregateLineItemsByService([
      { item_type: 'service', service_id: 'a', name: 'Wash', quantity: 2, line_total_minor: 400 },
      { item_type: 'product', name: 'Air freshener', quantity: 1, line_total_minor: 50 },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].count, 2)
  })

  it('aggregates best sellers in pesos with limit', () => {
    const top = aggregateBestSellers(
      [
        { item_type: 'service', name: 'Wash', line_total_minor: 50000 },
        { item_type: 'service', name: 'Wash', line_total_minor: 30000 },
        { item_type: 'product', name: 'Wax', line_total_minor: 10000 },
      ],
      1,
    )
    assert.equal(top.length, 1)
    assert.equal(top[0].name, 'Wash')
    assert.equal(top[0].total, 800)
  })

  it('resolves KPI RPC branch slug without passing arrays', () => {
    assert.equal(resolveKpiRpcBranch('all'), null)
    assert.equal(resolveKpiRpcBranch('bacoor'), 'bacoor')
    assert.equal(resolveKpiRpcBranch(['bacoor']), 'bacoor')
    assert.equal(resolveKpiRpcBranch(['bacoor', 'imus']), null)
    assert.equal(resolveKpiRpcBranch(null, 'legacy'), null)
  })
})

describe('booking date presets Part 7', () => {
  it('supports week month year', () => {
    const now = new Date('2026-07-26T12:00:00')
    const week = getDashboardDateRange('week', '', '', now)
    assert.ok(week.start <= now)
    const month = getDashboardDateRange('month', '', '', now)
    assert.equal(month.start.getDate(), 1)
    const year = getDashboardDateRange('year', '', '', now)
    assert.equal(year.start.getMonth(), 0)
  })
})
