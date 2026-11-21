/**
 * Customer lifecycle message builders and milestone helpers.
 * Note: BusyBee SMS is now strictly limited to booking status updates for Detailing,
 * Services, and Packages — lifecycle SMS dispatch stays disabled here.
 */
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { VISIT_REWARDS } from '../src/lib/rewardsCatalog.js'
import { adminClient as adminDb } from './supabaseAdmin.mjs'

export { adminDb }

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

export async function sendLifecycleSms() {
  return {
    ok: false,
    status: 'skipped',
    reason: 'status_sms_only',
    providerResponse: 'SMS is restricted to Detailing, Services & Packages booking status updates.',
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
