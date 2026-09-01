import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  averageCycleMinutes,
  averageWaitMinutes,
  bookingWaitMinutes,
  failedQaCount,
  totalWaitMinutes,
  uniqueBookingsById,
} from '../src/lib/kpiPart8.js'

describe('averageWaitMinutes (owner floor KPI)', () => {
  it('averages wait→start minutes across stamped tickets', () => {
    const bookings = [
      { waiting_at: '2026-08-01T10:00:00Z', in_progress_at: '2026-08-01T10:10:00Z' },
      { waiting_at: '2026-08-01T11:00:00Z', in_progress_at: '2026-08-01T11:20:00Z' },
    ]
    assert.equal(totalWaitMinutes(bookings), 30)
    assert.equal(averageWaitMinutes(bookings), 15)
    assert.equal(bookingWaitMinutes(bookings[0]), 10)
  })

  it('returns null when no wait stamps', () => {
    assert.equal(averageWaitMinutes([{ status: 'waiting' }]), null)
    assert.equal(averageWaitMinutes([]), null)
  })

  it('still averages service cycle for avg time per service', () => {
    const rows = [
      {
        in_progress_at: '2026-08-08T02:20:00.000Z',
        final_checking_at: '2026-08-08T03:20:00.000Z',
      },
      {
        in_progress_at: '2026-08-08T04:10:00.000Z',
        completed_at: '2026-08-08T05:10:00.000Z',
      },
    ]
    assert.equal(Math.round(averageCycleMinutes(rows)), 60)
    assert.equal(failedQaCount([{ redo_at: '2026-08-08T04:50:00.000Z' }]), 1)
  })

  it('dedupes cycle sample tickets by booking_id', () => {
    const dup = [
      {
        booking_id: 'a',
        in_progress_at: '2026-08-08T02:00:00.000Z',
        completed_at: '2026-08-08T03:00:00.000Z',
      },
      {
        booking_id: 'a',
        in_progress_at: '2026-08-08T02:00:00.000Z',
        completed_at: '2026-08-08T03:00:00.000Z',
      },
      {
        booking_id: 'b',
        in_progress_at: '2026-08-08T04:00:00.000Z',
        completed_at: '2026-08-08T05:00:00.000Z',
      },
    ]
    const uniq = uniqueBookingsById(dup)
    assert.equal(uniq.length, 2)
    assert.equal(Math.round(averageCycleMinutes(uniq)), 60)
  })
})
