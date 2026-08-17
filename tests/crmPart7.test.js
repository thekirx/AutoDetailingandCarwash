import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateBestSellers,
  aggregateLineItemsByFamily,
  aggregateLineItemsByService,
  aggregateSalesByBranch,
  aggregateSalesByHour,
  bookingSalesTotal,
  peakSalesHour,
  resolveKpiRpcBranch,
  chunkIds,
  collectPaged,
  collectInChunks,
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

  it('splits wash vs detailing and sums booking sales', () => {
    assert.equal(
      bookingSalesTotal([
        { status: 'paid', booking_id: 'b1', total_minor: 500 },
        { status: 'paid', total_minor: 100 },
        { status: 'void', booking_id: 'b2', total_minor: 999 },
      ]),
      500,
    )
    const split = aggregateLineItemsByFamily([
      { item_type: 'service', name: 'Wash', quantity: 1, line_total_minor: 200 },
      { item_type: 'service', name: 'Ceramic Coating', quantity: 1, line_total_minor: 800 },
      { item_type: 'service', pay_category: 'detailing', name: 'Tint', quantity: 1, line_total_minor: 300 },
      { item_type: 'product', name: 'Freshener', quantity: 1, line_total_minor: 50 },
    ])
    assert.equal(split.wash.length, 1)
    assert.equal(split.wash[0].name, 'Wash')
    assert.equal(split.wash[0].total_minor, 200)
    assert.equal(split.detailing.reduce((sum, row) => sum + row.total_minor, 0), 1100)
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

  it('collects paged rows until a short page', async () => {
    const pages = {
      '0-1': [1, 2],
      '2-3': [3],
    }
    const rows = await collectPaged(async (from, to) => pages[`${from}-${to}`] || [], 2)
    assert.deepEqual(rows, [1, 2, 3])
    assert.deepEqual(await collectPaged(async () => [], 1000), [])
  })

  it('pages each id chunk until a short page', async () => {
    const ids = ['a', 'b', 'c']
    const calls = []
    const rows = await collectInChunks(
      ids,
      async (chunk, from, to) => {
        calls.push({ chunk: chunk.join(','), from, to })
        if (chunk.length === 2 && from === 0) return [{ id: 1 }, { id: 2 }]
        if (chunk.length === 2 && from === 2) return [{ id: 3 }]
        return [{ id: 4 }]
      },
      { chunkSize: 2, pageSize: 2 },
    )
    assert.deepEqual(
      calls.map((c) => c.chunk),
      ['a,b', 'a,b', 'c'],
    )
    assert.deepEqual(
      rows.map((r) => r.id),
      [1, 2, 3, 4],
    )
    assert.deepEqual(await collectInChunks([], async () => [{ id: 99 }]), [])
  })

  it('chunks sale ids so PostgREST .in() stays under 200', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `s${i}`)
    const chunks = chunkIds(ids, 200)
    assert.equal(chunks.length, 3)
    assert.equal(chunks[0].length, 200)
    assert.equal(chunks[1].length, 200)
    assert.equal(chunks[2].length, 50)
    assert.deepEqual(chunkIds([], 200), [])
    assert.deepEqual(chunkIds(['a', null, 'b'], 200), [['a', 'b']])
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
