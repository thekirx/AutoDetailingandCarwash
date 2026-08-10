import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessCrm,
  canAccessConsole,
  canAccessFinance,
  canAccessPos,
  canAccessBookingBoard,
  canEditQueueOperations,
  canViewAssignedTasks,
  canViewQueueOperations,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { CRM_SAFE_BOOKING_STATUSES, isCrmSafeBookingStatus } from '../server/crmBookingStatus.mjs'

describe('Marketing capability matrix', () => {
  const p = { role: ROLES.MARKETING, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }

  it('allows CRM + readonly Bookings; denies floor queue POS finance console my-tasks', () => {
    assert.equal(canAccessCrm(p), true)
    assert.equal(allowRoute(p, 'crm'), true)
    assert.equal(redirectForRole(ROLES.MARKETING), '/operations/crm')
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/crm', '/operations/bookings', '/operations/history', '/operations/notifications'],
    )
    assert.equal(canAccessPos(p), false)
    assert.equal(canAccessFinance(p), false)
    assert.equal(canAccessConsole(p), false)
    assert.equal(canAccessBookingBoard(p), true)
    assert.equal(canViewQueueOperations(p), false)
    assert.equal(canEditQueueOperations(p), false)
    assert.equal(canViewAssignedTasks(p), false)
    assert.equal(allowRoute(p, 'queue'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'console'), false)
    assert.equal(allowRoute(p, 'bookings'), true)
    assert.equal(allowRoute(p, 'my-tasks'), false)
    assert.equal(allowRoute(p, 'people'), false)
  })
})

describe('Marketing booking-status gate (MKT-C1)', () => {
  it('denies Marketing operational floor statuses (in_progress / for_payment)', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'marketing', branch_slug: 'bacoor' },
        { branch: 'bacoor', status: 'in_progress' },
        { nextStatus: 'for_payment' },
      ),
      false,
    )
  })

  it('allows Marketing Bookings view as read-only (no status writes)', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'marketing', branch_slug: 'bacoor' },
        { branch: 'bacoor', status: 'pending' },
        { nextStatus: 'cancelled' },
      ),
      false,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'marketing', branch_slug: 'bacoor' },
        { branch: 'bacoor', status: 'pending' },
        { nextStatus: 'confirmed' },
      ),
      false,
    )
  })

  it('CRM-safe status set is narrow', () => {
    assert.ok(CRM_SAFE_BOOKING_STATUSES.has('cancelled'))
    assert.ok(CRM_SAFE_BOOKING_STATUSES.has('confirmed'))
    assert.ok(CRM_SAFE_BOOKING_STATUSES.has('pending'))
    assert.equal(isCrmSafeBookingStatus('for_payment'), false)
    assert.equal(isCrmSafeBookingStatus('in_progress'), false)
    assert.equal(isCrmSafeBookingStatus('redo'), false)
  })
})
