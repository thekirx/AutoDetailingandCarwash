/**
 * Every push/inbox deep link must open for the person who receives it.
 * Source of truth for "can open": allowRoute (same gate App.jsx uses).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { ROLES, allowRoute } from '../src/auth/permissions.js'
import { NOTIFY_EVENTS, bookingOpsEvent, pickNotifyUrl } from '../src/lib/notifyRouting.js'
import { buildBookingNotifyPayload, buildOpsNotifyCopy } from '../server/notifyBooking.mjs'

/** ASA with every grant the notify rules ask for (resolver drops ASA without the grant). */
const profileOf = (role) => ({
  id: `u-${role}`,
  role,
  branch_slug: 'bacoor',
  permission_grants: role === ROLES.ASSISTANT_SUPER_ADMIN ? { finance_write: true } : {},
})

const CUSTOMER_ROUTES = ['/account', '/account/queue', '/account/book', '/account/loyalty', '/account/more']
const customerRouteOk = (url) => CUSTOMER_ROUTES.includes(new URL(url, 'https://x').pathname)

describe('notify routing table', () => {
  for (const [event, rule] of Object.entries(NOTIFY_EVENTS)) {
    for (const role of rule.roles) {
      it(`${event} → ${role} gets a link they can open`, () => {
        const url = pickNotifyUrl(profileOf(role), rule.urls)
        assert.ok(url, `${role} has no allowed url in ${rule.urls.join(', ')}`)
        assert.equal(allowRoute(profileOf(role), opsRouteKeyFromPath(url.split('?')[0])), true)
      })
    }
  }

  it('crew are not on booking fan-out (they get crew_assigned instead)', () => {
    for (const status of ['pending', 'confirmed', 'waiting', 'in_progress', 'for_payment', 'completed', 'cancelled']) {
      assert.equal(NOTIFY_EVENTS[bookingOpsEvent(status)].roles.includes(ROLES.STAFF), false, status)
    }
    assert.equal(pickNotifyUrl(profileOf(ROLES.STAFF), NOTIFY_EVENTS.crew_assigned.urls), '/operations/my-tasks')
    assert.equal(pickNotifyUrl(profileOf(ROLES.DETAILER), NOTIFY_EVENTS.crew_assigned.urls), '/operations/my-tasks')
  })

  it('Ops Lead gets booking alerts and lands on the queue (Bookings board is not theirs)', () => {
    const rule = NOTIFY_EVENTS[bookingOpsEvent('pending')]
    assert.ok(rule.roles.includes(ROLES.OPERATIONS_LEAD))
    assert.equal(pickNotifyUrl(profileOf(ROLES.OPERATIONS_LEAD), rule.urls), '/operations/queue')
  })

  it('Team Lead ready-for-payment lands on the queue (POS is denied for TL)', () => {
    assert.equal(pickNotifyUrl(profileOf(ROLES.TEAM_LEAD), NOTIFY_EVENTS[bookingOpsEvent('for_payment')].urls), '/operations/queue')
  })

  it('marketing planner assignee lands on planning (My Tasks is not theirs)', () => {
    assert.equal(pickNotifyUrl(profileOf(ROLES.MARKETING), NOTIFY_EVENTS.planner_task.urls), '/operations/planning')
  })

  it('daily sheet approvals are gated on finance_view and land on Finance sheets', () => {
    assert.equal(NOTIFY_EVENTS.sheet_submitted.grant, 'finance_view')
    assert.deepEqual(NOTIFY_EVENTS.sheet_submitted.urls, ['/operations/finance?tab=sheets'])
    for (const e of ['shift_submitted', 'shift_accepted', 'shift_rejected', 'floor_pay_ready']) assert.equal(NOTIFY_EVENTS[e], undefined, e)
  })

  it('Branch Admin cash advance alert opens the POS Daily sheet', () => {
    assert.equal(pickNotifyUrl(profileOf(ROLES.ADMIN), NOTIFY_EVENTS.cash_advance_submitted.urls), '/operations/pos?tab=sheet')
  })
})

describe('copy builders use the routing table', () => {
  const booking = { id: 'b1', branch: 'bacoor', vehicle_plate: 'ABC123', customer_id: 'c1', service_name: 'Wash' }

  it('ops booking copy carries the event url list', () => {
    for (const status of ['pending', 'waiting', 'for_payment', 'completed', 'cancelled', 'redo', 'photos_ready']) {
      assert.deepEqual(buildOpsNotifyCopy(booking, status).urls, NOTIFY_EVENTS[bookingOpsEvent(status)].urls, status)
    }
  })

  it('customer booking copy opens a customer route', () => {
    for (const status of ['pending', 'confirmed', 'waiting', 'in_progress', 'for_payment', 'completed', 'cancelled', 'redo', 'photos_ready']) {
      assert.ok(customerRouteOk(buildBookingNotifyPayload(booking, status).url), status)
    }
  })

})
