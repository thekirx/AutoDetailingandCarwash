import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLocalCalendarDate, OPS_TIME_ZONE, isoToDatetimeLocalValue, datetimeLocalToIso } from '../src/lib/localCalendarDate.js'

describe('local calendar date (ops attendance)', () => {
  it('exports Asia/Manila as ops zone', () => {
    assert.equal(OPS_TIME_ZONE, 'Asia/Manila')
  })

  it('formats a known instant to Manila calendar date', () => {
    // 2026-07-27 16:00 UTC = 2026-07-28 00:00 Asia/Manila
    const d = new Date('2026-07-27T16:00:00.000Z')
    assert.equal(getLocalCalendarDate(d), '2026-07-28')
  })

  it('keeps previous Manila day before midnight Manila', () => {
    // 2026-07-27 15:59 UTC = 2026-07-27 23:59 Asia/Manila
    const d = new Date('2026-07-27T15:59:00.000Z')
    assert.equal(getLocalCalendarDate(d), '2026-07-27')
  })

  it('does not match naive UTC slice for early PH morning', () => {
    const d = new Date('2026-07-27T16:30:00.000Z')
    assert.notEqual(getLocalCalendarDate(d), d.toISOString().slice(0, 10))
    assert.equal(getLocalCalendarDate(d), '2026-07-28')
  })

  it('maps planner due_at to Manila datetime-local, not a UTC slice', () => {
    assert.equal(isoToDatetimeLocalValue('2026-08-18T02:00:00.000Z'), '2026-08-18T10:00')
    assert.equal(datetimeLocalToIso('2026-08-18T10:00'), '2026-08-18T02:00:00.000Z')
    assert.equal(datetimeLocalToIso(''), null)
    assert.notEqual(isoToDatetimeLocalValue('2026-08-18T02:00:00.000Z'), String('2026-08-18T02:00:00.000Z').slice(0, 16))
  })
})
