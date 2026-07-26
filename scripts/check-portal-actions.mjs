/**
 * Self-check: customer portal mutate action routing (no network).
 * Run: node scripts/check-portal-actions.mjs
 */
import assert from 'node:assert/strict'

const ALLOWED = new Set(['add-vehicle', 'sync-email', 'update-phone'])

function resolveAction(body) {
  const action = String(body?.action || '').trim()
  if (!action) return 'load'
  if (!ALLOWED.has(action)) return 'unknown'
  return action
}

assert.equal(resolveAction({}), 'load')
assert.equal(resolveAction({ action: 'add-vehicle' }), 'add-vehicle')
assert.equal(resolveAction({ action: 'sync-email' }), 'sync-email')
assert.equal(resolveAction({ action: 'hack' }), 'unknown')
console.log('check-portal-actions: ok')
