import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bookingLaneDomId,
  scrollBookingLaneIntoView,
} from '../src/lib/detailingBoardStatuses.js'
import {
  crewRequiredForPayCategory,
  getBookingPrimaryNextStatus,
  isAssignableAttendanceStatus,
} from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('crew assign + booking board mobile', () => {
  it('requires crew except packages; present/late are assignable', () => {
    assert.equal(crewRequiredForPayCategory('wash'), true)
    assert.equal(crewRequiredForPayCategory('detailing'), true)
    assert.equal(crewRequiredForPayCategory('package'), false)
    assert.equal(crewRequiredForPayCategory('ppf'), false)
    assert.equal(isAssignableAttendanceStatus('present'), true)
    assert.equal(isAssignableAttendanceStatus('late'), true)
    assert.equal(isAssignableAttendanceStatus('absent'), false)
  })

  it('maps one primary next status for mobile cards', () => {
    assert.equal(getBookingPrimaryNextStatus('pending'), 'confirmed')
    assert.equal(getBookingPrimaryNextStatus('waiting'), 'in_progress')
    assert.equal(getBookingPrimaryNextStatus('in_progress'), 'final_checking')
    assert.equal(getBookingPrimaryNextStatus('final_checking', { canSeePayment: false }), null)
    assert.equal(getBookingPrimaryNextStatus('final_checking', { canSeePayment: true }), 'for_payment')
    assert.equal(getBookingPrimaryNextStatus('final_checking', { detailingPipeline: true }), 'for_releasing')
    assert.equal(getBookingPrimaryNextStatus('for_releasing', { detailingPipeline: true }), 'for_payment')
  })

  it('TL shell uses Hakum mark; bookings page is mobile-first with crew gate', () => {
    const layout = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
    const migration = readFileSync(
      join(root, 'supabase/migrations/20260808160000_geofence_radius_20m.sql'),
      'utf8',
    )
    assert.match(layout, /hakum-mark-ow\.png/)
    assert.match(page, /hakum-mark-blue\.png/)
    assert.match(page, /bk-status-strip/)
    assert.match(page, /className="bk-board"/)
    assert.match(page, /bookingLaneDomId/)
    assert.match(page, /scrollBookingLaneIntoView/)
    assert.doesNotMatch(page, /bk-card-list xl:hidden/)
    assert.doesNotMatch(page, /booking-lane-board hidden xl:grid/)
    assert.doesNotMatch(page, /min-h-9 w-full/)
    assert.doesNotMatch(page, /min-h-8 w-full/)
    assert.match(page, /createCoalescedReload/)
    assert.match(page, /from '@\/lib\/coalesceReload'/)
    assert.match(page, /isOpenBookingStatus/)
    assert.match(page, /fetchPresentAssignableStaff/)
    assert.match(page, /Assign present crew/)
    assert.match(css, /\.bk-card\s*\{/)
    assert.match(css, /\.bk-board\s*\{[^}]*container-name:\s*bk-board/s)
    assert.match(css, /@container bk-board/)
    assert.match(css, /\.booking-lane-board\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    assert.match(css, /@container bk-board \(min-width: 44rem\)[\s\S]*?grid-auto-columns:\s*minmax\(16\.5rem/)
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.booking-lane-board/)
    assert.doesNotMatch(css, /\.booking-lane-board\s*\{[^}]*overflow-x:\s*hidden/s)
    assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(var\(--bk-cols/)
    assert.match(api, /Assign at least one present crew member before starting/)
    assert.match(api, /\.in\('status', \['present', 'late'\]\)/)
    assert.match(migration, /between 20 and 5000/)
    assert.match(migration, /set default 20/)
  })

  it('lane ids are stable so chips can jump a stage', () => {
    assert.equal(bookingLaneDomId('waiting'), 'bk-lane-waiting')
    assert.equal(bookingLaneDomId(''), '')
    const hidden = { scrollIntoView() {}, getClientRects: () => [] }
    assert.equal(scrollBookingLaneIntoView('waiting', { getElementById: () => hidden }), false)
    let opts = null
    const visible = {
      scrollIntoView(next) {
        opts = next
      },
      getClientRects: () => [{ width: 264 }],
    }
    assert.equal(
      scrollBookingLaneIntoView('waiting', { getElementById: (id) => (id === 'bk-lane-waiting' ? visible : null) }, { reduceMotion: true }),
      true,
    )
    assert.equal(opts.behavior, 'auto')
    assert.equal(opts.inline, 'start')
  })
})
