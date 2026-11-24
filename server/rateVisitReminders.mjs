/**
 * Post-visit review nudge delivered via In-App Inbox + Web Push (configurable delay & window).
 * BusyBee SMS remains reserved strictly for Detailing, Services & Packages status updates.
 * Idempotent per booking via user_notifications.tag = `rate-visit:${bookingId}`.
 */
import { REVIEW_DELAY_MS } from '../src/lib/visitReviewDelay.js'
import { isWithinQuietHours } from '../src/lib/notificationConfig.js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { loadNotificationConfig } from './notificationConfigApi.mjs'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'
import { deliverUserNotifications, sendWebPushToUsers } from './webPush.mjs'

const WINDOW_MS = 6 * 60 * 60 * 1000 // don't nag visits older than default 6h window

export function rateVisitEligible({
  finishedAtMs,
  nowMs = Date.now(),
  delayMs = REVIEW_DELAY_MS,
  windowMs = WINDOW_MS,
} = {}) {
  const finish = Number(finishedAtMs)
  if (!Number.isFinite(finish)) return false
  const age = nowMs - finish
  return age >= delayMs && age <= windowMs
}

function finishedMs(row) {
  const pay = row?.for_payment_at ? new Date(row.for_payment_at).getTime() : NaN
  if (Number.isFinite(pay)) return pay
  const done = row?.completed_at ? new Date(row.completed_at).getTime() : NaN
  return Number.isFinite(done) ? done : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ appUrl?: string, nowMs?: number, limit?: number }} [opts]
 */
export async function runRateVisitReminders(db, { appUrl = '', nowMs = Date.now(), limit = 40 } = {}) {
  const config = await loadNotificationConfig(db)
  if (config.rate_visit_enabled === false) {
    return { ok: true, skipped: true, reason: 'disabled_by_admin', scanned: 0, eligible: 0, sent: 0, skippedRows: [] }
  }
  if (isWithinQuietHours(config, new Date(nowMs))) {
    return { ok: true, skipped: true, reason: 'quiet_hours', scanned: 0, eligible: 0, sent: 0, skippedRows: [] }
  }

  const delayMinutes = Number(config.rate_visit_delay_minutes) || 15
  const windowHours = Number(config.rate_visit_window_hours) || 6
  const delayMs = delayMinutes * 60 * 1000
  const windowMs = windowHours * 60 * 60 * 1000

  const sinceIso = new Date(nowMs - windowMs).toISOString()
  const { data: rows, error } = await db
    .from('bookings')
    .select(
      'id, customer_id, customer_name, vehicle_plate, status, completed_at, for_payment_at, customers!bookings_customer_id_fkey(full_name)',
    )
    .eq('status', 'completed')
    .eq('is_archived', false)
    .not('customer_id', 'is', null)
    .gte('completed_at', sinceIso)
    .order('completed_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)

  const candidates = []
  for (const row of rows || []) {
    const ms = finishedMs(row)
    if (!rateVisitEligible({ finishedAtMs: ms, nowMs, delayMs, windowMs })) continue
    candidates.push(row)
    if (candidates.length >= limit) break
  }

  if (!candidates.length) {
    return { ok: true, scanned: (rows || []).length, eligible: 0, sent: 0, skipped: [] }
  }

  const templates = await loadTemplateMap(db).catch(() => ({}))
  if (!templateEnabled(templates, 'lifecycle.rate_visit')) {
    return { ok: true, scanned: (rows || []).length, eligible: candidates.length, sent: 0, skipped: [], reason: 'template_disabled' }
  }
  const tpl = templates['lifecycle.rate_visit']

  // Batch check existing tags to avoid N+1 SELECTs.
  const tags = candidates.map((row) => `rate-visit:${row.id}`)
  const { data: existingNotes } = await db
    .from('user_notifications')
    .select('tag')
    .in('tag', tags)
  const priorTags = new Set((existingNotes || []).map((n) => n.tag))

  const sent = []
  const skipped = []
  const cleanUrl = String(appUrl || '').replace(/\/$/, '')
  for (const row of candidates) {
    const tag = `rate-visit:${row.id}`
    if (priorTags.has(tag)) {
      skipped.push({ id: row.id, status: 'already_sent' })
      continue
    }
    const name = row.customers?.full_name || row.customer_name || 'there'
    const plate = row.vehicle_plate || 'your car'
    const vars = { name, plate, appUrl: cleanUrl || 'hakumautocare.com' }
    const title = applyTemplateText(tpl?.title, vars, 'How was your visit at Hakum?')
    const body = applyTemplateText(
      tpl?.body,
      vars,
      `Thanks for trusting Hakum Auto Care${row.vehicle_plate ? ` with ${row.vehicle_plate}` : ''}! Tap to rate your visit in seconds.`,
    )

    const delivery = await deliverUserNotifications(db, {
      userIds: [row.customer_id],
      kind: 'rate_visit',
      title,
      body,
      url: '/account',
      tag,
      inbox: true,
      checkCustomerPrefs: true,
      sendPush: config.push_notifications_enabled !== false ? sendWebPushToUsers : async () => ({ sent: 0, failed: 0 }),
    })

    if (delivery?.skipped) skipped.push({ id: row.id, status: delivery.reason || 'muted' })
    else if (delivery?.inbox?.inserted > 0 || delivery?.push?.sent > 0) sent.push(row.id)
    else skipped.push({ id: row.id, status: 'duplicate_or_noop' })
  }

  return { ok: true, scanned: (rows || []).length, eligible: candidates.length, sent: sent.length, skipped }
}
