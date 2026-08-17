import { createClient } from '@supabase/supabase-js'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'
import { resolveBookingCustomerId } from './publicBookCustomer.mjs'
import { plateValidationError } from '../src/lib/customerAuth.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Public online booking — works with or without customer account.
 * Inserts booking via service role, then BusyBee SMS (+ push if logged in).
 */
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
    const customer_phone = String(body.customer_phone || '').trim()
    const vehicle_plate = String(body.vehicle_plate || '').trim().toUpperCase() || null
    let vehicle_make = String(body.vehicle_make || '').trim() || null
    let vehicle_model = String(body.vehicle_model || '').trim() || null
    const service_id = body.service_id
    const branch = String(body.branch || '').trim()
    const scheduled_start = body.scheduled_start ? new Date(body.scheduled_start).toISOString() : null

    const vehicle_type = String(body.vehicle_type || 'medium').trim().toLowerCase() || 'medium'

    if (!customer_name || !customer_phone || !service_id || !branch || !scheduled_start) {
      return json(res, 400, { error: 'Name, phone, service, branch, and schedule are required.' })
    }
    if (!vehicle_plate) return json(res, 400, { error: 'Plate number is required.' })
    const plateError = plateValidationError(vehicle_plate)
    if (plateError) return json(res, 400, { error: plateError })
    if (!vehicle_make || !vehicle_model) {
      return json(res, 400, { error: 'Vehicle brand and model are required.' })
    }

    const db = admin()
    // Align casing with Super Admin vehicle_catalog when the pair exists (active).
    const { data: catalogHit } = await db
      .from('vehicle_catalog')
      .select('make, model')
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
      .select('id, price_minor, service_size_prices(size_slug, price_minor)')
      .eq('id', service_id)
      .maybeSingle()
    if (!svc) return json(res, 400, { error: 'Service not found.' })
    const sizeMap = Object.fromEntries((svc.service_size_prices || []).map((p) => [p.size_slug, p.price_minor]))
    const pricingSlug = ['small', 'medium', 'large', 'extra_large'].includes(vehicle_type)
      ? vehicle_type
      : 'medium'
    const priced =
      sizeMap[pricingSlug] ?? sizeMap.medium ?? svc.price_minor ?? 0

    // Attach only when JWT maps to customers.role=customer (never phone / metadata)
    let customer_id = null
    const token = bearer(req)
    if (token) {
      const { data: userData } = await db.auth.getUser(token)
      const uid = userData?.user?.id
      if (uid) {
        const { data: cust } = await db.from('customers').select('id, role').eq('id', uid).maybeSingle()
        customer_id = resolveBookingCustomerId({ authUid: uid, customerRole: cust?.role })
      }
    }

    const insert = {
      customer_name,
      customer_phone,
      customer_id,
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
      final_price_minor: priced,
    }

    const { data: booking, error } = await db.from('bookings').insert(insert).select('*').single()
    if (error) return json(res, 400, { error: error.message })

    // Best-effort notify — never fail the booking
    let notify = null
    try {
      notify = await notifyBookingStatus(booking, 'pending')
    } catch (err) {
      notify = { error: String(err.message || err) }
    }

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
