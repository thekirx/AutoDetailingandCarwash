import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BIRTHDAY_GIFT_LABEL,
  BIRTHDAY_GIFT_TITLE,
  birthdayCardState,
  birthdayGreetedKey,
  formatPerkDate,
} from '../src/lib/birthdayPerk.js'

// Manila is UTC+8: 04:00Z = noon in Manila.
const at = (ymd) => new Date(`${ymd}T04:00:00Z`)
const perk = (expires, status = 'available') => ({ status, perk_year: 2026, expires_at: expires })

describe('birthdayCardState', () => {
  const dob = '1990-10-17'
  const live = perk('2026-11-16T04:00:00Z')

  it('shows the hero on the birthday itself', () => {
    const s = birthdayCardState(dob, live, at('2026-10-17'))
    assert.equal(s.mode, 'day')
    assert.equal(s.daysLeft, 30)
  })

  it('counts down on day 2', () => {
    const s = birthdayCardState(dob, live, at('2026-10-18'))
    assert.deepEqual(s, { mode: 'countdown', daysLeft: 29, urgent: false })
  })

  it('turns urgent in the last 7 days', () => {
    assert.equal(birthdayCardState(dob, live, at('2026-11-09')).urgent, true)
    assert.equal(birthdayCardState(dob, live, at('2026-11-08')).urgent, false)
  })

  it('shows 1 day left on the last day', () => {
    assert.equal(birthdayCardState(dob, perk('2026-11-16T15:00:00Z'), at('2026-11-16')).daysLeft, 1)
  })

  it('hides once claimed or expired, or with no perk', () => {
    assert.equal(birthdayCardState(dob, perk('2026-11-16T04:00:00Z', 'claimed'), at('2026-10-20')).mode, 'none')
    assert.equal(birthdayCardState(dob, live, at('2026-11-17')).mode, 'none')
    assert.equal(birthdayCardState(dob, null, at('2026-10-17')).mode, 'none')
  })

  it('treats a missing DOB with a live perk as the countdown, never the hero', () => {
    assert.equal(birthdayCardState(null, live, at('2026-10-17')).mode, 'countdown')
  })

  it('greets a Feb 29 birthday on Feb 28 of a non-leap year', () => {
    assert.equal(birthdayCardState('2000-02-29', perk('2027-03-30T04:00:00Z'), at('2027-02-28')).mode, 'day')
    assert.equal(birthdayCardState('2000-02-29', perk('2028-03-30T04:00:00Z'), at('2028-02-28')).mode, 'countdown')
  })
})

describe('birthday wording + helpers', () => {
  it('words the gift once', () => {
    assert.equal(BIRTHDAY_GIFT_LABEL, 'free carwash')
    assert.equal(BIRTHDAY_GIFT_TITLE.toLowerCase(), BIRTHDAY_GIFT_LABEL)
  })

  it('keys the greeting per customer and year', () => {
    assert.equal(birthdayGreetedKey('abc', 2026), 'hakum-bday-greeted-abc-2026')
    assert.notEqual(birthdayGreetedKey('abc', 2026), birthdayGreetedKey('abc', 2027))
  })

  it('formats the expiry in Manila time', () => {
    assert.equal(formatPerkDate('2026-11-15T17:00:00Z'), 'Nov 16')
    assert.equal(formatPerkDate(''), '')
  })
})
