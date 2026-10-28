import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDaylightDuration, groupDaylightQueue, queueSummary, longestWaitingMinutes } from '../src/queue/daylightPresentation.js'

// These guard visible grouping and truthful time/count labels, not stored status rules.
describe('Daylight queue presentation', () => {
  it('groups final check first without duplicating a visit, and keeps every loaded lane', () => {
    const rows = ['waiting', 'in_progress', 'final_checking', 'redo', 'for_payment', 'completed', 'cancelled'].map((status, i) => ({ booking_id: String(i), status }))
    const groups = groupDaylightQueue([...rows, rows[0]], true)
    assert.deepEqual(groups.map(g => g.key), ['your_move', 'waiting', 'in_progress', 'redo', 'for_payment', 'completed', 'cancelled'])
    assert.equal(groups.flatMap(g => g.tickets).length, rows.length)
    assert.deepEqual(groupDaylightQueue(rows, false).map(g => g.key), ['waiting', 'in_progress', 'final_checking', 'redo', 'for_payment', 'completed', 'cancelled'])
    assert.equal(rows[2].status, 'final_checking')
  })
  it('orders a lane by queue number so the first arrival is first', () => {
    const groups = groupDaylightQueue([
      { booking_id: 'late', status: 'waiting', queue_number: 8, waiting_at: '2026-10-28T02:00:00Z' },
      { booking_id: 'first', status: 'waiting', queue_number: 2, waiting_at: '2026-10-28T01:00:00Z' },
      { booking_id: 'mid', status: 'waiting', queue_number: 5, waiting_at: '2026-10-28T01:30:00Z' },
    ], false)
    assert.deepEqual(groups[0].tickets.map(t => t.booking_id), ['first', 'mid', 'late'])
  })
  it('marks an unavailable payment count as unknown instead of inventing zero', () => {
    const rows = [{ status: 'waiting' }, { status: 'final_checking' }]
    assert.deepEqual(queueSummary(rows, ['waiting', 'in_progress', 'final_checking', 'redo']).map(s => s.value), [1, 0, 1, null])
    assert.equal(queueSummary([], ['for_payment'])[3].value, 0)
  })
  it('formats minute labels and suppresses invalid or older-than-day values', () => {
    assert.equal(formatDaylightDuration(12), '12 min')
    assert.equal(formatDaylightDuration(73), '73 min')
    for (const n of [null, undefined, NaN, -1, 1441, 84883]) assert.equal(formatDaylightDuration(n), '—')
  })
  it('uses the longest waiting duration and leaves stale data visibly unknown', () => {
    const now = new Date('2026-10-12T04:00:00Z').getTime()
    const ticket = minutes => ({ status: 'waiting', waiting_at: new Date(now - minutes * 60000).toISOString() })
    assert.equal(longestWaitingMinutes([ticket(4), ticket(12)], now), 12)
    assert.equal(formatDaylightDuration(longestWaitingMinutes([ticket(12), ticket(84883)], now)), '—')
    assert.equal(longestWaitingMinutes([], now), null)
  })
})
