import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DAY_MS, activityInRange, isoDay } from '../src/lib/customerActivity.js'

describe('home recent activity window', () => {
  const now = new Date('2026-11-14T12:00:00').getTime()
  const rows = [
    { id: 'a', at: new Date(now - 2 * DAY_MS).toISOString() },
    { id: 'b', at: new Date(now - 29 * DAY_MS).toISOString() },
    { id: 'c', at: new Date(now - 45 * DAY_MS).toISOString() },
    { id: 'd', at: null },
  ]
  const dateOf = (row) => row.at

  it('shows the last month by default', () => {
    assert.deepEqual(activityInRange(rows, dateOf, null, now).map((r) => r.id), ['a', 'b'])
  })

  it('shows older rows when the customer picks dates', () => {
    const range = { from: isoDay(now - 60 * DAY_MS), to: isoDay(now - 40 * DAY_MS) }
    assert.deepEqual(activityInRange(rows, dateOf, range, now).map((r) => r.id), ['c'])
  })

  it('formats local calendar days', () => {
    assert.equal(isoDay(new Date(2026, 0, 5)), '2026-01-05')
  })
})
