/**
 * Seam S2 — booking status state machine for /api/booking-status.
 *
 * The service role bypasses `bookings` RLS, so without this the handler would
 * accept any enum-valid status from any current status: `waiting -> completed`
 * skipped Final checking (the QA gate that carries the money handoff), fired an
 * Ops-Lab investigation for work that never happened, and set completed_at,
 * which feeds dwell analytics.
 *
 * Scope note: this is the *detailing board* pipeline, which is wider than the
 * wash-bay queue map in src/queue/queueLogic.js — it must admit `pending` and
 * `confirmed`. `for_releasing` is retired (Final checking goes to For payment);
 * its row stays so legacy bookings can still move on.
 *
 * `for_payment` is deliberately NOT a bare target: reaching it must go through
 * the POS handoff branch in bookingStatus.mjs, and only after Final checking.
 */

/** Cancelling is allowed from any live stage; terminal states are listed too so a same-state no-op is caught upstream. */
export const BOOKING_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'waiting', 'cancelled'],
  confirmed: ['waiting', 'in_progress', 'cancelled'],
  waiting: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['final_checking', 'redo', 'cancelled'],
  final_checking: ['completed', 'cancelled'],
  for_releasing: ['completed', 'cancelled'],
  redo: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

/** Statuses a booking can sit in before any work starts. */
export const BOOKING_STATUS_LIVE = Object.entries(BOOKING_STATUS_TRANSITIONS)
  .filter(([, next]) => next.length > 0)
  .map(([status]) => status)

/**
 * Is `to` a legal successor of `from`?
 *
 * `for_payment` is never a legal *bare* target — POS owns that lane via the
 * dedicated handoff branch, so a direct status write to it must be refused.
 *
 * @param {string|null|undefined} from current booking status
 * @param {string|null|undefined} to requested status
 */
export function canTransitionBookingStatus(from, to) {
  const current = String(from || '')
  const next = String(to || '')
  if (!current || !next) return false
  if (next === 'for_payment') return false
  return (BOOKING_STATUS_TRANSITIONS[current] || []).includes(next)
}

/** Stages a booking may leave for the POS handoff — QA (Final checking) must be done first. */
export const PAYMENT_HANDOFF_FROM = Object.freeze(['final_checking', 'for_releasing'])

export function canHandOffToPayment(from) {
  return PAYMENT_HANDOFF_FROM.includes(String(from || ''))
}

/**
 * Super Admin may correct bad data, so they bypass the ladder. Kept explicit so
 * the exemption is visible at the call site rather than hidden in the map.
 * `for_payment` is admitted only as a handoff after Final checking.
 */
export function transitionAllowedForRole(from, to, role) {
  if (role === 'BossMich') return true
  if (String(to || '') === 'for_payment') return canHandOffToPayment(from)
  return canTransitionBookingStatus(from, to)
}