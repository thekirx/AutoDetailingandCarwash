/**
 * Booking board /api/booking-status → POS handoff.
 * Bare status='for_payment' must create pos_handoffs via RPC (user JWT).
 */

export function isPaymentHandoffStatus(status) {
  return String(status || '') === 'for_payment'
}

/** Statuses that may enter the payment RPC (matches send_queue_ticket_to_payment). */
export function canEnterPaymentHandoff(currentStatus) {
  return ['final_checking', 'for_payment', 'completed', 'in_progress'].includes(String(currentStatus || ''))
}
