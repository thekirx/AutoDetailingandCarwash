/**
 * Shared detailing Bookings intake helpers for `/book` (`server/publicBook.mjs`)
 * and smart detailing forms (`server/publicOpsForm.mjs`).
 */
import { inferPhPricingSize } from '../src/lib/phVehicleSizes.js'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { resolveBookingCustomerId } from './publicBookCustomer.mjs'

/**
 * Attach customer_id only when the optional bearer JWT maps to customers.role = 'customer'
 * (never trust phone number or JWT user_metadata).
 */
export async function resolveOptionalCustomerId(db, authToken) {
  if (!authToken) return null
  try {
    const { data: userData } = await db.auth.getUser(authToken)
    const uid = userData?.user?.id
    if (!uid) return null
    const { data: cust } = await db.from('customers').select('id, role').eq('id', uid).maybeSingle()
    return resolveBookingCustomerId({ authUid: uid, customerRole: cust?.role })
  } catch {
    return null
  }
}

/**
 * Resolve normalized PH vehicle pricing size slug and minor-unit price for a detailing service.
 */
export function computeServiceSizePricing({
  service,
  catalogSize = '',
  vehicleType = 'medium',
  vehicleMake = null,
  vehicleModel = null,
}) {
  const sizeMap = Object.fromEntries(
    (service?.service_size_prices || []).map((p) => [p.size_slug, p.price_minor]),
  )
  const rawSize = String(vehicleType || '').trim().toLowerCase().replace(/\s+/g, '_')
  const clientIsPricing = ['small', 'medium', 'large', 'extra_large'].includes(rawSize)
  const cleanCatalogSize = String(catalogSize || '').trim()
  const pricingSlug = clientIsPricing
    ? rawSize
    : cleanCatalogSize || inferPhPricingSize(vehicleMake, vehicleModel) || 'medium'
  const priceMinor = sizeMap[pricingSlug] ?? sizeMap.medium ?? service?.price_minor ?? 0
  return { pricingSlug, priceMinor }
}

/**
 * Insert a public.bookings row (Booking Placeholder `pending`), optionally attach a voucher
 * redemption, and fire best-effort `notifyBookingStatus`.
 */
export async function insertBookingPlaceholderAndNotify({
  db,
  insertRow,
  appliedVoucher = null,
  promoDiscountMinor = 0,
  customerId = null,
  notifyBooking = notifyBookingStatus,
}) {
  const { data: booking, error } = await db.from('bookings').insert(insertRow).select('*').single()
  if (error) {
    throw Object.assign(new Error(error.message), { status: 400 })
  }

  if (appliedVoucher) {
    await db.from('promo_voucher_redemptions').insert({
      voucher_id: appliedVoucher.id,
      booking_id: booking.id,
      customer_id: customerId || null,
      discount_minor: promoDiscountMinor,
      consumed_at: null,
    })
  }

  let notify = null
  try {
    notify = await notifyBooking(booking, insertRow.status || 'pending')
  } catch (err) {
    notify = { error: String(err?.message || err) }
  }

  return { booking, notify }
}
