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
  return next?.access_token || session?.access_token || null
}

/** Auth events that should reload profile (not TOKEN_REFRESHED — avoids UI flicker). */
export function shouldReloadProfile(event) {
  return event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY'
}
