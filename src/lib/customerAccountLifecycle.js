/**
 * Customer account lifecycle: Team Lead unactivated visit → activate,
 * or brand-new signup. Interface is the test surface for sign-in + signup.
 */

export const ACCOUNT_STATUSES = Object.freeze(['unknown', 'needs_invite', 'needs_password', 'ready'])

/**
 * What the shop / Auth pair means.
 * attach_auth = CRM walk-in, no Auth user yet
 * activate    = Auth exists, must_set_password
 * exists      = already usable
 * create      = no CRM row
 */
export function resolveClaimPath({ customer, authUser } = {}) {
  if (!customer) return 'create'
  if (!authUser) return 'attach_auth'
  if (authUser.user_metadata?.must_set_password) return 'activate'
  return 'exists'
}

/**
 * Next UI/API move for a looked-up phone/plate/email.
 * @param {{ status?: string, passwordProvided?: boolean, flow: 'signin' | 'signup' }} args
 */
export function resolveCustomerAuthIntent({ status, passwordProvided = false, flow = 'signin' } = {}) {
  const st = status || 'unknown'

  if (flow === 'signup') {
    if (st === 'ready') return { action: 'block_exists', message: 'This phone already has a Hakum account. Sign in instead.' }
    if (st === 'needs_password' || st === 'needs_invite') {
      return {
        action: 'activate',
        message: 'Your Team Lead already saved your visit. Finish setup to open your history.',
      }
    }
    return { action: 'create' }
  }

  // signin
  if (st === 'needs_password' || st === 'needs_invite') {
    return {
      action: 'activate',
      message: 'Your Team Lead already saved your visit. Activate your account to see your history.',
    }
  }
  if (st === 'ready') {
    return passwordProvided
      ? { action: 'signin' }
      : { action: 'need_password', message: 'Enter your password to continue.' }
  }
  if (passwordProvided) return { action: 'signin' }
  return {
    action: 'offer_signup',
    message: 'No Hakum account for that number yet. Create one to track visits.',
  }
}

export function activateSignupHref(identifier) {
  const raw = String(identifier || '').trim()
  if (!raw) return '/signup'
  return `/signup?phone=${encodeURIComponent(raw)}`
}
