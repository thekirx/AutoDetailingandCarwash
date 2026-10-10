/**
 * Session helpers for Supabase Auth (SPA).
 * ponytail: one in-flight refresh — parallel getAccessTokenFresh() otherwise races refresh_token reuse.
 */

/** @param {{ expires_at?: number } | null | undefined} session */
export function sessionExpiresAtMs(session) {
  if (!session?.expires_at) return 0
  return session.expires_at * 1000
}

/** True when access token is missing or expires within `skewMs` (default 60s). */
export function needsRefresh(session, nowMs = Date.now(), skewMs = 60_000) {
  if (!session?.access_token) return true
  const exp = sessionExpiresAtMs(session)
  if (!exp) return false
  return exp < nowMs + skewMs
}

/** @param {{ expires_at?: number } | null | undefined} session */
export function isSessionExpired(session, nowMs = Date.now()) {
  if (!session?.access_token) return true
  const exp = sessionExpiresAtMs(session)
  if (!exp) return false
  return exp <= nowMs
}

let refreshPromise = null

/**
 * Single-flight refresh. Safe to call from many /api callers at once.
 * @param {{ getSession: Function, refreshSession: Function }} auth
 */
export async function refreshSessionSingleFlight(auth) {
  if (refreshPromise) return refreshPromise
  refreshPromise = Promise.resolve()
    .then(async () => {
      const { data, error } = await auth.refreshSession()
      if (error) throw error
      return data.session || null
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

/**
 * Return a usable access_token, refreshing when near expiry.
 * @param {{ getSession: Function, refreshSession: Function }} auth
 */
export async function ensureFreshAccessToken(auth, skewMs = 60_000) {
  const { data, error } = await auth.getSession()
  if (error) throw error
  const session = data.session
  if (!needsRefresh(session, Date.now(), skewMs)) {
    return session.access_token
  }
  const next = await refreshSessionSingleFlight(auth)
  // BUG-084: this used to be `next?.access_token || session?.access_token || null`,
  // which handed back the old token whenever a refresh produced nothing — even
  // though needsRefresh() had just said it is expiring, and even when it was
  // already past `exp`. That token goes on the wire and 45 of the 56
  // authenticated /api/* fetches in the app route through here, so the caller's
  // only outcome is a 401 it cannot retry past.
  //
  // Gated on isSessionExpired, not needsRefresh: a token 30s from expiry is
  // still usable, and discarding it would break every call made in the last
  // minute of a session's life.
  if (next?.access_token) return next.access_token
  if (session?.access_token && !isSessionExpired(session)) return session.access_token
  return null
}

/** Auth events that should reload profile (not TOKEN_REFRESHED — avoids UI flicker). */
export function shouldReloadProfile(event) {
  return event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY'
}
