import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensureFreshAccessToken } from '../src/lib/session.js'

/**
 * BUG-084 — a refresh that produces nothing hands back an expired token.
 *
 * `ensureFreshAccessToken` ends with:
 *
 *   const next = await refreshSessionSingleFlight(auth)
 *   return next?.access_token || session?.access_token || null
 *
 * The middle clause is the bug. `needsRefresh` was true a line earlier, so the
 * caller already knows this token expires within the 60s skew. If the refresh
 * comes back with no error and no session — which is what Supabase returns when
 * there is no refresh token left to spend — the fallback hands back the old
 * access_token regardless of whether it is already past `exp`.
 *
 * That token goes onto the wire, and 45 of the 56 authenticated `/api/*` fetches
 * in the app go through this helper. So the result is a 401 that no amount of
 * retrying on the caller's side can fix: the token is dead by the time it is
 * read. It is also the shape BUG-067(2) has been chasing — three bare 401s with
 * no route — except that one never reproduced, which is consistent with a race
 * that needs the refresh token to already be spent.
 *
 * `isSessionExpired` sits twenty lines above this function, exported, and is
 * used nowhere in the codebase. The guard was written and never wired in.
 *
 * The fix must NOT be the blunt one. Returning null for any token inside the
 * 60s skew would break calls that are still perfectly valid — case 4 below
 * expires in 30 seconds and is genuinely usable. So the fallback is gated on
 * `isSessionExpired`, not on `needsRefresh`.
 */

/** Build a token that is `seconds` away from now (negative = already past). */
const token = (value, seconds) => ({ access_token: value, expires_at: Date.now() / 1000 + seconds })

const authReturning = (session, refreshResult) => ({
  getSession: async () => ({ data: { session }, error: null }),
  refreshSession: async () => refreshResult,
})

const NOTHING = { data: { session: null }, error: null }

describe('a refresh that yields nothing must not hand back a dead token', () => {
  it('does not return a token that already expired', async () => {
    const got = await ensureFreshAccessToken(
      authReturning(token('STALE', -10), NOTHING),
      60_000,
    )
    assert.notEqual(
      got,
      'STALE',
      'returned a token that expired 10 seconds ago — every /api/* caller will get a 401 with it',
    )
  })

  it('does not return a token that expired a long time ago', async () => {
    const got = await ensureFreshAccessToken(
      authReturning(token('ANCIENT', -3600), NOTHING),
      60_000,
    )
    assert.notEqual(got, 'ANCIENT')
  })

  it('returns null rather than a dead token, so the caller can say "sign in required"', async () => {
    const got = await ensureFreshAccessToken(authReturning(token('STALE', -10), NOTHING), 60_000)
    assert.equal(got, null, 'null is the honest answer and produces an actionable message')
  })
})

describe('the guard is not allowed to be too strict', () => {
  // The blunt fix — treating anything inside the 60s skew as unusable — would
  // break every call made in the last minute of a token's life, which is most
  // of them. These are the cases that must keep working.

  it('still returns a token that expires in 30s when the refresh yields nothing', async () => {
    const got = await ensureFreshAccessToken(authReturning(token('SOON', 30), NOTHING), 60_000)
    assert.equal(got, 'SOON', 'a token 30s from expiry is still usable and must not be discarded')
  })

  it('prefers the freshly refreshed token when there is one', async () => {
    const got = await ensureFreshAccessToken(
      authReturning(token('STALE', -10), {
        data: { session: token('FRESH', 3600) },
        error: null,
      }),
      60_000,
    )
    assert.equal(got, 'FRESH')
  })

  it('does not refresh at all when the token is comfortably valid', async () => {
    let called = false
    const good = token('GOOD', 3600)
    const got = await ensureFreshAccessToken(
      {
        getSession: async () => ({ data: { session: good }, error: null }),
        refreshSession: async () => {
          called = true
          return NOTHING
        },
      },
      60_000,
    )
    assert.equal(got, 'GOOD')
    assert.equal(called, false, 'a valid token must not burn the refresh_token')
  })

  it('returns null when there was never a session', async () => {
    const got = await ensureFreshAccessToken(authReturning(null, NOTHING), 60_000)
    assert.equal(got, null, 'never fabricate a token from no session')
  })

  it('propagates a refresh error rather than silently downgrading to the stale token', async () => {
    // getAccessTokenFresh() catches this and returns null, which the pages turn
    // into "Sign in required". Swallowing it into a dead token would be the bug
    // all over again.
    await assert.rejects(
      () =>
        ensureFreshAccessToken(
          {
            getSession: async () => ({ data: { session: token('STALE', -10) }, error: null }),
            refreshSession: async () => ({ data: { session: null }, error: new Error('refresh failed') }),
          },
          60_000,
        ),
      /refresh failed/,
    )
  })
})