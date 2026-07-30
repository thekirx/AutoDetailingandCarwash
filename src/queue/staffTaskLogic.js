/**
 * Staff My Tasks — only allow safe status transitions (never booking_id/staff_id/card_id).
 */

const ASSIGNMENT_TRANSITIONS = {
  pending: new Set(['active']),
  active: new Set(['released']),
}

const PLAN_TRANSITIONS = {
  todo: new Set(['in_progress']),
  in_progress: new Set(['done']),
}

/**
 * @param {{ status?: string, booking_id?: string, staff_id?: string }} current
 * @param {{ status?: string, booking_id?: string, staff_id?: string, started_at?: string, released_at?: string }} next
 * @returns {null | { status: string, started_at?: string, released_at?: string }}
 */
export function allowedStaffAssignmentPatch(current, next) {
  if (!current || !next) return null
  if (next.booking_id != null && next.booking_id !== current.booking_id) return null
  if (next.staff_id != null && next.staff_id !== current.staff_id) return null

  const from = String(current.status || '')
  const to = String(next.status || '')
  if (!ASSIGNMENT_TRANSITIONS[from]?.has(to)) return null

  if (to === 'active') {
    return { status: 'active', started_at: next.started_at || current.started_at || new Date().toISOString() }
  }
  return { status: 'released', released_at: next.released_at || new Date().toISOString() }
}

/**
 * @param {{ status?: string, card_id?: string, staff_id?: string }} current
 * @param {{ status?: string, card_id?: string, staff_id?: string }} next
 */
export function allowedStaffPlanAssigneePatch(current, next) {
  if (!current || !next) return null
  if (next.card_id != null && next.card_id !== current.card_id) return null
  if (next.staff_id != null && next.staff_id !== current.staff_id) return null

  const from = String(current.status || '')
  const to = String(next.status || '')
  if (!PLAN_TRANSITIONS[from]?.has(to)) return null
  return { status: to, updated_at: new Date().toISOString() }
}
