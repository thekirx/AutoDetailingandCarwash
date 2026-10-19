/**
 * 7 / 3 / 1 day reminders for detailing booked ahead (landing page or a confirmed date).
 * One send per offset per booking, via SMS, in-app, and push.
 */
import { busybeeSendSms } from './busybee.mjs'
import { sendWebPushToUsers } from './webPush.mjs'
import { isBookingBoardRow } from '../src/lib/serviceKinds.js'
import { manilaDayOf, manilaTodayISO } from '../src/lib/bookingLead.js'
import { daysUntilDue } from '../src/lib/paintMaintenance.js'
import { DETAILING_REMINDER_DAYS, renderDetailingReminderSms } from '../src/lib/detailingBookingSms.js'
import { smsNotificationsEnabledFromSetting } from '../src/lib/smsNotificationsToggle.js'

export function reminderOffset(scheduledStart, today = manilaTodayISO()) {
  const day = manilaDayOf(scheduledStart)
  const left = daysUntilDue(day, today)
  return DETAILING_REMINDER_DAYS.includes(left) ? left : null
}

export async function runDetailingBookingReminders(db, today = manilaTodayISO()) {
  const horizon = new Date(`${today}T00:00:00+08:00`)
  horizon.setUTCDate(horizon.getUTCDate() + 8)
  const { data, error } = await db
    .from('bookings')
    .select('id, customer_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, scheduled_start, status, branch, service_id, services(name, slug, pay_category), assigned_staff_id')
    .in('status', ['pending', 'confirmed'])
    .eq('is_archived', false)
    .gte('scheduled_start', `${today}T00:00:00+08:00`)
    .lte('scheduled_start', horizon.toISOString())
    .limit(400)
  if (error) throw new Error(error.message)

  const { data: smsSetting } = await db.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
  const smsOn = smsNotificationsEnabledFromSetting(smsSetting?.value)
  const due = (data || []).filter((row) => isBookingBoardRow(row) && reminderOffset(row.scheduled_start, today))
  const sent = []

  for (const booking of due) {
    const days = reminderOffset(booking.scheduled_start, today)
    const eventType = `booking_remind_${days}d`
    const { data: prior } = await db
      .from('sms_events')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('event_type', eventType)
      .limit(1)
    if (prior?.length) continue

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

    let smsStatus = 'skipped'
    if (booking.customer_phone && smsOn) {
      const sms = await busybeeSendSms({ phone: booking.customer_phone, message })
      smsStatus = sms.status || (sms.ok ? 'sent' : 'failed')
    }
    await db.from('sms_events').insert({
      phone: booking.customer_phone || '',
      message,
      event_type: eventType,
      booking_id: booking.id,
      customer_id: booking.customer_id || null,
      provider: 'busybee',
      status: smsStatus,
      sent_at: smsStatus === 'sent' ? new Date().toISOString() : null,
    })
    sent.push({ id: booking.id, days, smsStatus })
  }

  return { ok: true, considered: due.length, sent: sent.length, rows: sent }
}
