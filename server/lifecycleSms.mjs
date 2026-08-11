/**
 * Customer lifecycle SMS (BusyBee): welcome/download-app, loyalty claim thanks,
 * and visit milestones (4th = "2 away from freshener/coffee", 10th = back to zero
 * / free premium wax). All sends respect the global sms_notifications toggle and
 * per-user sms_opt_in, and are idempotent via sms_events (event_type + customer).
 */
import { createClient } from '@supabase/supabase-js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { busybeeSendSms } from './busybee.mjs'
import { isSmsNotificationsEnabled } from './notifyBooking.mjs'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'

export function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const LIFECYCLE_KINDS = ['welcome_app', 'loyalty_claim', 'visit_milestone_4', 'visit_milestone_10']

export function buildLifecycleSms(kind, { appUrl = '', name = '', templates = null } = {}) {
  const url = String(appUrl || '').trim()
  const tpl = templates?.[`lifecycle.${kind}`]
  if (tpl?.sms_body) {
    return applyTemplateText(tpl.sms_body, { appUrl: url || 'hakumautocare.com', name: name || 'there' })
  }
  switch (kind) {
    case 'welcome_app':
      return (
        'Welcome to Hakum Auto Care! Thank you for joining us. '
        + `Download our app${url ? ` at ${url}` : ''} to book visits, track your car live, and earn loyalty rewards. `
        + 'Enjoy the full Hakum experience!'
      )
    case 'loyalty_claim':
      return 'Hakum Auto Care: Thank you for claiming your loyalty reward! Keep those visits coming, your next treat is already on the way.'
    case 'visit_milestone_4':
      return "Hakum Auto Care: That's your 4th completed visit! You're only 2 visits away from a free car freshener or coffee on us."
    case 'visit_milestone_10':
      return 'Hakum Auto Care: 10 visits, amazing! Your loyalty card is back to zero. Claim your free premium wax on your next visit. Thank you!'
    default:
      return null
  }
}

/**
 * Visit milestone for a completed-visit count. A visit = one queue trip
 * (multi-service lines share a visit_group_id and count once).
 * Milestones repeat every 10-visit loyalty cycle.
 */
export function resolveVisitMilestone(completedVisits) {
  const visits = Number(completedVisits)
  if (!Number.isInteger(visits) || visits <= 0) return null
  const inCycle = visits % 10
  const cycle = Math.floor((visits - 1) / 10)
  if (inCycle === 4) return { kind: 'visit_milestone_4', cycle, dedupeKey: `visit_milestone_4_c${cycle}` }
  if (inCycle === 0) return { kind: 'visit_milestone_10', cycle, dedupeKey: `visit_milestone_10_c${cycle}` }
  return null
}

/** Count completed visits (distinct visit groups) for a customer. */
export async function countCompletedVisits(db, customerId) {
  // ponytail: client-side distinct, capped at 2000 rows — plenty for a loyalty card.
  const { data, error } = await db
    .from('bookings')
    .select('id, visit_group_id')
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .eq('is_archived', false)
    .limit(2000)
  if (error) throw new Error(error.message)
  const visits = new Set()
  for (const row of data || []) visits.add(row.visit_group_id || row.id)
  return visits.size
}

async function alreadySent(db, { customerId, eventType }) {
  const { data } = await db
    .from('sms_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('event_type', eventType)
    .eq('status', 'sent')
    .limit(1)
  return Boolean(data?.length)
}

async function logEvent(db, { phone, message, eventType, bookingId, customerId, status, providerResponse }) {
  await db.from('sms_events').insert({
    phone,
    message,
    event_type: eventType,
    booking_id: bookingId || null,
    customer_id: customerId || null,
    provider: 'busybee',
    status,
    provider_response: providerResponse || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  })
}

async function userOptedOut(db, customerId) {
  if (!customerId) return false
  const { data, error } = await db.auth.admin.getUserById(customerId)
  return !error && data?.user?.user_metadata?.sms_opt_in === false
}

/**
 * Idempotent lifecycle send. eventType doubles as the dedupe key
 * (pass resolveVisitMilestone().dedupeKey for milestones so each 10-visit
 * cycle re-arms).
 */
export async function sendLifecycleSms(db, { kind, eventType = kind, customerId, phone, bookingId = null, appUrl = '', name = '' }) {
  let templates = null
  try {
    templates = await loadTemplateMap(db)
  } catch {
    templates = null
  }
  if (templates && !templateEnabled(templates, `lifecycle.${kind}`)) {
    return { ok: false, status: 'disabled' }
  }
  const message = buildLifecycleSms(kind, { appUrl, name, templates })
  if (!message) return { ok: false, status: 'unknown_kind' }
  if (!customerId) return { ok: false, status: 'missing_customer' }

  let target = String(phone || '').trim()
  if (!target) {
    const { data: customer } = await db
      .from('customers')
      .select('phone')
      .eq('id', customerId)
      .maybeSingle()
    target = String(customer?.phone || '').trim()
  }
  if (!target) return { ok: false, status: 'missing_phone' }

  if (await alreadySent(db, { customerId, eventType })) {
    return { ok: true, status: 'duplicate', skipped: true }
  }

  if (!(await isSmsNotificationsEnabled(db))) {
    await logEvent(db, {
      phone: target, message, eventType, bookingId, customerId,
      status: 'disabled', providerResponse: 'sms_notifications.enabled=false',
    })
    return { ok: false, status: 'disabled' }
  }

  if (await userOptedOut(db, customerId)) {
    await logEvent(db, {
      phone: target, message, eventType, bookingId, customerId,
      status: 'opted_out', providerResponse: 'user_metadata.sms_opt_in=false',
    })
    return { ok: false, status: 'opted_out' }
  }

  const sms = await busybeeSendSms({ phone: target, message })
  await logEvent(db, {
    phone: target, message, eventType, bookingId, customerId,
    status: sms.status, providerResponse: sms.providerResponse,
  })
  return sms
}

/** After a visit completes: fire the 4th / 10th milestone SMS when reached. */
export async function runVisitMilestoneSms(db, booking) {
  const customerId = booking?.customer_id
  if (!customerId) return { skipped: true, reason: 'no_customer' }
  const visits = await countCompletedVisits(db, customerId)
  const milestone = resolveVisitMilestone(visits)
  if (!milestone) return { skipped: true, visits }
  const result = await sendLifecycleSms(db, {
    kind: milestone.kind,
    eventType: milestone.dedupeKey,
    customerId,
    phone: booking.customer_phone || '',
    bookingId: booking.id || null,
  })
  return { visits, milestone: milestone.kind, result }
}
