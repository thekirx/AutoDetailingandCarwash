/**
 * Team Lead walk-in tickets: name is optional; plate + phone are required.
 * bookings.customer_name / customers.full_name stay NOT NULL — we store a
 * stable walk-in label that can be replaced later when CRM collects a real name.
 */

export function normalizeQueuePlate(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function isWalkInCustomerName(name) {
  const n = String(name || '').trim()
  if (!n) return true
  return /^walk-in(\b|\s*·|\s*-)/i.test(n)
}

/**
 * Prefer typed name; else plate; else last-4 phone digits.
 * Never returns empty (DB NOT NULL).
 */
export function resolveQueueCustomerDisplayName({
  customer_name,
  customer_first_name,
  customer_last_name,
  vehicle_plate,
  customer_phone,
} = {}) {
  const named = String(
    customer_name || `${customer_first_name || ''} ${customer_last_name || ''}`,
  ).trim()
  if (named) return named

  const plate = normalizeQueuePlate(vehicle_plate)
  if (plate) return `Walk-in · ${plate}`

  const digits = String(customer_phone || '').replace(/\D/g, '')
  if (digits.length >= 4) return `Walk-in · ${digits.slice(-4)}`
  if (digits) return `Walk-in · ${digits}`

  return 'Walk-in'
}

/** Don't clobber a real CRM name with a walk-in placeholder on re-visit. */
export function mergeCustomerDisplayName(incoming, existing) {
  const next = String(incoming || '').trim()
  const prev = String(existing || '').trim()
  if (!next) return prev || 'Walk-in'
  if (!prev) return next
  if (isWalkInCustomerName(next) && !isWalkInCustomerName(prev)) return prev
  return next
}

export function validateQueueTicketIdentity({
  customer_phone,
  vehicle_plate,
  service_ids,
  service_id,
} = {}) {
  const phoneDigits = String(customer_phone || '').replace(/\D/g, '')
  if (phoneDigits.length < 10) return 'Phone number is required (at least 10 digits).'
  if (!normalizeQueuePlate(vehicle_plate)) return 'Plate number is required.'
  const ids = Array.isArray(service_ids) && service_ids.length
    ? service_ids.filter(Boolean)
    : service_id
      ? [service_id]
      : []
  if (!ids.length) return 'Select at least one service, package, or detailing service.'
  return null
}
