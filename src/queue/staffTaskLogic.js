/**
 * Staff My Tasks — only allow safe status transitions (never booking_id/staff_id/card_id).
 */

const ASSIGNMENT_TRANSITIONS = {
  pending: new Set(['active']),
  active: new Set(['released']),
}

const PLAN_TRANSITIONS = {
  todo: new Set(['in_progress']),
  in_progress: new Set(['for_review', 'done']),
  for_review: new Set(['done']),
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
 * @param {{ status?: string, card_id?: string, staff_id?: string, proof_url?: string, proof_required?: boolean }} current
 * @param {{ status?: string, card_id?: string, staff_id?: string, proof_url?: string, proof_note?: string }} next
 * @param {{ proofRequired?: boolean }} [opts]
 */
export function allowedStaffPlanAssigneePatch(current, next, opts = {}) {
  if (!current || !next) return null
  if (next.card_id != null && next.card_id !== current.card_id) return null
  if (next.staff_id != null && next.staff_id !== current.staff_id) return null

  const from = String(current.status || '')
  const to = String(next.status || '')
  if (!PLAN_TRANSITIONS[from]?.has(to)) return null

  const proofRequired = Boolean(opts.proofRequired ?? current.proof_required)
  const proofUrl = next.proof_url || current.proof_url || null
  if ((to === 'for_review' || to === 'done') && proofRequired && !String(proofUrl || '').trim()) {
    return null
  }

  const patch = { status: to, updated_at: new Date().toISOString() }
  if (to === 'for_review') {
    patch.proof_url = proofUrl
    patch.proof_note = next.proof_note ?? null
    patch.proof_submitted_at = new Date().toISOString()
  }
  if (to === 'done' && proofRequired) {
    patch.proof_url = proofUrl
    if (next.proof_note != null) patch.proof_note = next.proof_note
  }
  return patch
}
