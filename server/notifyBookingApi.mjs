import { createClient } from '@supabase/supabase-js'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const ALLOWED = new Set(['admin', 'BossMich', 'assistant_super_admin', 'team_lead'])

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
    rateLimit({ key: `notify-booking:${clientIp(req)}`, limit: 60, windowMs: 60_000 })
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

    // Visit milestones (4th / 10th) fire once the visit is fully paid+completed.
    let milestone = null
    if (status === 'completed' && booking.customer_id) {
      try {
        const { runVisitMilestoneSms } = await import('./lifecycleSms.mjs')
        milestone = await runVisitMilestoneSms(db, booking)
      } catch (err) {
        milestone = { error: String(err.message || err) }
      }
    }
    return json(res, 200, { ok: true, notify, milestone })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
