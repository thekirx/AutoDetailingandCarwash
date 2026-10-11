import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The security migrations are applied in production (70c0c1d). A commit message
 * asserting that is a claim, and the session that produced those migrations had
 * shipped a drift guard that could never pass -- array_to_string of an empty
 * array is '' rather than NULL, so it raised on every clean run. A migration
 * can be merged, green in its contract test, and still not be doing anything.
 *
 * So these probes are the standing answer to "is it actually live", and they
 * have to keep reporting truthfully. Both had told a falsehood:
 *
 *   probe-payment-method-drift  destructured `{ data: one }` out of readOrFail,
 *     which returns res.data -- so `one` was always undefined and it printed
 *     "(no paid rows sampled)" on every run, for 988 paid rows that exist.
 *
 *   probe-live-security-state  asserted a Branch Admin could not enumerate every
 *     customer. That was FALSE: 20261011090000 closes BUG-071 with a
 *     customers_soft_delete trigger rather than by narrowing the policy, and
 *     company-wide customer SELECT is intended -- customers have no branch.
 *     The probe reported FAIL against correct production.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('the read-only probes report what they actually measured', () => {
  it('the drift probe does not destructure a response out of readOrFail', () => {
    const src = readFileSync(join(root, 'scripts/probe-payment-method-drift.mjs'), 'utf8')
    // readOrFail returns res.data. Destructuring `{ data: ... }` from it is
    // always undefined, which is how the probe printed a false claim on every
    // run while the rest of its output was correct.
    assert.doesNotMatch(src, /\{ data: \w+ \} = readOrFail\(/, 'readOrFail returns data, not the response')
    assert.match(src, /function readOrFail\(label, res\) \{\s*\n?\s*if \(res\.error\)/, 'readOrFail still returns res.data')
  })

  it('the live-state probe does not assert a branch-scope rule the design never had', () => {
    const src = readFileSync(join(root, 'scripts/probe-live-security-state.mjs'), 'utf8')
    assert.doesNotMatch(
      src,
      /cannot enumerate the whole customer base/,
      'company-wide customer SELECT is intended; customers_soft_delete is the BUG-071 control',
    )
    // The closed claim it DOES make must stay: a Branch Admin sees no inbox row
    // belonging to somebody else.
    assert.match(src, /no notification owned by another user is visible/)
    assert.match(src, /foreign rows leaked/)
  })

  it('both probes stay read-only — no INSERT, UPDATE or DELETE is issued', () => {
    // The one thing this file must never do is probe a write guard by
    // performing the write. BUG-071 is exactly that story.
    for (const f of ['scripts/probe-live-security-state.mjs', 'scripts/probe-payment-method-drift.mjs']) {
      const src = readFileSync(join(root, f), 'utf8')
      assert.doesNotMatch(src, /\.insert\(|\.update\(|\.upsert\(|\.delete\(\)/, `${f} issues a write`)
      assert.doesNotMatch(src, /service_role[^]*?rpc\(/i, `${f} calls an RPC as service role`)
    }
  })

  it('the drift guard that could never pass is now pinned everywhere it exists', () => {
    // The owner fixed it in the two daily-sheet migrations. Any migration that
    // builds a "missing" list and tests `is not null` has the same trap: an
    // empty array stringifies to '', which is not NULL, so the guard fires on a
    // perfectly clean body.
    const seen = new Set()
    for (const name of [
      '20261010160000_daily_sheet_separation_of_duties.sql',
      '20261010170000_daily_sheet_cash_blank_is_cash.sql',
    ]) {
      const src = readFileSync(join(root, 'supabase/migrations', name), 'utf8')
      seen.add(name)
      assert.match(src, /nullif\s*\(\s*array_to_string\(/, `${name} would raise on every clean run`)
      assert.match(src, /, ''\)\s*;/, `${name} does not map the empty result to NULL`)
    }
    assert.equal(seen.size, 2)
  })
})