/**
 * Customer lifecycle SMS (BusyBee): welcome, loyalty thanks, visit rewards
 * at 6, 12, 18, 24, and 30 completed visits, and a rate-your-visit text.
 * Sends respect the shop SMS toggle and sms_opt_in, and are idempotent via sms_events.
 */
import { createClient } from '@supabase/supabase-js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { VISIT_REWARDS } from '../src/lib/rewardsCatalog.js'
import { busybeeSendSms } from './busybee.mjs'
import { isSmsNotificationsEnabled } from './notifyBooking.mjs'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'

export function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const LIFECYCLE_KINDS = [
  'welcome_app',
  'loyalty_claim',
  ...VISIT_REWARDS.map((row) => `visit_reward_${row.visit}`),
  'rate_visit',
  'self_test',
]

export function buildLifecycleSms(kind, { appUrl = '', name = '', templates = null } = {}) {
  const url = String(appUrl || '').trim()
  const tpl = templates?.[`lifecycle.${kind}`]
  if (tpl?.sms_body) {
    return applyTemplateText(tpl.sms_body, { appUrl: url || 'hakumautocare.com', name: name || 'there' })
  }
  const rewardVisit = /^visit_reward_(\d+)$/.exec(kind)
  if (rewardVisit) {
    const reward = VISIT_REWARDS.find((row) => row.visit === Number(rewardVisit[1]))
    if (!reward) return null
    return `Hakum Auto Care: That's visit ${reward.visit}. Your reward is ready: ${reward.label}. Ask the branch.`
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
    case 'rate_visit':
      return (
        'Hakum Auto Care: How was your visit? Open your account'
        + `${url ? ` (${url}/account)` : ''}`
        + ' to rate it — thumbs up or tell us what went wrong.'
      )
    case 'self_test':
      return 'Hakum Auto Care: Test alert for this number. Visit updates will arrive here when SMS is on.'
    default:
      return null
  }
}

/**
 * One text per reward visit. Counts are lifetime completed visits, any car.
 */
export function resolveVisitMilestone(completedVisits) {
  const visits = Number(completedVisits)
  if (!Number.isInteger(visits) || visits <= 0) return null
  const reward = VISIT_REWARDS.find((row) => row.visit === visits)
  if (!reward) return null
  return { kind: `visit_reward_${reward.visit}`, dedupeKey: `visit_reward_${reward.visit}` }
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
export async function sendLifecycleSms(db, { kind, eventType = kind, customerId, phone, bookingId = null, appUrl = '', name = '', ignoreShopToggle = false } = {}) {
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

  if (!ignoreShopToggle && !(await isSmsNotificationsEnabled(db))) {
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
  return {
    ...sms,
    errorKind: sms.errorKind || null,
    errorCode: sms.errorCode ?? null,
  }
}

/** After a visit completes: text the customer when a visit reward is reached. */
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
