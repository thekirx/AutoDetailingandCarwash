import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatAuditDetail } from '../src/lib/auditDetail.js'
import {
  aggregateByService,
  averageCycleMinutes,
  bookingCycleMinutes,
  compareBranchesByCompleted,
} from '../src/lib/kpiPart8.js'
import { normalizeCatalogPair } from '../src/lib/vehicleCatalog.js'

describe('Part 8 KPI helpers', () => {
  it('computes cycle minutes and averages', () => {
    const b = {
      status: 'completed',
      in_progress_at: '2026-07-26T02:00:00.000Z',
      for_payment_at: '2026-07-26T02:30:00.000Z',
      branch: 'bacoor',
      service_id: 's1',
    }
    assert.equal(bookingCycleMinutes(b), 30)
    assert.equal(Math.round(averageCycleMinutes([b, b])), 30)
    const cmp = compareBranchesByCompleted([b, { ...b, branch: 'imus' }])
    assert.equal(cmp.length, 2)
    const svc = aggregateByService([b], { s1: 'Wash' })
    assert.equal(svc[0].name, 'Wash')
  })
})

describe('Part 8 audit detail', () => {
  it('phrases vehicle delete and sales deduct', () => {
    assert.match(
      formatAuditDetail({
        action: 'delete',
        summary: 'Removed garage row',
        meta: { plate: 'ABC 1234' },
      }),
      /Deleted vehicle ABC 1234/,
    )
    assert.match(
      formatAuditDetail({
        action: 'deduct_sale',
        summary: 'Void line',
        meta: { deducted_minor: 1000000 },
      }),
      /Deducted sales ₱10,000/,
    )
  })
})

describe('Cars catalog edit normalize', () => {
  it('trims make/model for update uniqueness', () => {
    assert.deepEqual(normalizeCatalogPair('  Toyota  ', ' Vios '), { make: 'Toyota', model: 'Vios' })
    assert.deepEqual(normalizeCatalogPair('', '  '), { make: '', model: '' })
  })
})
