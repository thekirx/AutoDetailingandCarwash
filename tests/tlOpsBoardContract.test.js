import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANCEL_REASON_PRESETS,
  FORM_BOOKING_STATUSES,
  QUEUE_DATE_PRESETS,
  canCancelQueueStatus,
  canTransitionQueueStatus,
  getBookingBoardStatuses,
  getBookingPrimaryNextStatus,
  getQueueTicketActionFlags,
  isFormBookingStatus,
  matchesDurationFilter,
  matchesTicketSearch,
  ticketElapsedMinutes,
  validateCancellationReason,
} from '../src/queue/queueLogic.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { finalCheckActionLabel } from '../src/lib/uiDeadControls.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const permissions = readFileSync(join(root, 'src/auth/permissions.js'), 'utf8')
const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
const bookingBoard = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
const tlQueue = readFileSync(join(root, 'src/pages/TeamLeadQueuePage.jsx'), 'utf8')

describe('TL ops contract — cancel, payment gate, form bookings', () => {
  it('allows cancel from open floor + form statuses with reason presets', () => {
    for (const status of ['waiting', 'in_progress', 'final_checking', 'pending', 'confirmed']) {
      assert.equal(canCancelQueueStatus(status), true)
      assert.equal(canTransitionQueueStatus(status, 'cancelled'), true)
    }
    assert.equal(canCancelQueueStatus('for_payment'), false)
    assert.equal(canCancelQueueStatus('completed'), false)
    assert.ok(CANCEL_REASON_PRESETS.length >= 3)
    assert.equal(validateCancellationReason('ab').ok, false)
    assert.equal(validateCancellationReason('Customer cannot wait any longer').ok, true)
  })

  it('TL action flags: cancel yes, send-to-payment never; final check stays on floor', () => {
    const waiting = getQueueTicketActionFlags('waiting', { canManageQueue: true })
    assert.equal(waiting.canStart, true)
    assert.equal(waiting.canCancel, true)
    assert.equal(waiting.canSendToPayment, false)

    const checking = getQueueTicketActionFlags('final_checking', {
      canManageQueue: true,
      canSeePayment: false,
    })
    assert.equal(checking.canSendToPayment, false)
    assert.equal(checking.canCancel, true)

    const adminPay = getQueueTicketActionFlags('final_checking', {
      canManageQueue: true,
      canSeePayment: true,
    })
    assert.equal(adminPay.canSendToPayment, true)

    assert.equal(finalCheckActionLabel(false), 'Final check')
  })

  it('updateTicketStatus writes final_checking and cancels with reason (no TL auto-payment)', () => {
    assert.match(api, /final_checking_at/)
    assert.match(api, /cancelQueueTicket|cancellation_reason/)
    assert.doesNotMatch(
      api,
      /if \(nextStatus === 'final_checking'\) \{\s*await sendTicketToPayment/,
    )
  })

  it('TL booking board is form-only; waiting means on-site queue', () => {
    assert.deepEqual(FORM_BOOKING_STATUSES, ['pending', 'confirmed'])
    assert.equal(isFormBookingStatus('pending'), true)
    assert.equal(isFormBookingStatus('waiting'), false)
    assert.deepEqual(getBookingBoardStatuses({ role: 'team_lead' }), ['pending', 'confirmed'])
    assert.ok(getBookingBoardStatuses({ role: 'admin' }).includes('waiting'))
    assert.equal(getBookingPrimaryNextStatus('confirmed', { canSeePayment: false }), 'waiting')
    assert.equal(getBookingPrimaryNextStatus('final_checking', { canSeePayment: false }), null)
    assert.match(bookingBoard, /getBookingBoardStatuses|FORM_BOOKING_STATUSES|isTeamLead/)
    assert.doesNotMatch(bookingBoard, /archiveBooking\(b\)[\s\S]{0,80}team_lead/)
  })

  it('blocks TL from for_payment via booking-status API', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'team_lead', branch_slug: 'bacoor' },
        { branch: 'bacoor', status: 'final_checking' },
        { nextStatus: 'for_payment' },
      ),
      false,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'team_lead', branch_slug: 'bacoor' },
        { branch: 'bacoor', status: 'confirmed' },
        { nextStatus: 'waiting' },
      ),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'admin', branch_slugs: ['bacoor'] },
        { branch: 'bacoor', status: 'final_checking' },
        { nextStatus: 'for_payment' },
      ),
      true,
    )
  })

  it('queue date presets default daily only for queue surfaces; search + duration are data-proof', () => {
    assert.ok(QUEUE_DATE_PRESETS.some((p) => p.key === 'today' && p.dailyDefault))
    assert.ok(QUEUE_DATE_PRESETS.some((p) => p.key === 'all'))
    assert.ok(QUEUE_DATE_PRESETS.some((p) => p.key === 'custom'))
    assert.equal(
      matchesTicketSearch(
        { vehicle_plate: 'ABC-123', customer_name: 'Ana', service_name: 'Detailing' },
        'detail',
      ),
      true,
    )
    assert.equal(matchesDurationFilter(45, '30_60'), true)
    assert.equal(matchesDurationFilter(45, 'under_30'), false)
    assert.equal(ticketElapsedMinutes({ created_at: '2026-08-08T00:00:00Z' }, Date.parse('2026-08-08T01:00:00Z')), 60)
    assert.match(tlQueue, /QUEUE_DATE_PRESETS|matchesDurationFilter|matchesTicketSearch/)
  })

  it('renames Floor dock to Queue View for TL', () => {
    assert.match(permissions, /label: 'Queue View'/)
    assert.match(permissions, /to: '\/operations\/dashboard'/)
  })
})
