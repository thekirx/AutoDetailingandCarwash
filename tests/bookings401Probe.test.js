/**
 * The BUG-067 probe must not become a writer.
 *
 * `scripts/probe-bookings-401.mjs` signs in as a real Branch Admin against
 * production and navigates the ops app. It exists to observe an intermittent
 * 401, and it has no reason to touch data — so "it only reads" is asserted here
 * rather than trusted, on the same principle as `tests/dbAuditSafety.test.js`.
 *
 * It is also the standing evidence for a negative result. Both of its modes came
 * back clean on 2026-10-09 — 10 reloads of /operations/bookings as Branch Admin,
 * and full dock walks for `admin` (10 routes) and `marketing` (5 routes) — so the
 * 401 needs the wave's multi-persona re-sign-in sequence to reproduce. That is
 * recorded as a null result, not as a clearance.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const SRC = read('scripts/probe-bookings-401.mjs')
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the probe never writes', () => {
  // Supabase mutators. A diagnostic that can change production money or booking
  // data is not a diagnostic.
  for (const re of [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(\s*\)\s*(?!\.)/]) {
    assert.ok(!re.test(CODE), `probe-bookings-401.mjs must stay read-only — found ${re}`)
  }
  assert.doesNotMatch(
    CODE,
    /rpc\(\s*['"](complete_pos_sale|submit_daily_sheet|review_daily_sheet|reopen_daily_sheet)['"]/,
    'it must not call a money-mutating RPC',
  )
  // Supabase mutators are not the only way to write. A raw state-changing fetch
  // slipped past the check above on the first attempt — the mutation proved it,
  // not review — so the guard covers the HTTP verb too.
  assert.doesNotMatch(
    CODE,
    /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i,
    'the probe must not issue a state-changing request against any host',
  )
  // It observes the wire rather than only reading the console: the console string
  // for a failed fetch names neither URL nor status, which is the whole reason
  // this probe exists.
  assert.match(CODE, /page\.on\('response'/, 'it must observe responses')
  assert.match(CODE, /hadAuthHeader/, 'it must record whether a request carried a token')
})

test('the probe derives its own route list instead of hardcoding one', () => {
  // A hardcoded list would silently stop covering a route when the nav changes,
  // and the probe would keep reporting "clean" for pages it never opened.
  for (const fn of ['getOperationsNav', 'getTeamLeadDock', 'getSalesDock', 'getStaffDock']) {
    assert.match(CODE, new RegExp(`\\b${fn}\\b`), `the probe must build its dock with ${fn}`)
  }
  assert.match(CODE, /startsWith\('\/operations'\)/, 'only ops routes may be walked')
  // Referencing the builders is not enough — the first version of this test
  // passed while the walk had been rewired to a hardcoded single route, because
  // `dockFor` was still defined and still mentioned all four of them. Assert the
  // derived list is what the walk actually consumes.
  assert.match(CODE, /= dockFor\(/, 'the derived dock must be computed')
  assert.match(CODE, /\?\s*dock\s*:/, 'walk mode must walk the derived dock, not a hardcoded list')
})

test('a null result is never printed as a pass', () => {
  // The probe's whole value is honesty: "it did not reproduce" must read as a
  // null result, never as a clearance.
  assert.match(CODE, /null result, not a clearance/, 'a clean probe must say so explicitly')
  assert.match(CODE, /No 4xx\/5xx/, 'a clean run must state what was actually checked')
})

test('the probe is reachable from npm', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.ok(pkg.scripts['probe:bookings-401'], 'npm run probe:bookings-401 must exist')
})