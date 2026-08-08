/**
 * UI control visibility — hide forever-gated / misleading CTAs (dead-controls audit).
 */

/** Queue ticket primary actions: hide when role cannot edit (don't leave forever-disabled buttons). */
export function showQueueTicketEditActions(canManageQueue) {
  return Boolean(canManageQueue)
}

/** Mark redo only for redo-lane roles (SA/ASA). */
export function showQueueRedoAction(canViewRedoLane) {
  return Boolean(canViewRedoLane)
}

/** Final-check CTA: advances to final_checking then auto-sends to payment handoff. */
export function finalCheckActionLabel(canOpenPos) {
  return canOpenPos ? 'Final check → POS' : 'Final check → payment'
}

/** Payment handoff CTA: TL hands off to branch Admin / ASA POS — not a cashier role. */
export function sendToPaymentActionLabel(canOpenPos) {
  return canOpenPos ? 'Retry send to payment' : 'Send to payment (Admin / ASA)'
}

/** Prefill /book from marketing Link state (PPF packages, service cards). */
export function applyPublicBookPrefill(form, locationState) {
  if (!locationState || typeof locationState !== 'object') return form
  const next = { ...form }
  const notesBits = []
  if (locationState.package) notesBits.push(`Package: ${locationState.package}`)
  if (locationState.coverageType) notesBits.push(locationState.coverageType)
  if (locationState.filmThickness) notesBits.push(`Film: ${locationState.filmThickness}`)
  if (locationState.service && typeof locationState.service === 'string') {
    next._prefServiceName = locationState.service
  }
  if (locationState.service_id) next.service_id = locationState.service_id
  if (locationState.packageId) next._prefPackageId = locationState.packageId
  if (notesBits.length) next._prefNotes = notesBits.join(' · ')
  return next
}

/** Match service_id from loaded catalog using prefill name (fuzzy contains). */
export function matchServiceIdByPrefillName(services, prefName) {
  const needle = String(prefName || '')
    .trim()
    .toLowerCase()
  if (!needle || !Array.isArray(services)) return ''
  const exact = services.find((s) => String(s.name || '').trim().toLowerCase() === needle)
  if (exact) return exact.id
  const partial = services.find((s) => String(s.name || '').toLowerCase().includes(needle) || needle.includes(String(s.name || '').toLowerCase()))
  return partial?.id || ''
}

/** Seed booking modal from a specific garage vehicle (not always vehicles[0]). */
export function seedBookingFromVehicle(form, vehicle) {
  if (!vehicle) return form
  return {
    ...form,
    vehicle_plate: vehicle.plate_number || form.vehicle_plate || '',
    vehicle_make: vehicle.vehicle_make || form.vehicle_make || '',
    vehicle_model: vehicle.vehicle_model || form.vehicle_model || '',
    vehicle_type: vehicle.vehicle_type || form.vehicle_type || 'medium',
  }
}

/** Phone-only / synthetic login cannot receive Auth reset email. */
export function canOfferPasswordEmailReset(loginEmailOrKind) {
  const s = String(loginEmailOrKind || '').toLowerCase()
  if (!s) return false
  if (s === 'phone' || s === 'plate') return false
  if (s.endsWith('@customers.hakumautocare.com')) return false
  return s.includes('@')
}
