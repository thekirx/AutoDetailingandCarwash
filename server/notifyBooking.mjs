/**
 * Booking notification builders + BusyBee SMS + inbox/push fan-out.
 * Best-effort: never throw to callers after durable booking writes.
 */
import { createClient } from '@supabase/supabase-js'
import { busybeeSendSms } from './busybee.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const STATUS_COPY = {
  pending: {
    kind: 'booking_received',
    title: 'Booking received',
    sms: (b) =>
      `Hakum Auto Care: We received your booking for ${b.vehicle_plate || 'your vehicle'} at ${b.branch}. We'll confirm soon.`,
    body: (b) => `We received your request at ${b.branch}. We'll confirm shortly.`,
  },
  confirmed: {
    kind: 'booking_confirm',
    title: 'Booking confirmed',
    sms: (b) =>
      `Hakum Auto Care: Your booking is CONFIRMED (${b.branch}${b.scheduled_start ? `, ${new Date(b.scheduled_start).toLocaleString('en-PH')}` : ''}). See you soon!`,
    body: (b) => `You're confirmed at ${b.branch}.`,
  },
  in_progress: {
    kind: 'booking_status',
    title: 'Service in progress',
    sms: (b) => `Hakum Auto Care: We're working on ${b.vehicle_plate || 'your car'} now.`,
    body: (b) => `${b.vehicle_plate || 'Your vehicle'} is being detailed.`,
  },
  waiting: {
    kind: 'booking_status',
    title: 'In the queue',
    sms: (b) => `Hakum Auto Care: ${b.vehicle_plate || 'Your vehicle'} is waiting in the ${b.branch} queue.`,
    body: (b) => `Waiting at ${b.branch}.`,
  },
  for_payment: {
    kind: 'booking_status',
    title: 'Ready for payment',
    sms: (b) => `Hakum Auto Care: ${b.vehicle_plate || 'Your vehicle'} is ready — please proceed to payment.`,
    body: () => 'Your visit is ready for payment at the counter.',
  },
  completed: {
    kind: 'booking_status',
    title: 'Service complete',
    sms: (b) => `Hakum Auto Care: ${b.vehicle_plate || 'Your car'} is done. Thank you for choosing Hakum!`,
    body: () => 'Your service is complete. Thank you!',
  },
  cancelled: {
    kind: 'booking_status',
    title: 'Booking cancelled',
    sms: (b) => `Hakum Auto Care: Your booking at ${b.branch} was cancelled. Message us if you need to rebook.`,
    body: (b) => `Booking at ${b.branch} was cancelled.`,
  },
}

export function buildBookingNotifyPayload(booking, status) {
  const key = status || booking?.status
  const copy = STATUS_COPY[key]
  if (!booking || !copy) return null
  const phone = booking.customer_phone
  const userId = booking.customer_id || null
  return {
    phone,
    userId,
    kind: copy.kind,
    title: copy.title,
    body: copy.body(booking),
    sms: copy.sms(booking),
    url: userId ? '/account' : '/book',
    tag: `booking-${booking.id}-${key}`,
  }
}

async function logSmsEvent(db, { phone, message, eventType, bookingId, customerId, status, providerResponse }) {
  const row = {
    phone,
    message,
    event_type: eventType,
    booking_id: bookingId || null,
    customer_id: customerId || null,
    provider: 'busybee',
    status,
    provider_response: providerResponse || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }
  const { error } = await db.from('sms_events').insert(row)
  if (error) {
    await db.from('sms_events').insert({
      to_phone: phone,
      body: message,
      template_type: eventType,
      status,
    })
  }
}

/**
 * After booking create/status change: SMS (always if phone) + inbox/push (if customer_id).
 */
export async function notifyBookingStatus(booking, status = booking?.status) {
  const payload = buildBookingNotifyPayload(booking, status)
  if (!payload) return { skipped: true }

  const db = admin()
  const result = { sms: null, inbox: null, push: null }

  if (payload.phone) {
    const sms = await busybeeSendSms({ phone: payload.phone, message: payload.sms })
    result.sms = sms
    await logSmsEvent(db, {
      phone: payload.phone,
      message: payload.sms,
      eventType: payload.kind,
      bookingId: booking.id,
      customerId: payload.userId,
      status: sms.status,
      providerResponse: sms.providerResponse,
    })
  }

  if (payload.userId) {
    const { data: inbox, error: inboxErr } = await db
      .from('user_notifications')
      .insert({
        user_id: payload.userId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      })
      .select('id')
      .maybeSingle()
    result.inbox = inboxErr ? { error: inboxErr.message } : inbox

    try {
      result.push = await sendWebPushToUsers({
        userIds: [payload.userId],
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
        kind: payload.kind,
      })
    } catch (err) {
      result.push = { error: String(err.message || err) }
    }
  }

  return result
}
