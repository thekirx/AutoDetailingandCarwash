import { publicOnboardingPrefill } from '../src/lib/customerOnboarding.js'

/**
 * Auth lookup public payload (CUST-H1).
 * Email/phone clients compute login email locally — never echo it (enumeration).
 * Plate sign-in still needs the server-resolved login email.
 * Prefill only for Team Lead accounts that have not finished first login.
 */
export function publicAuthLookupPayload(result) {
  const status = result?.status || 'unknown'
  const kind = result?.kind || 'unknown'
  const out = { status, kind }
  if (
    kind === 'plate' &&
    result?.login_email &&
    (status === 'ready' || status === 'needs_password')
  ) {
    out.login_email = result.login_email
  }
  if ((status === 'needs_password' || status === 'needs_invite') && result?.prefill) {
    out.prefill = publicOnboardingPrefill(result.prefill)
    out.source = 'team_lead'
  }
  return out
}
