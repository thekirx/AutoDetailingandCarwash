/**
 * Shared `public.bookings` repository seam (`BOOKING_PROJECTIONS` + query/mutation helpers).
 * Centralizes PostgREST embed disambiguation (`customers!bookings_customer_id_fkey`),
 * canonical column projections, voucher-hold counting, and atomic booking writes so
 * reminder, portal, intake, and floor-board handlers never hand-roll diverging embeds.
 */

export const BOOKING_SERVICE_EMBED = 'services(name, slug, pay_category)'
export const BOOKING_VOUCHER_SERVICE_EMBED = 'services(name, pay_category, slug, parent_service_id)'
export const BOOKING_CUSTOMER_EMBED = 'customers!bookings_customer_id_fkey(full_name)'

export const BOOKING_PROJECTIONS = Object.freeze({
  statusDetail: `id, branch, status, customer_name, customer_phone, customer_id, vehicle_plate, service_id, ${BOOKING_SERVICE_EMBED}`,
  notifyFull: `*, ${BOOKING_SERVICE_EMBED}`,
  notifyCols:
    `id, branch, customer_id, customer_name, customer_phone, vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_id, assigned_staff_id, scheduled_start, scheduled_end, estimated_end, status, queue_date, queue_number, visit_group_id, redo_at, price_minor, final_price_minor, is_archived, ${BOOKING_SERVICE_EMBED}`,
  reschedule: `id, customer_id, customer_name, customer_phone, branch, status, vehicle_plate, vehicle_make, vehicle_model, scheduled_start, reschedule_requested_at, ${BOOKING_SERVICE_EMBED}, ${BOOKING_CUSTOMER_EMBED}`,
  rateVisit: `id, customer_id, customer_name, vehicle_plate, status, completed_at, for_payment_at, ${BOOKING_CUSTOMER_EMBED}`,
  reminder: `id, customer_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, scheduled_start, status, branch, service_id, ${BOOKING_SERVICE_EMBED}, assigned_staff_id`,
  history: `id, customer_id, customer_name, customer_phone, vehicle_plate, vehicle_make, vehicle_model, branch, status, scheduled_start, scheduled_end, completed_at, created_at, updated_at, final_price_minor, price_minor, notes, service_id, ${BOOKING_SERVICE_EMBED}`,
  portalHistory: `id, branch, status, vehicle_plate, vehicle_make, vehicle_model, price_minor, final_price_minor, promo_voucher_id, promo_discount_minor, scheduled_start, created_at, customer_name, service_id, visit_group_id, for_payment_at, completed_at, ${BOOKING_SERVICE_EMBED}`,
  portalActive: `id, branch, status, vehicle_plate, vehicle_make, vehicle_model, scheduled_start, notes, reschedule_requested_at, price_minor, final_price_minor, promo_voucher_id, promo_discount_minor, queue_number, service_id, visit_group_id, for_payment_at, completed_at, ${BOOKING_SERVICE_EMBED}`,
  portalReview: `id, branch, status, customer_id, customer_name, ${BOOKING_SERVICE_EMBED}`,
  portalVoucher: `id, branch, status, customer_id, service_id, price_minor, final_price_minor, promo_voucher_id, ${BOOKING_VOUCHER_SERVICE_EMBED}`,
  search: `id, branch, status, vehicle_plate, vehicle_make, vehicle_model, customer_name, queue_number, scheduled_start, ${BOOKING_SERVICE_EMBED}`,
  maintenanceLatest: 'customer_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_type',
})

/** Fetch one booking row by ID (`maybeSingle`). */
export async function findBookingById(db, bookingId, projection = BOOKING_PROJECTIONS.statusDetail) {
  return db.from('bookings').select(projection).eq('id', bookingId).maybeSingle()
}

/** Fetch one booking row scoped to a customer owner (`maybeSingle`). */
export async function findCustomerBooking(db, { bookingId, userId, projection = BOOKING_PROJECTIONS.reschedule }) {
  return db.from('bookings').select(projection).eq('id', bookingId).eq('customer_id', userId).maybeSingle()
}

/** Atomically claim a once-only customer reschedule request while the booking is still open. */
export async function claimBookingReschedule(db, { bookingId, userId, timestamp, openStatuses }) {
  return db
    .from('bookings')
    .update({ reschedule_requested_at: timestamp })
    .eq('id', bookingId)
    .eq('customer_id', userId)
    .is('reschedule_requested_at', null)
    .in('status', [...openStatuses])
    .select('id, reschedule_requested_at')
    .maybeSingle()
}

/** Update a booking row and return its refreshed projection. */
export async function updateBookingRecord(db, bookingId, patch, projection = BOOKING_PROJECTIONS.notifyFull) {
  return db.from('bookings').update(patch).eq('id', bookingId).select(projection).single()
}

/** Insert a booking row and return the inserted projection. */
export async function insertBookingRecord(db, insertRow, projection = '*') {
  return db.from('bookings').insert(insertRow).select(projection).single()
}

/** Count open promo-voucher holds on non-closed bookings (`pending`/`confirmed`/`waiting`/`in_progress`/`final_checking`/`for_payment`). */
export async function countActiveVoucherHolds(db, voucherId) {
  const { count } = await db
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('promo_voucher_id', voucherId)
    .not('status', 'in', '("completed","cancelled")')
  return count || 0
}

/** List completed non-archived customer bookings inside the rate-visit lookback window. */
export async function listCompletedBookingsForReview(db, { sinceIso, limit = 200 }) {
  return db
    .from('bookings')
    .select(BOOKING_PROJECTIONS.rateVisit)
    .eq('status', 'completed')
    .eq('is_archived', false)
    .not('customer_id', 'is', null)
    .gte('completed_at', sinceIso)
    .order('completed_at', { ascending: true })
    .limit(limit)
}

/** List upcoming pending/confirmed bookings for 7/3/1d detailing reminders. */
export async function listUpcomingDetailingBookings(db, { fromIso, toIso, limit = 400 }) {
  return db
    .from('bookings')
    .select(BOOKING_PROJECTIONS.reminder)
    .in('status', ['pending', 'confirmed'])
    .eq('is_archived', false)
    .gte('scheduled_start', fromIso)
    .lte('scheduled_start', toIso)
    .limit(limit)
}

/** List non-archived open bookings for a specific service and candidate plates. */
export async function findOpenBookingByPlates(db, { serviceId, plates }) {
  return db
    .from('bookings')
    .select('id, status, branch')
    .eq('is_archived', false)
    .eq('service_id', serviceId)
    .in('vehicle_plate', plates)
    .not('status', 'in', '(completed,cancelled)')
    .limit(1)
}

/** Fetch the most recent booking matching any candidate plate string for maintenance backfill. */
export async function findLatestBookingByPlates(db, plates) {
  return db
    .from('bookings')
    .select(BOOKING_PROJECTIONS.maintenanceLatest)
    .in('vehicle_plate', plates)
    .order('created_at', { ascending: false })
    .limit(1)
}
