import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateByService,
  averageCycleMinutes,
  averageWaitMinutes,
  bookingWaitMinutes,
  failedQaCount,
  failedQaInRange,
  finishedForAverage,
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

  it('keeps failed QA after the job leaves redo, once per visit', () => {
    const rows = [
      { id: 'a', visit_group_id: 'v1', status: 'for_payment', redo_at: '2026-09-28T02:00:00.000Z' },
      { id: 'b', visit_group_id: 'v1', status: 'completed', redo_at: '2026-09-28T02:00:00.000Z' },
      { id: 'c', status: 'completed', redo_at: '2026-09-28T03:00:00.000Z', service_pay_category: 'detailing' },
    ]
    assert.equal(failedQaCount(rows), 2)
    const start = new Date('2026-09-28T00:00:00.000Z').getTime()
    const end = new Date('2026-09-28T23:59:59.000Z').getTime()
    assert.equal(failedQaInRange(rows, start, end), 2)
    assert.equal(
      failedQaInRange([{ id: 'old', status: 'completed', redo_at: '2026-09-01T00:00:00.000Z' }], start, end),
      0,
    )
  })

  it('averages only jobs that finished in the range, per service', () => {
    const start = new Date('2026-09-28T00:00:00.000Z').getTime()
    const end = new Date('2026-09-28T23:59:59.000Z').getTime()
    const rows = [
      {
        id: 'started-earlier',
        service_id: 'ceramic',
        status: 'completed',
        in_progress_at: '2026-09-27T02:00:00.000Z',
        for_payment_at: '2026-09-28T04:00:00.000Z',
      },
      {
        id: 'same-day',
        service_id: 'wash',
        status: 'for_payment',
        in_progress_at: '2026-09-28T01:00:00.000Z',
        for_payment_at: '2026-09-28T02:00:00.000Z',
      },
      {
        id: 'not-finished',
        service_id: 'wash',
        status: 'in_progress',
        in_progress_at: '2026-09-28T05:00:00.000Z',
      },
    ]
    const finished = finishedForAverage(rows, start, end)
    assert.deepEqual(finished.map((row) => row.id), ['started-earlier', 'same-day'])
    const byService = aggregateByService(finished, { ceramic: 'Ceramic', wash: 'Wash' })
    const ceramic = byService.find((row) => row.service_id === 'ceramic')
    const wash = byService.find((row) => row.service_id === 'wash')
    assert.equal(ceramic.avg_min, 26 * 60)
    assert.equal(wash.avg_min, 60)
    assert.equal(Math.round(averageCycleMinutes(finished)), Math.round((26 * 60 + 60) / 2))
  })
})
