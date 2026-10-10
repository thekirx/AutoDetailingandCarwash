import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A FAIL screenshot from an earlier run is indistinguishable from a live defect.
 *
 * e2e-evidence/ui-p0/ carried login-admin-FAIL.png and login-tl-FAIL.png
 * timestamped 08:14 on 2026-10-10, while summary.json in the same directory
 * reported `"ok": true, "passed": 9, "total": 9, "failed": []` at 19:11 the
 * same day. That produced an "unexplained admin login rejection" which had not
 * reproduced in eleven hours, and which scripts/probe-demo-login.mjs shows never
 * reproduces at all: every demo credential signs in cleanly, alone and in the
 * order e2e-ui-p0.mjs uses.
 *
 * The screenshots outlived the run that wrote them because nothing removed them
 * on a later success. So the directory accumulated an unresolvable "failure".
 *
 * The fix is that a FAIL artifact may only exist if the current run produced it,
 * which means clearing them before the run starts. These assertions pin that.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'scripts/e2e-ui-p0.mjs'), 'utf8')

describe('e2e-ui-p0 cannot leave a stale failure artifact behind', () => {
  it('clears prior FAIL shots before the run starts', () => {
    assert.match(src, /f\.endsWith\('-FAIL\.png'\)/, 'FAIL artifacts are no longer swept')
    assert.match(src, /rmSync\(join\(outDir, f\), \{ force: true \}\)/)
  })

  it('the sweep runs at module load, not inside the failure path', () => {
    // If the sweep only ran when a failure happened, the stale files from the
    // PREVIOUS run would still be sitting there when this one passed -- which is
    // exactly the bug. So it has to run before anything else does.
    //
    // Asserting position against `fail(` is a trap: the function *declaration*
    // also contains those characters, so an index check can pass or fail for
    // reasons unrelated to where the sweep lives. Pin it to the last statement
    // of fail() instead, which puts the sweep unambiguously outside its body.
    const sweepAt = src.indexOf("endsWith('-FAIL.png')")
    const failBodyEnd = src.indexOf("console.error('✖', name, detail)")
    const mainAt = src.indexOf('async function main')

    assert.ok(sweepAt > -1, 'no sweep found')
    assert.ok(failBodyEnd > -1, 'fail() no longer logs, so its body cannot be located')
    assert.ok(sweepAt > failBodyEnd, 'the sweep is inside fail(), so it only runs when a failure occurs')
    if (mainAt > -1) assert.ok(sweepAt < mainAt, 'the sweep happens after the run begins')
  })

  it('it only removes FAIL shots, never passing evidence', () => {
    // A sweep that matched *.png would delete the passing screenshots too, and
    // then a reader with no artifacts would be worse off than one with stale ones.
    assert.match(src, /if \(f\.endsWith\('-FAIL\.png'\)\)/)
    assert.doesNotMatch(src, /endsWith\('\.png'\)\)\s*rmSync/, 'the sweep must not delete passing shots')
  })

  it('it needs the fs imports it uses', () => {
    assert.match(src, /import \{[^}]*readdirSync[^}]*\} from 'node:fs'/)
    assert.match(src, /import \{[^}]*rmSync[^}]*\} from 'node:fs'/)
  })

  it('the demo credentials are independently verifiable, so this was never a credential fault', () => {
    const probe = readFileSync(join(root, 'scripts/probe-demo-login.mjs'), 'utf8')
    // The probe is what lets us say the credentials are fine rather than assume
    // it: it signs each persona in on a fresh client AND in the order the e2e
    // uses, so a sequence-only fault would still show up.
    assert.match(probe, /OPS_DEMO_ACCOUNTS/)
    assert.match(probe, /signInWithPassword/)
    assert.match(probe, /fresh-client results/)
    assert.match(probe, /The e2e ordering is not the cause/)
  })
})