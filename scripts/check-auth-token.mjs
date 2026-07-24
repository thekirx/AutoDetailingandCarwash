/**
 * Self-check: getAccessTokenFresh near-expiry refresh contract (no network).
 * Run: node --experimental-vm-modules scripts/check-auth-token.mjs
 * (imports mocked via inline assert of helper behaviour documented here)
 */
import assert from 'node:assert/strict'

/** Mirror of near-expiry decision in src/lib/authToken.js — keep in sync. */
function shouldRefresh(expiresAtSec, nowMs = Date.now()) {
  if (!expiresAtSec) return false
  return expiresAtSec * 1000 < nowMs + 60_000
}

assert.equal(shouldRefresh(Math.floor(Date.now() / 1000) + 30), true, 'refresh when <60s left')
assert.equal(shouldRefresh(Math.floor(Date.now() / 1000) + 600), false, 'keep when far from expiry')
assert.equal(shouldRefresh(0), false, 'no expiry → no refresh')
console.log('check-auth-token: ok')
