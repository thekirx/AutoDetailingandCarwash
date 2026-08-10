/** CRM follow-up statuses Marketing may set — never floor/payment/redo. */
export const CRM_SAFE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'cancelled'])

/** Sales Bookings board pipeline (6 detailing statuses + cancel). */
export const SALES_BOARD_BOOKING_STATUSES = new Set([
  'pending',
  'confirmed',
  'waiting',
  'in_progress',
  'final_checking',
  'completed',
  'cancelled',
])

export function isCrmSafeBookingStatus(status) {
  return CRM_SAFE_BOOKING_STATUSES.has(String(status || '').trim())
}

export function isSalesBoardBookingStatus(status) {
  return SALES_BOARD_BOOKING_STATUSES.has(String(status || '').trim())
}
