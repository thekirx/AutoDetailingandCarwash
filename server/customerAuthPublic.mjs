/**
 * Strict auth lookup anti-leak payload (CUST-H1 / 2026-11-21 hardening).
 * Never echoes login_email, full_name, phone, plate, or DOB to unauthenticated callers:
 * - Customer sign-in sends identifier + password directly to POST action:'signin'.
 * - Password reset sends identifier directly to POST action:'send_reset'/'send_setup'.
 * Only status, kind, can_email_reset boolean, and source:'team_lead' are returned.
 */
export function publicAuthLookupPayload(result) {
  const status = result?.status || 'unknown'
  const kind = result?.kind || 'unknown'
  const out = {
    status,
    kind,
    can_email_reset: Boolean(result?.can_email_reset),
  }
  if (status === 'needs_password' || status === 'needs_invite') {
    out.source = 'team_lead'
  }
  return out
}
