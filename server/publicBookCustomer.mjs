/**
 * Public book customer_id resolution (CUST-C2 / CUST-H7).
 * Guest phone is never proof of ownership — link only when JWT maps to customers.role=customer.
 */
export function resolveBookingCustomerId({ authUid, customerRole }) {
  if (!authUid) return null
  if (customerRole !== 'customer') return null
  return authUid
}
