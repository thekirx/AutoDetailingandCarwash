/**
 * Bookings calendar must own date + view: react-big-calendar's uncontrolled wrapper (uncontrollable v7)
 * sets `unmounted` on StrictMode's simulated unmount and then ignores every Back / Next / Month click.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const src = readFileSync(new URL('../src/pages/BookingBoardPage.jsx', import.meta.url), 'utf8')
const calendar = src.slice(src.indexOf('<BigCalendar'), src.indexOf('/>', src.indexOf('<BigCalendar')))

describe('Bookings calendar', () => {
  it('is controlled (date / view + their handlers), not defaultView', () => {
    for (const prop of ['date={calDate}', 'onNavigate={setCalDate}', 'view={calView}', 'onView={setCalView}']) {
      assert.ok(calendar.includes(prop), prop)
    }
    assert.doesNotMatch(calendar, /defaultView|defaultDate/)
  })
})
