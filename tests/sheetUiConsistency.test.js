/**
 * `check-sheet-ui.mjs` closes the last unverified link in the money chain.
 *
 * The chain had been checked link by link and never end to end:
 *   sales -> line items   verified
 *   sales + lines -> totals verified (computeSheetTotals matches all 60 sheets)
 *   totals -> THE SCREEN  never checked
 *
 * A screen that renders a stale or wrong figure leaves the database correct and
 * everything green, so this has to exist. It is also the easiest check in the
 * repo to make vacuously green, and every test here exists because that is what
 * actually happened while writing it:
 *
 *   - it first reported a clean PASS while comparing exactly ONE sheet, because
 *     the tab defaults to `status=submitted` (a review inbox by design). Asking
 *     for `status=all` is what makes it cover the month.
 *   - reading the table during the Finance skeleton yields zero rows, which is
 *     indistinguishable from a genuinely empty result — so an empty table must
 *     never be a pass.
 *   - the screen renders the branch *slug* when the name is missing from its
 *     options, so keying only on the name made all 60 rows look like
 *     discrepancies when the figures were identical.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const CHECK = read('scripts/check-sheet-ui.mjs')
const CODE = CHECK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the check asks for every sheet, not just the review queue', () => {
  // FinancePage.jsx renders `status={extras.status || 'submitted'}`, so the tab
  // opens as an inbox of sheets awaiting a decision. Without `status=all` this
  // compares 1 of 60 and reports PASS, which is how the first run "passed".
  assert.match(CODE, /status=all/, 'the URL must request every status, not the submitted inbox')
  assert.match(CODE, /period=custom/, 'the range must be pinned so coverage is deterministic')
  assert.match(CODE, /from=\$\{FROM\}&to=\$\{TO\}/, 'from/to must be sent explicitly')
})

test('an empty table is never a pass', () => {
  assert.match(CODE, /if\s*\(!rows\.length\)\s*\{/, 'the empty-table branch must exist')
  assert.match(CODE, /failures\+\+/, 'the empty-table branch must count as a failure')
  assert.match(CODE, /NOT VERIFIED/, 'it must say plainly that nothing was compared')
  // And it must wait for the table rather than reading the skeleton.
  assert.match(CODE, /waitForSheetsTable/, 'it must wait for the sheets table to finish loading')
  assert.match(CODE, /loading/,
    'the readiness wait must key on the loading state, not just the auth gate')
  assert.match(CODE, /dismissCookieBanner/, 'the cookie banner must be dismissed or the page never settles')
})

test('the branch label resolves through both the slug and the name', () => {
  // The screen falls back to the raw slug when a branch is absent from its
  // options (bacoor), so keying only on the name mismatches every such row.
  assert.match(CODE, /labelToSlug/, 'it must map a rendered branch label back to its slug')
  assert.match(CODE, /labelToSlug\.set\(b\.slug,\s*b\.slug\)/, 'the slug form must be accepted')
  assert.match(CODE, /labelToSlug\.set\(b\.name,\s*b\.slug\)/, 'the display-name form must be accepted')
})

test('coverage is reported, and partial coverage is called out', () => {
  // A check that compared 3 of 60 must not read as a clean bill of health.
  assert.match(CODE, /matched \$\{covered\.size\} of \$\{expected\.size\}/,
    'it must state how many sheets it actually compared')
  assert.match(CODE, /only \$\{covered\.size\}\/\$\{expected\.size\} sheets were visible/,
    'partial coverage must be called out explicitly')
  for (const field of ['net', 'expenses', 'salaries', 'profit']) {
    assert.ok(CODE.includes(`['${field}'`), `the ${field} column must be compared`)
  }
})

test('the check writes nothing', () => {
  // It logs in as a real Super Admin against production. A stray write would be
  // unrecoverable, and a finance screen check has no reason to write at all.
  for (const re of [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(\s*\)\s*(?!\.)/]) {
    assert.ok(!re.test(CODE), `check-sheet-ui.mjs must stay read-only — found ${re}`)
  }
  assert.doesNotMatch(CODE, /rpc\(\s*['"](submit_daily_sheet|review_daily_sheet|reopen_daily_sheet)['"]/,
    'it must not call a sheet-mutating RPC')
  // Only screenshots are written, and only to the evidence folder.
  const shots = [...CODE.matchAll(/page\.screenshot\(\{[\s\S]{0,200}?\}\)/g)].map((m) => m[0])
  for (const s of shots) {
    assert.match(s, /e2e-evidence/, `a screenshot path must stay under e2e-evidence, got ${s}`)
    assert.doesNotMatch(s, /path:\s*['"`]?\.\./, 'a screenshot must not be written outside the repo')
  }
})

test('the check is reachable from npm', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.ok(pkg.scripts['check:sheet-ui'], 'npm run check:sheet-ui must exist')
})