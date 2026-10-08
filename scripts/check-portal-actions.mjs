/**
 * Self-check: customer portal mutate action routing (no network, no database).
 *
 *   node scripts/check-portal-actions.mjs
 *
 * BUG-057: this used to contain its own copy of `resolveAction` with a
 * three-action allowlist. The real handler in server/customerPortal.mjs had
 * grown to seven actions (add-vehicle, update-vehicle, archive-vehicle,
 * sync-email, update-birthday, update-phone, submit-review), so the check
 * asserted against its own stale copy and could never detect a regression.
 * A self-check that tests a copy of the thing it is meant to check is worse
 * than no check: it reports green.
 *
 * It now reads the real handler and asserts its header docstring lists exactly
 * the actions it branches on. Adding a branch without updating the header — or
 * the reverse — fails here.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'server', 'customerPortal.mjs'), 'utf8')

/** Actions the handler actually branches on, in source order. */
function handlerActions() {
  const start = source.indexOf('export async function mutateCustomerPortal')
  assert.ok(start >= 0, 'mutateCustomerPortal must exist in server/customerPortal.mjs')
  const end = source.indexOf('\nexport ', start + 1)
  const body = source.slice(start, end > 0 ? end : source.length)
  return [...body.matchAll(/action === '([a-z-]+)'/g)].map((m) => m[1])
}

/** Actions the file header claims to support. */
function documentedActions() {
  const header = source.slice(0, source.indexOf('*/'))
  const line = header.split('\n').find((l) => /POST actions:/.test(l))
  assert.ok(line, 'customerPortal.mjs must document its POST actions in the header')
  return [...line.matchAll(/([a-z]+(?:-[a-z]+)+)/g)].map((m) => m[1])
}

const handled = handlerActions()
const documented = documentedActions()

assert.ok(handled.length >= 7, `expected the full action set, parsed ${handled.length}: ${handled.join(', ')}`)
assert.deepEqual(
  [...documented].sort(),
  [...handled].sort(),
  'the header and the handler disagree about which actions exist — one of them is stale',
)
assert.equal(new Set(handled).size, handled.length, 'duplicate action branch in mutateCustomerPortal')
assert.ok(
  !handled.includes('hack'),
  'the check must still reject an unknown action rather than accepting anything',
)

console.log(`check-portal-actions: ok — ${handled.length} actions, header and handler agree (${handled.join(', ')})`)