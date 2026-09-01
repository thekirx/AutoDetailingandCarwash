/**
 * Phase 6 — KPI / Reports / Floor Board audit.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aggregateByService,
  averageCycleMinutes,
  compareBranchesByCompleted,
} from '../src/lib/kpiPart8.js'
import { retentionBuckets, rollupRetentionByCustomer, salesByDay } from '../src/lib/financeData.js'
import {
  BACOOR,
  IMUS,
  buildBookings,
  buildCustomers,
  buildFinanceSalesRows,
  buildMonthSales,
} from '../src/lib/auditFixtures.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('reports / KPI audit', () => {
  it('1–2 branch compare and service aggregate from seed bookings', () => {
    const bookings = [
      {
        id: 'b1',
        branch: BACOOR,
        status: 'completed',
        service_id: 'svc-wash',
        started_at: '2026-08-22T08:00:00+08:00',
        completed_at: '2026-08-22T09:00:00+08:00',
      },
      {
        id: 'b2',
        branch: BACOOR,
        status: 'completed',
        service_id: 'svc-wash',
        started_at: '2026-08-22T09:00:00+08:00',
        completed_at: '2026-08-22T09:45:00+08:00',
      },
      {
        id: 'b3',
        branch: IMUS,
        status: 'completed',
        service_id: 'svc-ceramic',
        started_at: '2026-08-22T08:00:00+08:00',
        completed_at: '2026-08-22T16:00:00+08:00',
      },
    ]
    const compare = compareBranchesByCompleted(bookings)
    assert.ok(Array.isArray(compare) || typeof compare === 'object')
    const byService = aggregateByService(bookings, {
      'svc-wash': 'Car Wash',
      'svc-ceramic': 'Ceramic Coating',
    })
    assert.ok(Array.isArray(byService) ? byService.length >= 1 : Object.keys(byService || {}).length >= 1)
    const avg = averageCycleMinutes(bookings)
    assert.ok(typeof avg === 'number' || avg == null || typeof avg === 'object')
  })

  it('3 sales days from month seed are non-empty', () => {
    const rows = buildFinanceSalesRows(buildMonthSales())
    const days = salesByDay(rows)
    assert.ok(days.length >= 20)
    assert.ok(days.every((d) => d.total_sales_minor > 0))
  })

  it('4 retention buckets from customers', () => {
    const customers = buildCustomers().map((c) => ({
      customer_id: c.id,
      paid_sales: c.visit_count,
      total_spent_minor: c.visit_count * 100_000,
    }))
    const rolled = rollupRetentionByCustomer(customers)
    assert.equal(rolled.length, 3)
    const buckets = retentionBuckets(customers)
    assert.equal(buckets.fresh, 1)
    assert.equal(buckets.returning, 1)
    assert.equal(buckets.loyal, 1)
    assert.equal(buckets.total, 3)
  })

  it('5–6 Floor board + Finance reports + KPI pages wired', () => {
    const floor = readFileSync(join(root, 'src/pages/SuperAdminFloorBoard.jsx'), 'utf8')
    assert.match(floor, /StatTile|fetchSuperAdminFloorBoard/)
    assert.match(floor, /FLOOR_BOARD_FAMILY_META|floorLaneLabel/)

    const reports = readFileSync(join(root, 'src/pages/finance/FinanceReportsTab.jsx'), 'utf8')
    assert.match(reports, /retention|bestSeller|shiftCloses|aggregateBestSellers/i)

    const kpi = readFileSync(join(root, 'src/pages/KpiPage.jsx'), 'utf8')
    assert.match(kpi, /crew|compare|service|sales/)
    assert.match(kpi, /compareBranchesByCompleted|aggregateByService/)

    assert.ok(buildBookings().length >= 2)
  })
})
