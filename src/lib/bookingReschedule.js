/**
 * Customer reschedule request.
 * Open only before the job starts (pending, confirmed, vehicle intake).
 * The customer does not pick a new date — the branch calls, then sets the final schedule.
 */
import { isBookingBoardRow } from './serviceKinds.js'
import { smsCustomerName } from './queueStatusSms.js'

export const RESCHEDULE_OPEN_STATUSES = Object.freeze(['pending', 'confirmed', 'waiting'])

export const RESCHEDULE_ACK =
  'One of our customer representatives will contact you as soon as possible.'

export function isDetailingRescheduleBooking(booking = {}) {
  if (booking.kind === 'detailing') return true
  return isBookingBoardRow(booking)
}

/** True when this customer may ask once, and the visit has not started. */
export function canCustomerRequestReschedule(booking = {}) {
  if (!booking || booking.reschedule_requested_at) return false
  if (!RESCHEDULE_OPEN_STATUSES.includes(String(booking.status || ''))) return false
  return isDetailingRescheduleBooking(booking)
}

/**
 * @returns {{ ok: true, already?: boolean } | { ok: false, status: number, error: string }}
 */
export function rescheduleRequestDecision(booking) {
  if (!booking) return { ok: false, status: 404, error: 'Booking not found.' }
  if (booking.reschedule_requested_at && RESCHEDULE_OPEN_STATUSES.includes(String(booking.status || ''))) {
    return { ok: true, already: true }
  }
  if (!canCustomerRequestReschedule(booking)) {
    return {
      ok: false,
      status: 409,
      error: 'This visit can no longer be rescheduled. Call the branch.',
    }
  }
  return { ok: true }
}

/** SMS / inbox / push body. No date — the new day is set only after the call. */
export function renderRescheduleAckSms(booking = {}) {
  const first = smsCustomerName(booking) || 'there'
  return `Hi ${first}! We received your request to reschedule. ${RESCHEDULE_ACK} Salamat po!`
}
