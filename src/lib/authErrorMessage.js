/**
 * Honest sign-in failure messages.
 *
 * The login page used to answer every auth error with "Invalid email or password."
 * — including a 429 rate limit, a 5xx from the auth service, and a plain network
 * failure. That is actively harmful on a shop floor: a Branch Admin whose sign-in
 * failed because the server hiccupped is told their password is wrong, retries,
 * hammers the auth endpoint, and escalates to the owner over a non-problem. The
 * only thing the user can act on is the distinction, so make it.
 *
 * Pure and dependency-free so the mapping can be tested directly. Supabase error
 * shapes vary by version, so every branch falls back to the status/code and finally
 * to a neutral message rather than asserting on wording.
 */

/** True when the failure was the server or the network, not the credentials. */
export function isTransientAuthFailure(err) {
  if (!err) return false
  const status = Number(err.status || 0)
  if (status === 429 || status >= 500) return true
  const message = String(err.message || '').toLowerCase()
  if (/too many|rate limit|over_request|fetch failed|network|failed to fetch|timeout|timed out|econnrefused|socket hang up/.test(message)) {
    return true
  }
  return false
}

/**
 * A message the user can act on. Never blames their password unless the server
 * actually said the credentials were wrong.
 */
export function describeAuthError(err) {
  if (!err) return "We couldn't sign you in. Please try again."

  const status = Number(err.status || 0)
  const message = String(err.message || '').toLowerCase()

  if (status === 429 || /too many|rate limit|over_request/.test(message)) {
    return 'Too many sign-in attempts. Wait a minute, then try again.'
  }

  // The network never reached the server, so nothing is known about the password.
  if (/fetch failed|network|failed to fetch|timeout|timed out|econnrefused|socket hang up/.test(message)) {
    return "Can't reach the sign-in server. Check your connection and try again."
  }

  if (/email not confirmed/.test(message)) {
    return 'This account has not been confirmed yet. Ask a Super Admin to activate it.'
  }

  // Server-side failure: saying "invalid password" here is a guess, and a wrong one.
  if (status >= 500) {
    return 'The sign-in service is having trouble. Try again in a moment.'
  }

  if (status === 400 || /invalid login credentials|invalid email|wrong password/.test(message)) {
    return 'Invalid email or password.'
  }

  return 'Sign-in failed. Please try again.'
}

/**
 * Classify a failure from the customer sign-in path (`/api/customer-auth-lookup`).
 *
 * The staff path above gets the error object back from Supabase directly. The
 * customer path goes through our own endpoint, so all it has is an HTTP status and
 * a parsed body — and the parsed body is `{}` whenever the response is not JSON,
 * which is precisely when the server is on fire. Discarding the status there turns
 * every server fault into a verdict on the customer's password.
 *
 * The status is trustworthy because the server maintains it honestly:
 * `server/customerSignIn.mjs` returns 401 only when Auth actually rejected the
 * credentials, `rateLimit()` is the only source of 429, and 500 means something
 * threw. So: classify on the status, and keep the server's wording only where it
 * deliberately sent one — never as a catch-all.
 *
 * A 5xx deliberately drops `data.error`. `handleCustomerAuthLookupRequest`
 * rethrows `err.message` verbatim, which can be
 * "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY". That is our infrastructure
 * and it does not belong on a customer screen.
 */
export function describeCustomerAuthFailure({ status, data } = {}) {
  const code = Number(status || 0)
  const serverMessage = typeof data?.error === 'string' ? data.error.trim() : ''

  if (code === 429 || (!code && /too many|rate limit|over_request/i.test(serverMessage))) {
    return 'Too many sign-in attempts. Wait a minute, then try again.'
  }

  if (code >= 500) {
    return 'The sign-in service is having trouble. Try again in a moment.'
  }

  if (code === 401) {
    // The server reserves 401 for a genuine credentials rejection.
    return serverMessage || 'Invalid phone or password.'
  }

  // 400 carries setup guidance; 404/409 carry activate / offer-signup. Both are
  // the server's own words and paraphrasing them would lose the next step.
  if (code === 400 || code === 404 || code === 409) {
    return serverMessage || 'Sign-in failed. Please check your details and try again.'
  }

  if (serverMessage) return serverMessage

  // No status and no message means we never got an answer. Nothing is known about
  // the password, so nothing may claim otherwise.
  return "We couldn't sign you in. Please try again."
}