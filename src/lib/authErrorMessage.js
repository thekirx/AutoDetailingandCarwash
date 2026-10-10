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