import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canAccessBookingBoard,
  canAccessCrm,
  canAccessMarketing,
  canAccessPos,
  canAddQueueService,
  canEditCrm,
  canEditQueueOperations,
  canEditQueueTicket,
  canSeeAllBranches,
  canViewQueueBoard,
  canViewQueueOperations,
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
  it('lands on bookings; nav/dock add Queue + CRM views', () => {
    assert.equal(isSalesRole(sales), true)
    assert.equal(isFormBookingsOnlyRole(sales), true)
    assert.equal(redirectForRole(ROLES.SALES), '/operations/bookings')
    const expected = ['/operations/bookings', '/operations/queue', '/operations/crm', '/operations/history']
    assert.deepEqual(getOperationsNav(sales).map((i) => i.to), expected)
    assert.deepEqual(getSalesDock(sales).map((i) => i.to), expected)
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

  it('allowRoute matrix: bookings, queue view, crm view; everything else no', () => {
    const allowed = ['bookings', 'queue', 'crm', 'history']
    const denied = [
      'console',
      'planning',
      'people',
      'branches',
      'cars',
      'audit',
      'data-center',
      'dashboard',
      'queue-new',
      'crew',
      'kpi',
      'my-tasks',
      'pos',
      'finance',
      'reports',
      'memberships',
    ]
    for (const key of allowed) assert.equal(allowRoute(sales, key), true, key)
    for (const key of denied) assert.equal(allowRoute(sales, key), false, key)
  })

  it('Queue: all branches, wash view only, detailing tickets editable; CRM view only', () => {
    const wash = { booking_id: 'w', service_pay_category: 'wash' }
    const pkg = { booking_id: 'p', service_pay_category: 'package' }
    const detailing = { booking_id: 'd', service_pay_category: 'detailing' }
    assert.equal(canViewQueueBoard(sales), true)
    assert.equal(canSeeAllBranches(sales), true)
    assert.equal(canEditQueueOperations(sales), false, 'no wash status / assign / new ticket')
    assert.equal(canAddQueueService(sales), false)
    assert.equal(canViewQueueOperations(sales), false, 'no Floor Board / KPI via Queue')
    assert.equal(canEditQueueTicket(sales, wash), false)
    assert.equal(canEditQueueTicket(sales, pkg), false)
    assert.equal(canEditQueueTicket(sales, detailing), true)
    assert.equal(canEditQueueTicket({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }, wash), true)
    assert.equal(canEditQueueTicket({ role: ROLES.MARKETING }, detailing), false)
    assert.equal(canAccessCrm(sales), true)
    assert.equal(canEditCrm(sales), false)
    assert.equal(canAccessMarketing(sales), false, 'SMS send / templates stay off')
    assert.equal(canEditCrm({ role: ROLES.MARKETING }), true)
  })

  it('board shows detailing statuses + cancelled; Sales advances full pipeline', () => {
    assert.deepEqual(getBookingBoardStatuses(sales), [
      ...DETAILING_BOARD_STATUSES.map((s) => s.id),
      'cancelled',
    ])
    assert.equal(STATUS_LABELS.waiting, 'Waiting')
    assert.equal(getBookingPrimaryNextStatus('pending', { canCheckIn: true, detailingPipeline: true }), 'confirmed')
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: true, detailingPipeline: true }), 'waiting')
    assert.equal(getBookingPrimaryNextStatus('waiting', { detailingPipeline: true }), 'in_progress')
    assert.equal(getBookingPrimaryNextStatus('in_progress', { detailingPipeline: true }), 'final_checking')
    assert.equal(getBookingPrimaryNextStatus('final_checking', { detailingPipeline: true }), 'for_payment')
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canCheckIn: false, detailingPipeline: true }), null)
  })

  it('requires branch assignment like Team Lead', () => {
    assert.equal(requiresTeamLeadBranchSetup({ role: ROLES.SALES }), true)
    assert.equal(requiresTeamLeadBranchSetup(sales), false)
  })

  it('booking-status API allows detailing board moves on any branch (Sales is all-branches)', () => {
    const detailing = { pay_category: 'detailing', slug: 'ceramic-coating' }
    const at = (branch) => ({ branch, services: detailing })
    assert.equal(canStaffUpdateBookingStatus(sales, at('bacoor'), { nextStatus: 'confirmed' }), true)
    assert.equal(canStaffUpdateBookingStatus(sales, at('bacoor'), { nextStatus: 'waiting' }), true)
    assert.equal(canStaffUpdateBookingStatus(sales, at('bacoor'), { nextStatus: 'completed' }), true)
    assert.equal(canStaffUpdateBookingStatus(sales, at('bacoor'), { nextStatus: 'for_payment' }), false)
    // Sales is assigned to all branches — can advance a booking on any branch.
    assert.equal(canStaffUpdateBookingStatus(sales, at('batangas'), { nextStatus: 'confirmed' }), true)
    // Wash queue tickets are view only for Sales.
    assert.equal(
      canStaffUpdateBookingStatus(sales, { branch: 'bacoor', services: { pay_category: 'wash', slug: 'basic-wash' } }, { nextStatus: 'in_progress' }),
      false,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'marketing', branch_slug: 'bacoor' },
        at('bacoor'),
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
