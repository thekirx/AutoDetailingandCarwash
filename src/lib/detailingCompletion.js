/**
 * Owner Revisions P2 — detailing completion outcome, Experience tickets, calendar colors, update photos.
 */
import { isBookingBoardService } from './serviceKinds.js'
import { EXPERIENCE_LIST_TITLE } from './plannerBoard.js'

export const COMPLETION_OUTCOMES = Object.freeze([
  { id: 'no_issues', label: 'Completed with no issues' },
  { id: 'complaints_addressed', label: 'Completed with complaints (addressed)' },
  { id: 'unhappy', label: 'Completed — customer not happy' },
])

export const COMPLETION_OUTCOME_IDS = Object.freeze(COMPLETION_OUTCOMES.map((o) => o.id))

/** Outcomes 2–3 open an Experience investigation card. */
export const EXPERIENCE_TICKET_OUTCOMES = Object.freeze(['complaints_addressed', 'unhappy'])

export { EXPERIENCE_LIST_TITLE }

export function isDetailingFamilyBooking(booking = {}) {
  const svc = booking?.services || {}
  return isBookingBoardService({
    slug: svc.slug || booking?.service_slug,
    pay_category: svc.pay_category || booking?.service_pay_category || booking?.pay_category,
  })
}

export function normalizeCompletionOutcome(raw) {
  const key = String(raw || '').trim().toLowerCase()
  return COMPLETION_OUTCOME_IDS.includes(key) ? key : null
}

/**
 * Completing a detailing-family booking requires a completion_outcome.
 * Returns { ok: true, outcome } or { ok: false, error }.
 */
export function assertDetailingCompletionOutcome(booking, outcomeRaw, { nextStatus } = {}) {
  if (String(nextStatus || '') !== 'completed') return { ok: true, outcome: null }
  if (!isDetailingFamilyBooking(booking)) return { ok: true, outcome: null }
  const outcome = normalizeCompletionOutcome(outcomeRaw)
  if (!outcome) {
    return { ok: false, error: 'Pick a completion outcome before marking detailing complete.' }
  }
  return { ok: true, outcome }
}

export function shouldCreateExperiencePlanCard(outcome) {
  return EXPERIENCE_TICKET_OUTCOMES.includes(normalizeCompletionOutcome(outcome))
}

export function buildExperiencePlanCardPayload({ booking, outcome, listId, position = 0, createdBy = null }) {
  const plate = booking?.vehicle_plate || 'vehicle'
  const branch = booking?.branch || 'branch'
  const label = COMPLETION_OUTCOMES.find((o) => o.id === outcome)?.label || outcome
  return {
    list_id: listId,
    title: `Experience · ${plate} @ ${branch}`,
    description: [
      `Investigation after detailing completion (${label}).`,
      `Booking: ${booking?.id || '—'}`,
      `Customer: ${booking?.customer_name || '—'} · ${booking?.customer_phone || '—'}`,
      `Service: ${booking?.services?.name || booking?.service_name || '—'}`,
      'Review what happened and how the experience can improve.',
    ].join('\n'),
    position,
    created_by: createdBy,
    labels: [{ name: 'Experience', color: '#c4a35a' }],
  }
}

/** Private bucket object path: booking-updates/{bookingId}/{ts}-{safeName} */
export function bookingUpdateObjectPath(bookingId, fileName, now = Date.now()) {
  const id = String(bookingId || '').trim()
  if (!id) return ''
  const safe = String(fileName || 'update').replace(/[^\w.-]+/g, '_')
  return `${id}/${now}-${safe}`
}

export function isBookingUpdatesStoragePath(value) {
  const v = String(value || '')
  return Boolean(v) && !/^https?:\/\//i.test(v) && !v.includes('..')
}

/** Calendar colors by pay_category / detailing slug — sales can scan the week at a glance. */
export function bookingCalendarStyle(booking = {}) {
  const cat = String(booking?.services?.pay_category || booking?.service_pay_category || booking?.pay_category || '')
    .trim()
    .toLowerCase()
  const slug = String(booking?.services?.slug || booking?.service_slug || '')
    .trim()
    .toLowerCase()

  if (slug.includes('ppf') || slug.includes('paint-protection') || cat === 'ppf') {
    return { backgroundColor: '#7c3aed', borderColor: '#6d28d9', color: '#fff' }
  }
  if (slug.includes('tint') || slug.includes('nano')) {
    return { backgroundColor: '#0ea5e9', borderColor: '#0284c7', color: '#fff' }
  }
  if (slug.includes('paint-maint') || slug.includes('maintenance')) {
    return { backgroundColor: '#059669', borderColor: '#047857', color: '#fff' }
  }
  if (slug.includes('ceramic') || cat === 'detailing') {
    return { backgroundColor: '#052699', borderColor: '#020a31', color: '#fff' }
  }
  if (cat === 'wash' || cat === 'general') {
    return { backgroundColor: '#334155', borderColor: '#1e293b', color: '#fff' }
  }
  return { backgroundColor: '#64748b', borderColor: '#475569', color: '#fff' }
}

export function bookingCalendarEventPropGetter(event) {
  const booking = event?.resource || event
  return { style: bookingCalendarStyle(booking) }
}

/** Title includes branch chip text for the calendar event. */
export function bookingCalendarEventTitle(booking = {}) {
  const branch = String(booking.branch || '').trim() || '—'
  const plate = booking.vehicle_plate || booking.customer_name || 'Booking'
  const svc = booking.services?.name || booking.service_name || ''
  return svc ? `[${branch}] ${plate} · ${svc}` : `[${branch}] ${plate}`
}
