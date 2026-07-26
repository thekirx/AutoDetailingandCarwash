import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSessionExpired,
  needsRefresh,
  sessionExpiresAtMs,
  shouldReloadProfile,
  refreshSessionSingleFlight,
  ensureFreshAccessToken,
} from '../src/lib/session.js'

describe('session helpers', () => {
  it('sessionExpiresAtMs converts unix seconds', () => {
    assert.equal(sessionExpiresAtMs({ expires_at: 1700000000 }), 1700000000 * 1000)
    assert.equal(sessionExpiresAtMs(null), 0)
  })

  it('needsRefresh when missing token or within skew', () => {
    const now = 1_000_000
    assert.equal(needsRefresh(null, now), true)
    assert.equal(needsRefresh({ access_token: 't', expires_at: Math.floor((now + 30_000) / 1000) }, now, 60_000), true)
    assert.equal(needsRefresh({ access_token: 't', expires_at: Math.floor((now + 120_000) / 1000) }, now, 60_000), false)
  })

  it('isSessionExpired when past expires_at', () => {
    const now = 1_000_000
    assert.equal(isSessionExpired({ access_token: 't', expires_at: Math.floor((now - 1) / 1000) }, now), true)
    assert.equal(isSessionExpired({ access_token: 't', expires_at: Math.floor((now + 60_000) / 1000) }, now), false)
  })

  it('shouldReloadProfile skips TOKEN_REFRESHED', () => {
    assert.equal(shouldReloadProfile('TOKEN_REFRESHED'), false)
    assert.equal(shouldReloadProfile('INITIAL_SESSION'), false)
    assert.equal(shouldReloadProfile('SIGNED_IN'), true)
    assert.equal(shouldReloadProfile('SIGNED_OUT'), true)
    assert.equal(shouldReloadProfile('USER_UPDATED'), true)
    assert.equal(shouldReloadProfile('PASSWORD_RECOVERY'), true)
  })

  it('refreshSessionSingleFlight coalesces concurrent calls', async () => {
    let calls = 0
    const auth = {
      async refreshSession() {
        calls += 1
        await new Promise((r) => setTimeout(r, 20))
        return { data: { session: { access_token: `tok-${calls}`, expires_at: 9_999_999_999 } }, error: null }
      },
      async getSession() {
        return { data: { session: null }, error: null }
      },
    }
    const [a, b] = await Promise.all([refreshSessionSingleFlight(auth), refreshSessionSingleFlight(auth)])
    assert.equal(calls, 1)
    assert.equal(a.access_token, b.access_token)
  })

  it('ensureFreshAccessToken refreshes only when needed', async () => {
    const far = Math.floor((Date.now() + 3600_000) / 1000)
    let refreshes = 0
    const auth = {
      async getSession() {
        return { data: { session: { access_token: 'fresh', expires_at: far } }, error: null }
      },
      async refreshSession() {
        refreshes += 1
        return { data: { session: { access_token: 'new', expires_at: far } }, error: null }
      },
    }
    const token = await ensureFreshAccessToken(auth)
    assert.equal(token, 'fresh')
    assert.equal(refreshes, 0)
  })
})
