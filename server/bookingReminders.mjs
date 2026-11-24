/**
 * 7 / 3 / 1 day reminders for detailing booked ahead (landing page or a confirmed date).
 * One send per offset per booking, via in-app inbox and Web Push (SMS reserved for live status updates).
 */
import { listUpcomingDetailingBookings } from './bookingRepo.mjs'
import { sendWebPushToUsers } from './webPush.mjs'
import { loadNotificationConfig } from './notificationConfigApi.mjs'
import { isWithinQuietHours } from '../src/lib/notificationConfig.js'
import { isBookingBoardRow } from '../src/lib/serviceKinds.js'
import { manilaDayOf, manilaTodayISO } from '../src/lib/bookingLead.js'
import { daysUntilDue } from '../src/lib/paintMaintenance.js'
import { DETAILING_REMINDER_DAYS, renderDetailingReminderSms } from '../src/lib/detailingBookingSms.js'

export function reminderOffset(scheduledStart, today = manilaTodayISO(), daysList = DETAILING_REMINDER_DAYS) {
  const day = manilaDayOf(scheduledStart)
  const left = daysUntilDue(day, today)
  const allowed = Array.isArray(daysList) && daysList.length ? daysList : DETAILING_REMINDER_DAYS
  return allowed.includes(left) ? left : null
}

export async function runDetailingBookingReminders(db, today = manilaTodayISO()) {
  const config = await loadNotificationConfig(db)
  if (config.booking_reminders_enabled === false) {
    return { ok: true, skipped: true, reason: 'disabled_by_admin', considered: 0, sent: 0, rows: [] }
  }
  if (isWithinQuietHours(config)) {
    return { ok: true, skipped: true, reason: 'quiet_hours', considered: 0, sent: 0, rows: [] }
  }

  const allowedDays =
    Array.isArray(config.booking_reminder_days) && config.booking_reminder_days.length
      ? config.booking_reminder_days
      : DETAILING_REMINDER_DAYS
  const maxDaysAhead = Math.max(...allowedDays, 1)

  const horizon = new Date(`${today}T00:00:00+08:00`)
  horizon.setUTCDate(horizon.getUTCDate() + maxDaysAhead + 1)
  const { data, error } = await listUpcomingDetailingBookings(db, {
    fromIso: `${today}T00:00:00+08:00`,
    toIso: horizon.toISOString(),
    limit: 400,
  })
  if (error) throw new Error(error.message)

  const due = (data || []).filter((row) => isBookingBoardRow(row) && reminderOffset(row.scheduled_start, today, allowedDays))
  const sent = []

  // Batch prior reminder lookup across all due bookings to avoid N+1 per-booking SELECTs.
  const priorSent = new Set()
  if (due.length) {
    const dueIds = due.map((row) => row.id)
    const eventTypes = allowedDays.map((d) => `booking_remind_${d}d`)
    const { data: priorRows } = await db
      .from('sms_events')
      .select('booking_id, event_type')
      .in('booking_id', dueIds)
      .in('event_type', eventTypes)
    for (const r of priorRows || []) {
      priorSent.add(`${r.booking_id}|${r.event_type}`)
    }
  }

  for (const booking of due) {
    const days = reminderOffset(booking.scheduled_start, today, allowedDays)
    const eventType = `booking_remind_${days}d`
    if (priorSent.has(`${booking.id}|${eventType}`)) continue

    const bookingWithService = {
      ...booking,
      service_name: booking.services?.name,
    }
    const message = renderDetailingReminderSms(bookingWithService, days)
    const title = days === 1 ? 'Detailing tomorrow' : `Detailing in ${days} days`

    if (booking.customer_id) {
      await db.from('user_notifications').insert({
        user_id: booking.customer_id,
        kind: 'booking_status',
        title,
        body: message,
        url: '/account',
        tag: `booking-remind-${booking.id}-${days}`,
      })
      if (config.push_notifications_enabled !== false) {
        try {
          await sendWebPushToUsers({
            userIds: [booking.customer_id],
            title,
            body: message,
            url: '/account',
            tag: `booking-remind-${booking.id}-${days}`,
            kind: 'booking_status',
          })
        } catch {
          /* push is best-effort */
        }
      }
    }

    // BusyBee SMS is restricted to live booking status updates; reminders deliver via Push + Inbox only.
    const smsStatus = 'skipped'
    await db.from('sms_events').insert({
      phone: booking.customer_phone || '',
      message,
      event_type: eventType,
      booking_id: booking.id,
      customer_id: booking.customer_id || null,
      provider: 'busybee',
      status: smsStatus,
      provider_response: 'status_sms_only',
      sent_at: null,
    })
    sent.push({ id: booking.id, days, smsStatus })
  }

  return { ok: true, considered: due.length, sent: sent.length, rows: sent }
}
