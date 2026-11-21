import {
  computeServiceSizePricing,
  insertBookingPlaceholderAndNotify,
  resolveOptionalCustomerId,
} from './detailingBookingIntake.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'
import { resolveBookingCustomerId } from './publicBookCustomer.mjs'
import { friendCodeAccountError, normalizeReferral, referralRequiredError } from '../src/lib/referralSource.js'
import { listReferralStaff } from './referralStaff.mjs'
import { canonicalPhMobile, phoneDigits, plateValidationError } from '../src/lib/customerAuth.js'
import { isBookingBoardService } from '../src/lib/serviceKinds.js'
import { isCustomerBookable } from '../src/lib/bookingLead.js'
import {
  normalizePromoCode,
  promoAppliesToService,
  promoCodeShapeError,
  promoDiscountedPriceMinor,
  promoVoucherWindowError,
  voucherScopeLabel,
} from '../src/lib/promoVoucher.js'
import { adminClient as admin } from './supabaseAdmin.mjs'

/**
 * Public online booking — works with or without customer account.
 * Inserts booking via service role, then BusyBee SMS (+ push if logged in).
 */
export const ASSESSMENT_NOTE = 'Coating assessment: car was ceramic coated somewhere else. Check the coating at the branch, then confirm maintenance or a new coating and the price with the customer.'

