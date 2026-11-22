import { notifyBookingStatus } from './notifyBooking.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const NOTIFY_BOOKING_COLS =
  'id, branch, customer_id, customer_name, customer_phone, vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_id, scheduled_start, estimated_completion, status, queue_date, queue_number, visit_group_id, is_redo, price_minor, payable_minor, progress_photo_urls, is_archived'

const ALLOWED = new Set(['admin', 'BossMich', 'assistant_super_admin', 'team_lead', 'sales', 'operations_lead'])

/**
 * Notify only (booking already updated). Used by floor queue & detailing schedule after status changes.
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
    const staff = await resolveActiveStaff(db, token, { select: 'role' })
    if (!staff) {
      const { data: userData } = await db.auth.getUser(token)
      if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })
      return json(res, 403, { error: 'Forbidden' })
    }
    if (!ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const bookingId = body.booking_id
    if (!bookingId) return json(res, 400, { error: 'booking_id required' })

    const { data: booking, error } = await db.from('bookings').select(NOTIFY_BOOKING_COLS).eq('id', bookingId).single()
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
