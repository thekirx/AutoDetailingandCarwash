import { createClient } from '@supabase/supabase-js'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const ALLOWED = new Set(['admin', 'BossMich', 'marketing', 'team_lead'])

/**
 * Ops updates booking status + triggers BusyBee SMS / push.
 * Body: { booking_id, status }
 */
export async function handleBookingStatusRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })

    const db = admin()
    const { data: userData, error: userErr } = await db.auth.getUser(token)
    if (userErr || !userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const bookingId = body.booking_id
    const status = String(body.status || '').trim()
    if (!bookingId || !status) return json(res, 400, { error: 'booking_id and status required' })

    const { data: booking, error } = await db
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('*')
      .single()
    if (error) return json(res, 400, { error: error.message })

    let notify = null
    try {
      notify = await notifyBookingStatus(booking, status)
    } catch (err) {
      notify = { error: String(err.message || err) }
    }

    return json(res, 200, { ok: true, booking: { id: booking.id, status: booking.status }, notify })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
