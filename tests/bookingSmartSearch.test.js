import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDashboardDateRange,
  matchesBookingSmartSearch,
} from '../src/queue/queueLogic.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('booking date ranges include later dates', () => {
  it('week/month/year end at period end, not today', () => {
    // Wednesday mid-week
    const wed = new Date(2026, 7, 12, 12, 0, 0) // Aug 12 2026
    const week = getDashboardDateRange('week', '', '', wed)
    assert.equal(week.start.getDay(), 1) // Monday
    assert.equal(week.end.getDay(), 0) // Sunday
    assert.ok(week.end > wed, 'week end must be after mid-week now')

    const month = getDashboardDateRange('month', '', '', wed)
    assert.equal(month.end.getDate(), 31)
    assert.ok(month.end.getDate() > wed.getDate())

    const year = getDashboardDateRange('year', '', '', wed)
    assert.equal(year.end.getMonth(), 11)
    assert.equal(year.end.getDate(), 31)
  })

  it('all dates returns unbounded range; upcoming starts today', () => {
    const now = new Date(2026, 7, 10, 9, 0, 0)
    assert.deepEqual(getDashboardDateRange('all', '', '', now), { start: null, end: null })
    const up = getDashboardDateRange('upcoming', '', '', now)
    assert.equal(up.start.toLocaleDateString('en-CA'), '2026-08-10')
    assert.ok(up.end.getFullYear() === 2027)
  })
})

describe('booking smart search', () => {
  it('matches name phone plate branch status service', () => {
    const booking = {
      customer_name: 'Ana Cruz',
      customer_phone: '09171234567',
      vehicle_plate: 'ABC-123',
      vehicle_make: 'Honda',
      vehicle_model: 'City',
      branch: 'bacoor',
      status: 'waiting',
      status_label: 'In Take Started',
      services: { name: 'Ceramic Coating' },
    }
    const names = { bacoor: 'Hakum Auto Care Bacoor' }
    assert.equal(matchesBookingSmartSearch(booking, 'ana', names), true)
    assert.equal(matchesBookingSmartSearch(booking, '0917', names), true)
    assert.equal(matchesBookingSmartSearch(booking, 'abc', names), true)
    assert.equal(matchesBookingSmartSearch(booking, 'bacoor', names), true)
    assert.equal(matchesBookingSmartSearch(booking, 'take', names), true)
    assert.equal(matchesBookingSmartSearch(booking, 'ceramic', names), true)
    assert.equal(matchesBookingSmartSearch(booking, 'zzz', names), false)
  })

  it('table tab wires all-dates search into the data grid', async () => {
    const jsx = await readFile(resolve(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    assert.match(jsx, /All dates/)
    assert.match(jsx, /Upcoming/)
    assert.match(jsx, /matchesBookingSmartSearch/)
    assert.match(jsx, /bk-smart-search|Search name, phone, plate/)
    assert.match(jsx, /bk-data-grid/)
    assert.match(jsx, /filteredBookings/)
    assert.match(jsx, /datePreset === 'all'/)
  })
})
