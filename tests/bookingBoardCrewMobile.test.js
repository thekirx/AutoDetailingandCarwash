import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
    assert.match(page, /bk-card-list xl:hidden/)
    assert.match(page, /booking-lane-board hidden xl:grid/)
    assert.match(page, /isOpenBookingStatus/)
    assert.match(page, /fetchPresentAssignableStaff/)
    assert.match(page, /Assign present crew/)
    assert.match(css, /\.bk-card\s*\{/)
    assert.match(api, /Assign at least one present crew member before starting/)
    assert.match(api, /\.in\('status', \['present', 'late'\]\)/)
    assert.match(migration, /between 20 and 5000/)
    assert.match(migration, /set default 20/)
  })
})
