import { createClient } from '@supabase/supabase-js'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const ALLOWED = new Set(['admin', 'BossMich', 'marketing', 'team_lead', 'staff', 'cashier', 'sales'])

/**
 * Notify only (booking already updated). Used by floor queue after status changes.
 * Body: { booking_id, status? }
 */
export async function handleNotifyBookingRequest(req, res) {
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
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const bookingId = body.booking_id
    if (!bookingId) return json(res, 400, { error: 'booking_id required' })

    const { data: booking, error } = await db.from('bookings').select('*').eq('id', bookingId).single()
    if (error || !booking) return json(res, 404, { error: error?.message || 'Booking not found' })

    const status = String(body.status || booking.status).trim()
    let notify = null
    try {
      notify = await notifyBookingStatus(booking, status)
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
