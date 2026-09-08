/**
 * Booking notification builders + BusyBee SMS + inbox/push fan-out.
 * Best-effort: never throw to callers after durable booking writes.
 */
import { createClient } from '@supabase/supabase-js'
import { applyTemplateText, bookingNotifyVars, bookingTemplateKey } from '../src/lib/notificationTemplates.js'
import { customerNotifyAllowed } from '../src/lib/ownerRevisionsPhase7.js'
import { smsNotificationsEnabledFromSetting } from '../src/lib/smsNotificationsToggle.js'
import { busybeeSendSms } from './busybee.mjs'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'
import { applyPaintMaintenanceOnComplete } from './paintMaintenanceSchedule.mjs'
import { resolvePushTargets, sendWebPushToUsers } from './webPush.mjs'

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
      `Hakum: We got your ${b.service_name || 'service'} for ${b.vehicle_plate || 'your vehicle'} at ${b.branch}. We will confirm soon.`,
    body: (b) => `We received your ${b.service_name || 'service'} request at ${b.branch}. We will confirm shortly.`,
    opsTitle: 'New booking',
    opsBody: (b) => `${b.customer_name || 'Customer'} · ${b.vehicle_plate || '—'} · ${b.service_name || 'service'} @ ${b.branch}`,
    opsUrl: '/operations/bookings',
  },
  confirmed: {
    kind: 'booking_confirm',
    title: 'Booking confirmed',
    sms: (b) =>
      `Hakum: ${b.service_name || 'Service'} CONFIRMED for ${b.vehicle_plate || 'your vehicle'} at ${b.branch}${b.scheduled_start ? `, ${new Date(b.scheduled_start).toLocaleString('en-PH')}` : ''}. See you!`,
    body: (b) => `Your ${b.service_name || 'service'} is confirmed at ${b.branch}.`,
    opsTitle: 'Booking confirmed',
    opsBody: (b) => `${b.vehicle_plate || 'Ticket'} · ${b.service_name || 'service'} confirmed @ ${b.branch}`,
    opsUrl: '/operations/bookings',
  },
  in_progress: {
    kind: 'booking_status',
    title: 'Service in progress',
    sms: (b) =>
      `Hakum: Working on your ${b.service_name || 'service'} for ${b.vehicle_plate || 'your car'} now.`,
    body: (b) => `Our team is working on your ${b.service_name || 'service'} for ${b.vehicle_plate || 'your vehicle'}.`,
    opsTitle: 'In progress',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} · ${b.service_name || 'service'} in progress @ ${b.branch}`,
    opsUrl: '/operations/queue',
  },
  waiting: {
    kind: 'booking_status',
    title: 'In the queue',
    sms: (b) =>
      `Hakum: ${b.vehicle_plate || 'Your vehicle'} checked in for ${b.service_name || 'service'} at ${b.branch}. You are in queue.`,
    body: (b) => `${b.vehicle_plate || 'Your vehicle'} is checked in for ${b.service_name || 'service'} at ${b.branch}.`,
    opsTitle: 'New queue ticket',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} · ${b.service_name || 'service'} waiting @ ${b.branch}`,
    opsUrl: '/operations/queue',
  },
  final_checking: {
    kind: 'booking_status',
    title: 'Final checking',
    sms: (b) =>
      `Hakum: ${b.vehicle_plate || 'Your vehicle'} (${b.service_name || 'service'}) is on final QC. Almost ready.`,
    body: (b) => `${b.vehicle_plate || 'Your vehicle'} (${b.service_name || 'service'}) is on final QC.`,
    opsTitle: 'Final checking',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} final check @ ${b.branch}`,
    opsUrl: '/operations/queue',
  },
  for_releasing: {
    kind: 'booking_status',
    title: 'Ready for release',
    sms: (b) =>
      `Hakum: ${b.vehicle_plate || 'Your vehicle'} (${b.service_name || 'service'}) is ready for release at ${b.branch}.`,
    body: (b) => `${b.vehicle_plate || 'Your vehicle'} (${b.service_name || 'service'}) is ready for release.`,
    opsTitle: 'For releasing',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} releasing @ ${b.branch}`,
    opsUrl: '/operations/bookings',
  },
  for_payment: {
    kind: 'booking_status',
    title: 'Ready for payment',
    sms: (b) =>
      `Hakum: ${b.vehicle_plate || 'Your vehicle'} (${b.service_name || 'service'}) is ready — please proceed to payment.`,
    body: (b) => `Your ${b.service_name || 'service'} visit is ready for payment at the counter.`,
    opsTitle: 'Ready for payment',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} → POS @ ${b.branch}`,
    opsUrl: '/operations/pos',
  },
  completed: {
    kind: 'booking_status',
    title: 'Service complete',
    sms: (b) =>
      `Hakum: ${b.service_name || 'Service'} for ${b.vehicle_plate || 'your car'} is done. Thank you! Book: hakumautocare.com/book`,
    body: (b) => `Your ${b.service_name || 'service'} is complete. Thank you!`,
    opsTitle: 'Visit completed',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} completed @ ${b.branch}`,
    opsUrl: '/operations/queue',
  },
  cancelled: {
    kind: 'booking_status',
    title: 'Booking cancelled',
    sms: (b) =>
      `Hakum: Your ${b.service_name || 'service'} at ${b.branch} was cancelled. Rebook anytime.`,
    body: (b) => `Your ${b.service_name || 'service'} booking at ${b.branch} was cancelled.`,
    opsTitle: 'Booking cancelled',
    opsBody: (b) => `${b.vehicle_plate || 'Ticket'} cancelled @ ${b.branch}`,
    opsUrl: '/operations/bookings',
  },
  redo: {
    kind: 'booking_status',
    title: 'We are redoing your service',
    sms: (b) =>
      `Hakum: Sorry — redoing ${b.service_name || 'service'} on ${b.vehicle_plate || 'your car'} at ${b.branch}. We will update you.`,
    body: (b) =>
      `We are sorry. We are redoing ${b.service_name || 'service'} on ${b.vehicle_plate || 'your vehicle'} at ${b.branch}.`,
    opsTitle: 'Redo on floor',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} redo @ ${b.branch}`,
    opsUrl: '/operations/queue',
  },
  photos_ready: {
    kind: 'booking_photos',
    title: 'Progress photos ready',
    sms: (b) =>
      `Hakum: Photos for ${b.vehicle_plate || 'your vehicle'} (${b.service_name || 'service'}) are ready in the Hakum app.`,
    body: (b) => `Progress photos for ${b.vehicle_plate || 'your vehicle'} (${b.service_name || 'service'}) are ready in the app.`,
    opsTitle: 'Progress photos sent',
    opsBody: (b) => `${b.vehicle_plate || 'Vehicle'} photos @ ${b.branch}`,
    opsUrl: '/operations/bookings',
  },
}

/** Keep service labels SMS-safe (GSM single segment). */
export function shortServiceLabel(name, fallback = 'service') {
  const raw = String(name || '').trim() || fallback
  if (raw.length <= 28) return raw
  return `${raw.slice(0, 25)}…`
}

async function hydrateBookingForNotify(db, booking) {
  if (!booking) return booking
  const existing = booking.service_name || booking.services?.name
  if (existing) {
    return { ...booking, service_name: shortServiceLabel(existing) }
  }
  if (!booking.service_id) {
    return { ...booking, service_name: shortServiceLabel(null) }
  }
  const { data } = await db
    .from('services')
    .select('name, slug, pay_category')
    .eq('id', booking.service_id)
    .maybeSingle()
  if (!data) return { ...booking, service_name: shortServiceLabel(null) }
  return {
    ...booking,
    services: data,
    service_name: shortServiceLabel(data.name),
  }
}


/** Customer-facing inbox/SMS/push payload. */
export function buildBookingNotifyPayload(booking, status, templates = null) {
  const key = status || booking?.status
  const copy = STATUS_COPY[key]
  if (!booking || !copy) return null
  const tplKey = bookingTemplateKey(key, 'customer')
  if (templates && !templateEnabled(templates, tplKey)) return null
  const tpl = templates?.[tplKey]
  const vars = bookingNotifyVars(booking)
  const phone = booking.customer_phone
  const userId = booking.customer_id || null
  return {
    phone,
    userId,
    kind: copy.kind,
    title: applyTemplateText(tpl?.title, vars, copy.title),
    body: applyTemplateText(tpl?.body, vars, copy.body(booking)),
    sms: applyTemplateText(tpl?.sms_body, vars, copy.sms(booking)),
    url: userId ? '/account' : '/book',
    tag: `booking-${booking.id}-${key}`,
  }
}

/**
 * Ops fan-out targets: branch staff + Super Admin (all branches).
 * BossMich often has null branch_slug — never filter them by branch.
 */
export function buildOpsPushTargets(booking) {
  const branch = booking?.branch
  if (!branch) return [{ roles: ['BossMich'] }]
  return [
    { roles: ['admin', 'team_lead', 'staff'], branchId: branch },
    { roles: ['BossMich', 'assistant_super_admin'] },
  ]
}

export function buildOpsNotifyCopy(booking, status, templates = null) {
  const key = status || booking?.status
  const copy = STATUS_COPY[key]
  if (!booking || !copy) return null
  const tplKey = bookingTemplateKey(key, 'ops')
  if (templates && !templateEnabled(templates, tplKey)) return null
  const tpl = templates?.[tplKey]
  const vars = bookingNotifyVars(booking)
  return {
    kind: `ops_${copy.kind}`,
    title: applyTemplateText(tpl?.title, vars, copy.opsTitle || copy.title),
    body: applyTemplateText(tpl?.body, vars, copy.opsBody(booking)),
    url: copy.opsUrl || '/operations',
    tag: `ops-booking-${booking.id}-${key}`,
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

async function writeInbox(db, userIds, { kind, title, body, url, tag }) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return { inserted: 0 }
  const rows = ids.map((user_id) => ({ user_id, kind, title, body, url, tag }))
  const { error } = await db.from('user_notifications').insert(rows)
  return error ? { error: error.message } : { inserted: rows.length }
}

export async function isSmsNotificationsEnabled(db = admin()) {
  const { data } = await db.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
  return smsNotificationsEnabledFromSetting(data?.value)
}

/**
 * After booking create/status change: SMS + customer inbox/push + ops inbox/push.
 */
export async function notifyBookingStatus(booking, status = booking?.status) {
  const db = admin()
  const hydrated = await hydrateBookingForNotify(db, booking)
  let templates = null
  try {
    templates = await loadTemplateMap(db)
  } catch (err) {
    console.warn('[notify] template map failed', err?.message || err)
  }
  const payload = buildBookingNotifyPayload(hydrated, status, templates)
  if (!payload) return { skipped: true }

  const result = { sms: null, inbox: null, push: null, ops: null, smsEnabled: true }

  let customerPrefs = null
  if (payload.userId) {
    const { data: cust } = await db
      .from('customers')
      .select('id, notify_sms, notify_push, is_disabled')
      .eq('id', payload.userId)
      .maybeSingle()
    customerPrefs = cust
  }

  if (customerPrefs && !customerNotifyAllowed(customerPrefs, 'sms') && !customerNotifyAllowed(customerPrefs, 'push')) {
    return { skipped: true, reason: 'customer_disabled_or_muted', sms: null, inbox: null, push: null, ops: null }
  }

  const smsOn = await isSmsNotificationsEnabled(db)
  result.smsEnabled = smsOn

  if (payload.phone && smsOn && customerNotifyAllowed(customerPrefs, 'sms')) {
    let userSmsOk = true
    if (payload.userId) {
      const { data: authUser, error: authErr } = await db.auth.admin.getUserById(payload.userId)
      if (!authErr && authUser?.user?.user_metadata?.sms_opt_in === false) userSmsOk = false
    }

    if (userSmsOk) {
      const sms = await busybeeSendSms({ phone: payload.phone, message: payload.sms })
      result.sms = sms
      await logSmsEvent(db, {
        phone: payload.phone,
        message: payload.sms,
        eventType: payload.kind,
        bookingId: hydrated.id,
        customerId: payload.userId,
        status: sms.status,
        providerResponse: sms.providerResponse,
      })
    } else {
      result.sms = { ok: false, status: 'opted_out', providerResponse: 'user_metadata.sms_opt_in=false' }
      await logSmsEvent(db, {
        phone: payload.phone,
        message: payload.sms,
        eventType: payload.kind,
        bookingId: hydrated.id,
        customerId: payload.userId,
        status: 'opted_out',
        providerResponse: 'user_metadata.sms_opt_in=false',
      })
    }
  } else if (payload.phone && customerPrefs && !customerNotifyAllowed(customerPrefs, 'sms')) {
    result.sms = { ok: false, status: 'muted', providerResponse: 'customers.notify_sms=false or is_disabled' }
  } else if (payload.phone && !smsOn) {
    result.sms = { ok: false, status: 'disabled', providerResponse: 'SMS notifications toggled off by admin' }
    await logSmsEvent(db, {
      phone: payload.phone,
      message: payload.sms,
      eventType: payload.kind,
      bookingId: hydrated.id,
      customerId: payload.userId,
      status: 'disabled',
      providerResponse: 'sms_notifications.enabled=false',
    })
  }

  if (payload.userId && customerNotifyAllowed(customerPrefs, 'push')) {
    result.inbox = await writeInbox(db, [payload.userId], payload)
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
  } else if (payload.userId) {
    result.push = { ok: false, status: 'muted', providerResponse: 'customers.notify_push=false or is_disabled' }
  }

  const opsCopy = buildOpsNotifyCopy(hydrated, status, templates)
  if (opsCopy) {
    try {
      const opsIds = await resolvePushTargets(buildOpsPushTargets(hydrated))
      const withoutCustomer = opsIds.filter((id) => id !== payload.userId)
      result.ops = {
        targets: withoutCustomer.length,
        inbox: await writeInbox(db, withoutCustomer, opsCopy),
      }
      if (withoutCustomer.length) {
        result.ops.push = await sendWebPushToUsers({
          userIds: withoutCustomer,
          title: opsCopy.title,
          body: opsCopy.body,
          url: opsCopy.url,
          tag: opsCopy.tag,
          kind: opsCopy.kind,
        })
      } else {
        result.ops.push = { sent: 0, pruned: 0, subscriptions: 0 }
      }
    } catch (err) {
      result.ops = { error: String(err.message || err) }
    }
  }

  // On Successful Release: Ceramic/PPF enroll or Paint Maintenance resets the 6-mo clock (deduped).
  if (status === 'completed') {
    try {
      await seedMaintenanceReminder(db, hydrated)
    } catch (err) {
      console.warn('[notify] maintenance seed failed', err?.message || err)
    }
  }

  return result
}

/** @deprecated name kept for tests — delegates to paint-maintenance program module. */
export async function seedMaintenanceReminder(db, booking) {
  return applyPaintMaintenanceOnComplete(db, booking)
}

/** Customer push + SMS when progress photos land on a visit. */
export async function notifyBookingPhotosReady(booking) {
  return notifyBookingStatus(booking, 'photos_ready')
}
