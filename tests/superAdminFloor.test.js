import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aggregateSalesFinancials,
  normalizePaymentMethod,
  PAYMENT_METHODS,
  paymentMethodLabel,
} from '../src/lib/paymentMethods.js'
import {
  averageCycleMinutes,
  bookingWaitMinutes,
  failedQaCount,
  totalWaitMinutes,
} from '../src/lib/kpiPart8.js'
import { getCrewAttendanceModel } from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('payment methods + SA financials', () => {
  it('POS methods are Cash, GCash, Credit/Debit', () => {
    assert.deepEqual(
      PAYMENT_METHODS.map((m) => m.value),
      ['cash', 'gcash', 'card'],
    )
    assert.equal(paymentMethodLabel('card'), 'Credit Cards')
    assert.equal(normalizePaymentMethod('online'), 'card')
    assert.equal(normalizePaymentMethod('gcash'), 'gcash')
  })

  it('aggregates queue vs POS and payment buckets', () => {
    const fin = aggregateSalesFinancials([
      { status: 'paid', total_minor: 10000, payment_method: 'cash', booking_id: 'b1' },
      { status: 'paid', total_minor: 20000, payment_method: 'gcash', booking_id: null },
      { status: 'paid', total_minor: 30000, payment_method: 'card', booking_id: 'b2' },
      { status: 'paid', total_minor: 5000, payment_method: 'online', booking_id: null },
      { status: 'refunded', total_minor: 99999, payment_method: 'cash', booking_id: null },
    ])
    assert.equal(fin.total_sales_minor, 65000)
    assert.equal(fin.queue_sales_minor, 40000)
    assert.equal(fin.pos_sales_minor, 25000)
    assert.equal(fin.cash_sales_minor, 10000)
    assert.equal(fin.gcash_sales_minor, 20000)
    assert.equal(fin.card_sales_minor, 35000)
    assert.equal(fin.paid_count, 4)
  })
})

describe('SA floor KPI helpers', () => {
  it('sums wait and averages service cycle; counts failed QA', () => {
    const rows = [
      {
        waiting_at: '2026-08-08T02:00:00.000Z',
        in_progress_at: '2026-08-08T02:20:00.000Z',
        final_checking_at: '2026-08-08T03:20:00.000Z',
      },
      {
        waiting_at: '2026-08-08T04:00:00.000Z',
        in_progress_at: '2026-08-08T04:10:00.000Z',
        completed_at: '2026-08-08T05:10:00.000Z',
        redo_at: '2026-08-08T04:50:00.000Z',
      },
    ]
    assert.equal(bookingWaitMinutes(rows[0]), 20)
    assert.equal(totalWaitMinutes(rows), 30)
    assert.equal(Math.round(averageCycleMinutes(rows)), 60)
    assert.equal(failedQaCount(rows), 1)
    assert.equal(failedQaCount([{ status: 'redo' }]), 1)
  })
})

describe('crew roster available vs absent', () => {
  it('treats late as on-site and counts absent / not checked in', () => {
    const model = getCrewAttendanceModel({
      staffPool: [
        { id: 'a', full_name: 'Ana', role: 'staff', branch_slug: 'bacoor', is_active: true },
        { id: 'b', full_name: 'Ben', role: 'staff', branch_slug: 'bacoor', is_active: true },
        { id: 'c', full_name: 'Cal', role: 'staff', branch_slug: 'bacoor', is_active: true },
        { id: 'd', full_name: 'Dan', role: 'staff', branch_slug: 'bacoor', is_active: true },
      ],
      attendance: [
        { staff_id: 'a', status: 'present' },
        { staff_id: 'b', status: 'late' },
        { staff_id: 'c', status: 'absent' },
      ],
      busyStaff: [{ staff_id: 'b', booking_id: 'x', booking_status: 'in_progress' }],
    })
    assert.equal(model.availableCount, 1)
    assert.equal(model.availableStaff[0].staff_id, 'a')
    assert.equal(model.onBayCount, 1)
    assert.equal(model.absentCount, 2)
    assert.ok(model.absentStaff.some((r) => r.staff_id === 'c'))
    assert.ok(model.absentStaff.some((r) => r.staff_id === 'd'))
  })
})

describe('Super Admin floor wiring', () => {
  it('dashboard routes network scope to SuperAdminFloorBoard', () => {
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    const board = readFileSync(join(root, 'src/pages/SuperAdminFloorBoard.jsx'), 'utf8')
    const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(page, /import SuperAdminFloorBoard/)
    assert.match(page, /return <SuperAdminFloorBoard/)
    assert.match(page, /canSeeAllBranches\(profile\)/)
    assert.match(board, /fetchSuperAdminFloorBoard/)
    assert.match(board, /Services & Packages/)
    assert.match(board, /Detailing Services/)
    assert.match(board, /Floor Board/)
    assert.match(board, /Cancel loss/)
    assert.match(board, /Failed QA/)
    assert.match(board, /Avg waiting time/)
    assert.doesNotMatch(board, /label=["']Paid sales["']/)
    assert.doesNotMatch(board, /Net profit|Net loss/)
    assert.match(board, /openHistory/)
    assert.doesNotMatch(board, /QueueTicketEditModal/)
    assert.doesNotMatch(board, /title=["']Job details["']/)
    assert.match(api, /export async function fetchSuperAdminFloorBoard/)
    assert.match(api, /avg_wait_minutes/)
    assert.match(pos, /PAYMENT_METHODS/)
    const payLib = readFileSync(join(root, 'src/lib/paymentMethods.js'), 'utf8')
    assert.match(payLib, /Credit Cards/)
    assert.ok(!/Online transfer/.test(pos))
  })
})
