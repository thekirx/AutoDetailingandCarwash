/**
 * 15 minutes after a wash/detail visit finishes, SMS the customer to rate in the app (Michi C20).
 * Idempotent via sms_events event_type = rate_visit_<bookingId>.
 */
import { REVIEW_DELAY_MS } from '../src/lib/visitReviewDelay.js'
import { sendLifecycleSms } from './lifecycleSms.mjs'

const WINDOW_MS = 6 * 60 * 60 * 1000 // don't nag visits older than 6h

export function rateVisitEligible({ finishedAtMs, nowMs = Date.now() } = {}) {
  const finish = Number(finishedAtMs)
  if (!Number.isFinite(finish)) return false
  const age = nowMs - finish
  return age >= REVIEW_DELAY_MS && age <= WINDOW_MS
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
  const sinceIso = new Date(nowMs - WINDOW_MS).toISOString()
  const { data: rows, error } = await db
    .from('bookings')
    .select(
      'id, customer_id, customer_name, status, completed_at, for_payment_at, customers(phone, full_name)',
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
    if (!rateVisitEligible({ finishedAtMs: ms, nowMs })) continue
    candidates.push(row)
    if (candidates.length >= limit) break
  }

  const sent = []
  const skipped = []
  for (const row of candidates) {
    const phone = String(row.customers?.phone || '').trim()
    const name = row.customers?.full_name || row.customer_name || ''
    const result = await sendLifecycleSms(db, {
      kind: 'rate_visit',
      eventType: `rate_visit_${row.id}`,
      customerId: row.customer_id,
      phone,
      bookingId: row.id,
      appUrl,
      name,
    })
    if (result?.status === 'sent' || (result?.ok && !result?.skipped)) sent.push(row.id)
    else skipped.push({ id: row.id, status: result?.status || 'unknown' })
  }

  return { ok: true, scanned: (rows || []).length, eligible: candidates.length, sent: sent.length, skipped }
}
