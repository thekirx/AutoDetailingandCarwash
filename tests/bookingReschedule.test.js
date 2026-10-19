import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RESCHEDULE_ACK,
  canCustomerRequestReschedule,
  renderRescheduleAckSms,
  rescheduleRequestDecision,
} from '../src/lib/bookingReschedule.js'
import { NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'
import { buildOpsEventCopy } from '../server/notifyOpsEvent.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const detailing = { status: 'confirmed', kind: 'detailing', customer_name: 'Ana Cruz', vehicle_plate: 'ABC 123' }

describe('customer reschedule request', () => {
  it('lets a detailing customer ask before the job starts', () => {
    for (const status of ['pending', 'confirmed', 'waiting']) {
      assert.equal(canCustomerRequestReschedule({ ...detailing, status }), true)
    }
  })

  it('stops once work is in progress or the request is already in', () => {
    for (const status of ['in_progress', 'final_checking', 'for_payment', 'completed', 'cancelled']) {
      assert.equal(canCustomerRequestReschedule({ ...detailing, status }), false)
      const decision = rescheduleRequestDecision({ ...detailing, status })
      assert.equal(decision.ok, false)
      assert.equal(decision.status, 409)
    }
    assert.equal(canCustomerRequestReschedule({ ...detailing, reschedule_requested_at: '2026-10-17T00:00:00Z' }), false)
    assert.equal(rescheduleRequestDecision({ ...detailing, reschedule_requested_at: '2026-10-17T00:00:00Z' }).already, true)
  })

  it('does not offer a date, and the text says a representative will call', () => {
    const sms = renderRescheduleAckSms(detailing)
    assert.match(sms, /Hi Ana!/)
    assert.match(sms, new RegExp(RESCHEDULE_ACK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(sms, /\d{4}|Monday|January|tentatively/i)
    const visit = read('src/pages/CustomerVisitPage.jsx')
    assert.match(visit, /Schedule for reschedule/)
    assert.doesNotMatch(visit, /type="date"|datetime-local/)
  })

  it('is one portal action, and the branch hears it on the bookings board', () => {
    const portal = read('server/customerPortal.mjs')
    assert.match(portal, /action === 'request-reschedule'/)
    assert.match(portal, /reschedule_requested_at/)
    assert.ok(NOTIFY_EVENTS.booking_reschedule.roles.includes('sales'))
    assert.ok(NOTIFY_EVENTS.booking_reschedule.roles.includes('admin'))
    assert.ok(NOTIFY_EVENTS.booking_reschedule.roles.includes('team_lead'))
    const copy = buildOpsEventCopy('booking_reschedule', { name: 'Ana Cruz', plate: 'ABC 123', bookingId: 'b1' })
    assert.match(copy.body, /Call them/)
    const board = read('src/pages/BookingBoardPage.jsx')
    assert.match(board, /reschedule_requested_at = null/)
    assert.match(board, /Call to reschedule/)
  })
})
