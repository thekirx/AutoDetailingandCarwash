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
  canModifyBookingServicePrice,
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
  STATUS_LABELS,
} from '../src/queue/queueLogic.js'
import { DETAILING_BOARD_STATUSES } from '../src/lib/detailingBoardStatuses.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { creatableRolesFor } from '../server/provisionStaff.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('sales role — detailing bookings board', () => {
  it('lands on bookings with bookings + history dock/nav', () => {
    assert.equal(isSalesRole(sales), true)
    assert.equal(isFormBookingsOnlyRole(sales), true)
    assert.equal(redirectForRole(ROLES.SALES), '/operations/bookings')
    assert.deepEqual(
      getOperationsNav(sales).map((i) => i.to),
      ['/operations/bookings', '/operations/history'],
    )
    assert.deepEqual(
      getSalesDock(sales).map((i) => i.to),
      ['/operations/bookings', '/operations/history'],
    )
    assert.equal(canAccessBookingBoard(sales), true)
    assert.equal(canEditBookings(sales), true)
    assert.equal(canCreateBookings(sales), true)
    assert.equal(canModifyBookingServicePrice(sales), true)
    assert.equal(canModifyBookingServicePrice({ role: ROLES.TEAM_LEAD }), false)
    assert.equal(canModifyBookingServicePrice({ role: ROLES.ADMIN }), false)
    assert.equal(canAccessPos(sales), false)
    assert.equal(canCheckInFormBooking(sales), true)
    assert.equal(canCheckInFormBooking({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canCheckInFormBooking({ role: ROLES.MARKETING }), false)
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

  it('board shows 6 detailing statuses + cancelled; Sales advances full pipeline', () => {
    assert.deepEqual(getBookingBoardStatuses(sales), [
      ...DETAILING_BOARD_STATUSES.map((s) => s.id),
      'cancelled',
    ])
    assert.equal(STATUS_LABELS.waiting, 'In Take Started')
    assert.equal(getBookingPrimaryNextStatus('pending', { canCheckIn: true, detailingPipeline: true }), 'confirmed')
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: true, detailingPipeline: true }), 'waiting')
    assert.equal(getBookingPrimaryNextStatus('waiting', { detailingPipeline: true }), 'in_progress')
    assert.equal(getBookingPrimaryNextStatus('in_progress', { detailingPipeline: true }), 'final_checking')
    assert.equal(getBookingPrimaryNextStatus('final_checking', { detailingPipeline: true }), 'completed')
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: false, detailingPipeline: true }), null)
  })

  it('requires branch assignment like Team Lead', () => {
    assert.equal(requiresTeamLeadBranchSetup({ role: ROLES.SALES }), true)
    assert.equal(requiresTeamLeadBranchSetup(sales), false)
  })

  it('booking-status API allows detailing board moves on any branch (Sales is all-branches)', () => {
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'confirmed' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'waiting' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'completed' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor' }, { nextStatus: 'for_payment' }),
      false,
    )
    // Sales is assigned to all branches — can advance a booking on any branch.
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'batangas' }, { nextStatus: 'confirmed' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'marketing', branch_slug: 'bacoor' },
        { branch: 'bacoor' },
        { nextStatus: 'confirmed' },
      ),
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
    assert.match(board, /DETAILING_BOARD_STATUSES|Booking Placeholder/)
    const layout = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
    assert.match(layout, /SalesFloorShell/)
    assert.match(layout, /getSalesDock/)
  })
})