export async function handlePublicBookRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `public-book:${clientIp(req)}`, limit: 20, windowMs: 60_000 })
    const body = await readJsonBody(req)
    const first = String(body.customer_first_name || '').trim()
    const last = String(body.customer_last_name || '').trim()
    const customer_name = String(body.customer_name || `${first} ${last}`).trim()
    const rawPhone = String(body.customer_phone || '').trim()
    const digits = phoneDigits(rawPhone)
    const customer_phone = canonicalPhMobile(rawPhone) || rawPhone
    const vehicle_plate = String(body.vehicle_plate || '').trim().toUpperCase() || null
    let vehicle_make = String(body.vehicle_make || '').trim() || null
    let vehicle_model = String(body.vehicle_model || '').trim() || null
    const service_id = body.service_id
    const branch = String(body.branch || '').trim()
    const scheduled_start = body.scheduled_start ? new Date(body.scheduled_start).toISOString() : null

    const vehicle_type = String(body.vehicle_type || 'medium').trim().toLowerCase() || 'medium'
    // Customer app Ceramic: "coated somewhere else" books an assessment visit; the team sets the job after checking.
    const needs_assessment = body.needs_assessment === true

    if (!customer_name || !customer_phone || !service_id || !branch || !scheduled_start) {
      return json(res, 400, { error: 'Name, phone, service, branch, and schedule are required.' })
    }
    if (digits.length < 10 || digits.length > 13) {
      return json(res, 400, { error: 'Enter a valid PH mobile number (e.g. 09171234567).' })
    }
    if (!vehicle_plate) return json(res, 400, { error: 'Plate number is required.' })
    const plateError = plateValidationError(vehicle_plate)
    if (plateError) return json(res, 400, { error: plateError })
    if (!vehicle_make || !vehicle_model) {
      return json(res, 400, { error: 'Vehicle brand and model are required.' })
    }
    if (!isCustomerBookable(scheduled_start)) {
      return json(res, 400, {
        error: 'Pick a day at least 2 days ahead. The branch checks availability before the first two days.',
      })
    }

    const db = admin()
    // Align casing with Super Admin vehicle_catalog when the pair exists (active).
    const { data: catalogHit } = await db
      .from('vehicle_catalog')
      .select('make, model, size_slug')
      .eq('is_active', true)
      .ilike('make', vehicle_make)
      .ilike('model', vehicle_model)
      .maybeSingle()
    if (catalogHit) {
      vehicle_make = catalogHit.make
      vehicle_model = catalogHit.model
    }

    const { data: branchRow } = await db
      .from('branches')
      .select('slug, is_active, coming_soon')
      .eq('slug', branch)
      .eq('is_active', true)
      .maybeSingle()
    if (!branchRow) return json(res, 400, { error: 'Branch is not available for booking.' })
    if (branchRow.coming_soon) return json(res, 400, { error: 'This branch is coming soon.' })

    const { data: svc } = await db
      .from('services')
      .select('id, name, slug, pay_category, price_minor, is_active, is_archived, parent_service_id, service_size_prices(size_slug, price_minor)')
      .eq('id', service_id)
      .maybeSingle()
    if (!svc || svc.is_active === false || svc.is_archived === true) {
      return json(res, 400, { error: 'Service not found.' })
    }
    // Online /book is the detailing pipeline only — wash & packages use the shop queue.
    if (!isBookingBoardService(svc)) {
      return json(res, 400, {
        error: 'Online booking is for detailing only (Ceramic, Tint, PPF, Paint Maintenance). Same-day wash and packages use the shop queue.',
      })
    }
    const { pricingSlug, priceMinor: priced } = computeServiceSizePricing({
      service: svc,
      catalogSize: catalogHit?.size_slug,
      vehicleType: vehicle_type,
      vehicleMake: vehicle_make,
      vehicleModel: vehicle_model,
    })

    // Attach only when JWT maps to customers.role=customer (never phone / metadata)
    const token = bearer(req)
    const customer_id = await resolveOptionalCustomerId(db, token)
    void resolveBookingCustomerId

    let staff = []
    try {
      staff = await listReferralStaff(db)
    } catch {
      staff = []
    }
    const referral = normalizeReferral({
      source: body.referral_source,
      name: body.referred_by_name,
      staff,
    })
    const referralError = referralRequiredError(referral) || friendCodeAccountError(referral, customer_id)
    if (referralError) return json(res, 400, { error: referralError })

    const rawVoucherCode = String(body.voucher_code || '').trim()
    let appliedVoucher = null
    let promoDiscountMinor = 0
    let finalPriced = priced

    if (rawVoucherCode) {
      const normalizedCode = normalizePromoCode(rawVoucherCode)
      const shapeErr = promoCodeShapeError(normalizedCode)
      if (shapeErr) return json(res, 400, { error: shapeErr })

      const { data: voucher, error: vErr } = await db
        .from('promo_vouchers')
        .select('*, services(name, slug)')
        .eq('code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle()
      if (vErr || !voucher) {
        return json(res, 400, { error: 'That voucher code was not found.' })
      }

      const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const windowErr = promoVoucherWindowError(voucher, todayKey)
      if (windowErr) return json(res, 400, { error: windowErr })

      const { count: holds } = await db
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('promo_voucher_id', voucher.id)
        .not('status', 'in', '("completed","cancelled")')
      const maxUses = Math.max(0, Math.floor(Number(voucher.max_uses) || 0))
      const usesCount = Math.max(0, Math.floor(Number(voucher.uses_count) || 0))
      if (usesCount + (holds || 0) >= maxUses) {
        return json(res, 400, { error: 'That voucher has no uses left.' })
      }

      if (customer_id) {
        const { count: prior } = await db
          .from('promo_voucher_redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('voucher_id', voucher.id)
          .eq('customer_id', customer_id)
          .not('consumed_at', 'is', null)
        const maxPer = Math.max(1, Math.floor(Number(voucher.max_per_customer) || 1))
        if ((prior || 0) >= maxPer) {
          return json(res, 400, { error: 'You have already used that voucher.' })
        }
      }

      if (!promoAppliesToService(voucher, svc.pay_category, svc.slug, svc.id, svc.parent_service_id)) {
        const scope = voucherScopeLabel(voucher, voucher.services?.name || svc.name)
        return json(res, 400, { error: `That voucher is for ${scope}.` })
      }

      finalPriced = promoDiscountedPriceMinor(priced, voucher)
      promoDiscountMinor = priced - finalPriced
      appliedVoucher = voucher
    }

    const insert = {
      customer_name,
      customer_phone,
      customer_id,
      referral_source: referral.referral_source,
      referred_by_name: referral.referred_by_name,
      referred_by_staff_id: referral.referred_by_staff_id,
      vehicle_plate,
      vehicle_make,
      vehicle_model,
      vehicle_type: pricingSlug,
      service_id,
      branch,
      scheduled_start,
      status: 'pending',
      is_archived: false,
      price_minor: priced,
      final_price_minor: finalPriced,
      promo_voucher_id: appliedVoucher ? appliedVoucher.id : null,
      promo_discount_minor: promoDiscountMinor,
      promo_applied_at: appliedVoucher ? new Date().toISOString() : null,
      ...(needs_assessment ? { notes: ASSESSMENT_NOTE } : {}),
    }

    const { booking, notify } = await insertBookingPlaceholderAndNotify({
      db,
      insertRow: insert,
      appliedVoucher,
      promoDiscountMinor,
      customerId: customer_id,
    })

    return json(res, 200, {
      ok: true,
      booking: {
        id: booking.id,
        status: booking.status,
        branch: booking.branch,
        scheduled_start: booking.scheduled_start,
        customer_id: booking.customer_id,
      },
      notify,
    })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
