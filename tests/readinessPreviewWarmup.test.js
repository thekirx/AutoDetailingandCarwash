import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The readiness sweep must not hand a cold server to its first UI step.
 *
 * `startSharedPreview` used to declare the dev server ready the moment the socket
 * answered. A Vite dev server answers the socket long before it can serve modules:
 * the first request for a real route triggers an on-demand transform of the whole
 * import graph. e2e-ui-p0's first navigation therefore ate a cold transform, blew
 * its 20s selector wait on the login form, and aborted the whole sweep at `0/1` —
 * a truncated result that reads exactly like a broken login page.
 *
 * The tell is the shape of the failure, not the error: 0 of 1 checks, fatal on the
 * very first selector. Checks that never ran cannot fail, so a collapsed run that
 * looks red is worse than a red one (the BUG-064 lesson).
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/**
 * Comments are stripped first: prose naming the defect satisfies a grep for it.
 *
 * Order matters and the reason is not obvious. The readiness script carries a
 * comment reading "Dev server required for /api/<star> customer auth middleware".
 * The star there forms what a block-comment stripper believes is a comment opener.
 * Paired with a block-comment terminator twenty lines down, it swallowed the entire
 * socket-probe loop, so the assertion below could not match code that was present
 * and correct. Line comments go first, so that opener never gets a chance to pair.
 */
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const READY = code('scripts/e2e-ultimate-readiness.mjs')

describe('the readiness sweep waits for the app, not just the socket', () => {
  const warm = READY.slice(READY.indexOf('async function startSharedPreview'))

  it('warms a real route, and only returns after that warm-up', () => {
    const loop = warm.indexOf('warmed = res.ok')
    // Anchored on the brace. There are TWO `if (!warmed)` in the function — the
    // in-loop retry check and the abort gate — and matching the bare text picks
    // the retry one, so neutering the abort gate sailed straight through.
    const gate = warm.indexOf('if (!warmed) {')
    const ret = warm.indexOf('return {', loop)
    assert.ok(loop > -1, 'the warm-up must actually probe a route and record the result')
    assert.ok(gate > -1, 'the warm-up result must gate the return, or the whole phase is decoration')
    assert.ok(gate > loop, 'the gate must come after the probe, not before it')
    assert.ok(ret > gate, `the function must not return before the warm-up is gated (loop ${loop}, gate ${gate}, return ${ret})`)
    assert.match(warm, /operations\/login/, "the warm-up must hit the route the first UI step loads, not just \"/\"")
  })

  it('aborts rather than handing over a server it could not warm', () => {
    const gate = warm.indexOf('if (!warmed) {')
    const body = warm.slice(gate, gate + 300)
    assert.match(body, /throw new Error/, 'an unwarmed server must abort the sweep')
    assert.match(body, /never served/, 'the abort must say what it could not serve')
    assert.ok(body.indexOf('throw new Error') < body.indexOf('return'), 'throwing must come before returning')
  })

  it('keeps the socket probe as a fast first gate, ahead of the warm-up', () => {
    const socket = warm.indexOf('if (!listening)')
    const warmup = warm.indexOf('let warmed = false')
    assert.ok(socket > -1, 'the socket gate must remain — it is the fast path')
    assert.ok(warmup > socket, 'phase 2 must come after phase 1, not replace it')
    assert.match(warm.slice(socket, socket + 220), /throw new Error/, 'a dead socket must abort too')
  })

  it('the UI steps that hit the shared preview are critical', () => {
    // A UI step silently demoted to non-critical would turn this class of
    // truncation into a green sweep.
    for (const label of ['e2e-ui-p0', 'e2e-ui-money']) {
      const i = READY.indexOf(label)
      assert.ok(i > -1, `${label} must still run in the sweep`)
      assert.match(READY.slice(i, i + 400), /critical:\s*true/, `${label} must stay critical`)
    }
  })
})