/**
 * Record a customer reschedule request and tell them a rep will call.
 * Does not change scheduled_start. Staff set the new day on the bookings board.
 */
import { customerNotifyAllowed } from '../src/lib/ownerRevisionsPhase7.js'
import {
  RESCHEDULE_ACK,
  RESCHEDULE_OPEN_STATUSES,
  renderRescheduleAckSms,
  rescheduleRequestDecision,
} from '../src/lib/bookingReschedule.js'
import { busybeeSendSms } from './busybee.mjs'
import { isSmsNotificationsEnabled } from './notifyBooking.mjs'
import { notifyStaffEvent } from './notifyOpsEvent.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

const SELECT =
  'id, customer_id, customer_name, customer_phone, branch, status, vehicle_plate, vehicle_make, vehicle_model, scheduled_start, reschedule_requested_at, services(name, slug, pay_category), customers(full_name)'

async function logSms(db, row) {
  const { error } = await db.from('sms_events').insert(row)
  if (!error) return
  await db.from('sms_events').insert({
    to_phone: row.phone,
    body: row.message,
    template_type: row.event_type,
    status: row.status,
  })
}

async function tellCustomer(db, booking, sms) {
  const userId = booking.customer_id
  const result = { sms: null, inbox: null, push: null }
  let prefs = null
  if (userId) {
    const { data } = await db
      .from('customers')
      .select('id, notify_sms, notify_push, is_disabled')
      .eq('id', userId)
      .maybeSingle()
    prefs = data
  }
  const smsOn = await isSmsNotificationsEnabled(db)
  if (booking.customer_phone && smsOn && customerNotifyAllowed(prefs, 'sms')) {
    const sent = await busybeeSendSms({ phone: booking.customer_phone, message: sms })
    result.sms = sent
    await logSms(db, {
      phone: booking.customer_phone,
      message: sms,
      event_type: 'booking_reschedule',
      booking_id: booking.id,
      customer_id: userId,
      provider: 'busybee',
      status: sent.status,
      provider_response: sent.providerResponse || null,
      sent_at: sent.status === 'sent' ? new Date().toISOString() : null,
    })
  }
  if (userId && customerNotifyAllowed(prefs, 'push')) {
    const notice = {
      user_id: userId,
      kind: 'booking_reschedule',
      title: 'Reschedule request received',
      body: sms,
      url: `/account/visit/${booking.id}`,
      tag: `reschedule-${booking.id}`,
    }
    const { error } = await db.from('user_notifications').insert(notice)
    result.inbox = error ? { error: error.message } : { inserted: 1 }
    try {
      result.push = await sendWebPushToUsers({
        userIds: [userId],
        title: notice.title,
        body: notice.body,
        url: notice.url,
        tag: notice.tag,
        kind: notice.kind,
      })
    } catch (err) {
      result.push = { error: String(err.message || err) }
    }
  }
  return result
}

export async function requestBookingReschedule(db, { userId, bookingId }) {
  const id = String(bookingId || '').trim()
  if (!id) throw Object.assign(new Error('Booking is required.'), { status: 400 })

  const { data: booking, error } = await db
    .from('bookings')
    .select(SELECT)
    .eq('id', id)
    .eq('customer_id', userId)
    .maybeSingle()
  if (error) throw Object.assign(new Error(error.message), { status: 400 })

  const decision = rescheduleRequestDecision(booking)
  if (!decision.ok) throw Object.assign(new Error(decision.error), { status: decision.status })
  if (decision.already) {
    return { ok: true, already: true, message: RESCHEDULE_ACK, reschedule_requested_at: booking.reschedule_requested_at }
  }

  const stamp = new Date().toISOString()
  const { data: saved, error: saveError } = await db
    .from('bookings')
    .update({ reschedule_requested_at: stamp })
    .eq('id', booking.id)
    .eq('customer_id', userId)
    .is('reschedule_requested_at', null)
    .in('status', [...RESCHEDULE_OPEN_STATUSES])
    .select('id, reschedule_requested_at')
    .maybeSingle()
  if (saveError) throw Object.assign(new Error(saveError.message), { status: 400 })
  if (!saved) {
    return { ok: true, already: true, message: RESCHEDULE_ACK }
  }

  const sms = renderRescheduleAckSms(booking)
  let notice = null
  try {
    notice = await tellCustomer(db, booking, sms)
  } catch (err) {
    notice = { error: String(err.message || err) }
  }
  try {
    await notifyStaffEvent(
      db,
      'booking_reschedule',
      {
        bookingId: booking.id,
        name: booking.customer_name,
        plate: booking.vehicle_plate,
      },
      { branch: booking.branch || null },
    )
  } catch {
    /* the request is saved; the branch still sees it on the board */
  }

  return { ok: true, message: RESCHEDULE_ACK, reschedule_requested_at: saved.reschedule_requested_at, notice }
}
