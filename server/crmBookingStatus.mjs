/** CRM follow-up statuses Marketing may set — never floor/payment/redo. */
export const CRM_SAFE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'cancelled'])

export function isCrmSafeBookingStatus(status) {
  return CRM_SAFE_BOOKING_STATUSES.has(String(status || '').trim())
}
