import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canAccessBookingBoard,
  canAccessPos,
  canCheckInFormBooking,
  canCreateBookings,
  canEditBookings,
  getOperationsNav,
  getSalesDock,
  isFormBookingsOnlyRole,
  isSalesRole,
  redirectForRole,
} from '../src/auth/permissions.js'
import {
  getBookingBoardStatuses,
  getBookingPrimaryNextStatus,
  requiresTeamLeadBranchSetup,
} from '../src/queue/queueLogic.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { creatableRolesFor } from '../server/provisionStaff.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('sales role — form bookings only', () => {
  it('lands on bookings with a bookings-only dock/nav', () => {
    assert.equal(isSalesRole(sales), true)
    assert.equal(isFormBookingsOnlyRole(sales), true)
    assert.equal(redirectForRole(ROLES.SALES), '/operations/bookings')
    assert.deepEqual(
      getOperationsNav(sales).map((i) => i.to),
      ['/operations/bookings'],
    )
    assert.deepEqual(
      getSalesDock(sales).map((i) => i.to),
      ['/operations/bookings'],
    )
    assert.equal(canAccessBookingBoard(sales), true)
    assert.equal(canEditBookings(sales), true)
    assert.equal(canCreateBookings(sales), true)
    assert.equal(canAccessPos(sales), false)
    assert.equal(canCheckInFormBooking(sales), false)
    assert.equal(canCheckInFormBooking({ role: ROLES.TEAM_LEAD }), true)
  })

  it('allowRoute matrix: bookings yes, everything else no', () => {
    const allowed = ['bookings']
    const denied = [
      'console',
      'planning',
      'people',
      'branches',
      'cars',
      'audit',
      'data-center',
      'dashboard',
      'queue',
      'queue-new',
      'crew',
      'kpi',
      'my-tasks',
      'pos',
      'finance',
      'crm',
      'reports',
      'memberships',
    ]
    for (const key of allowed) assert.equal(allowRoute(sales, key), true, key)
    for (const key of denied) assert.equal(allowRoute(sales, key), false, key)
  })

  it('board is form-only; confirm yes, waiting no', () => {
    assert.deepEqual(getBookingBoardStatuses(sales), ['pending', 'confirmed'])
    assert.equal(getBookingPrimaryNextStatus('pending', { canCheckIn: false }), 'confirmed')
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: false }), null)
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: true }), 'waiting')
  })

  it('requires branch assignment like Team Lead', () => {
    assert.equal(requiresTeamLeadBranchSetup({ role: ROLES.SALES }), true)
    assert.equal(requiresTeamLeadBranchSetup(sales), false)
  })

  it('booking-status API allows CRM-safe moves only on assigned branch', () => {
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'confirmed' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'cancelled' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'waiting' }),
      false,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'batangas' }, { nextStatus: 'confirmed' }),
      false,
    )
  })

  it('demo chip + Super Admin can provision sales; bookings form requires service', () => {
    const chip = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'sales')
    assert.ok(chip)
    assert.equal(chip.email, 'sales@hakumautocare.com')
    assert.ok(chip.password.length >= 8)
    assert.ok(creatableRolesFor('BossMich').includes('sales'))
    assert.ok(!creatableRolesFor('admin').includes('sales'))
    const board = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    assert.match(board, /fetchServices/)
    assert.match(board, /service_id/)
    assert.match(board, /formBookingsOnly/)
    const layout = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
    assert.match(layout, /SalesFloorShell/)
    assert.match(layout, /getSalesDock/)
  })
})
