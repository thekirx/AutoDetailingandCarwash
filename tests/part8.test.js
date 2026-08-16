import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatAuditDetail } from '../src/lib/auditDetail.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aggregateByService,
  averageCycleMinutes,
  bookingCycleMinutes,
  compareBranchesByCompleted,
  kpiStatHover,
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

  it('builds hover stats with sample size and share of range', () => {
    const rows = [
      {
        status: 'completed',
        waiting_at: '2026-07-26T02:00:00.000Z',
        in_progress_at: '2026-07-26T02:10:00.000Z',
        for_payment_at: '2026-07-26T02:40:00.000Z',
      },
      { status: 'cancelled' },
      { status: 'in_progress', redo_at: '2026-07-26T03:00:00.000Z' },
    ]
    const hover = kpiStatHover(rows, { salesTotal: 125000, complaintsCount: 2 })
    assert.equal(hover.cycle.lines.find((l) => l.label === 'Tickets timed').value, '1')
    assert.equal(hover.wait.lines.find((l) => l.label === 'Tickets timed').value, '1')
    assert.equal(hover.cancelled.lines.find((l) => l.label === 'Share of range').value, '33.3%')
    assert.equal(hover.failedQa.lines.find((l) => l.label === 'Redo tickets').value, '1')
    assert.equal(hover.sales.lines.find((l) => l.label === 'Paid sales').value, '125000')
    assert.equal(hover.complaints.lines.find((l) => l.label === 'Open complaints').value, '2')
  })
})

describe('KPI hover chrome', () => {
  it('uses a stats popover instead of native title tooltips', () => {
    const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/pages/KpiPage.jsx'), 'utf8')
    assert.match(page, /kpiStatHover/)
    assert.match(page, /kpi-stat-hover/)
    assert.match(page, /TooltipContent/)
    assert.doesNotMatch(page, /title="Average in_progress/)
    assert.doesNotMatch(page, /bg-\[#0d1726\]/)
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
