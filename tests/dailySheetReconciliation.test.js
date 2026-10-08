/**
 * The September seed, the cleanup script, and the probes that call data "seeded"
 * must agree on what "seeded" means — or the audit will classify rows one way
 * and the cleanup will remove them another.
 *
 * This is BUG-066. `wipe-september-2026.sql` removes seeded `bookings`, seeded
 * `sales` and seeded `customers`, but never `pos_handoffs` or `transactions`.
 * Any hand-off pointing at a seeded booking would be left referencing a row
 * that no longer exists. Nothing currently triggers it, so it is a trap rather
 * than an active bug — and a trap is exactly what a marker mismatch creates.
 *
 * The probes derive "is this seed data?" from marker patterns. If those patterns
 * drift from the ones the wipe script keys on, the audit will confidently
 * classify a row as safe (or unsafe) using markers that no longer describe it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const WIPE = read('scripts/seed/wipe-september-2026.sql')
const PLAN = read('scripts/seed/september2026Plan.mjs')

test('the probes and the cleanup agree on the seed customer-email marker', () => {
  // The wipe keys customers on `%@sep2026.hakum.test`.
  const wipeMarker = /email like\s+'([^']*sep2026[^']*)'/i.exec(WIPE)
  assert.ok(wipeMarker, 'the wipe script must still key on a seed customer email marker')
  const token = wipeMarker[1].replace(/%.*$/, '').trim() // '@sep2026.hakum.test'

  const probe = read('scripts/probe-stranded-handoffs.mjs')
  assert.ok(
    probe.includes('sep2026'),
    'probe-stranded-handoffs.mjs must use the same seed email token as the wipe script',
  )
  assert.ok(probe.includes(token), `the probe must recognise the exact wipe marker token ${token}`)
})

test('the probes and the cleanup agree on the seed plate marker', () => {
  // The wipe removes vehicles by plate `^ZZ[BT][0-9]{4}$`.
  const wipePlate = /plate_number\s*~\s*'([^']+)'/i.exec(WIPE)
  assert.ok(wipePlate, 'the wipe script must still key on a seed plate pattern')
  const probe = read('scripts/probe-stranded-handoffs.mjs')
  assert.ok(
    probe.includes('ZZ') && probe.includes('BT'),
    `the probe must recognise the wipe plate pattern ${wipePlate[1]}`,
  )
})

test('the seed plan creates no pos_handoffs, so hand-off rows are never seed output', () => {
  // This is what makes BUG-061's two rows real test residue rather than seed
  // rows: the seed never writes a hand-off, so anything in that table came
  // from a person clicking through POS by hand.
  assert.doesNotMatch(
    PLAN,
    /pos_handoff/i,
    'the seed plan must not create pos_handoffs; if it starts to, BUG-061 needs re-reading',
  )
})

test('the cleanup leaves pos_handoffs and transactions behind', () => {
  // Recorded as a known gap, not endorsed. If someone extends the wipe to
  // cover them, this test should be updated deliberately rather than by accident.
  assert.doesNotMatch(WIPE, /delete\s+from\s+public\.pos_handoffs/i,
    'the wipe no longer removes pos_handoffs — revisit BUG-066 and confirm no hand-off can dangle')
  assert.doesNotMatch(WIPE, /delete\s+from\s+public\.transactions/i,
    'the wipe no longer removes transactions — revisit BUG-066')
})

test('every database probe is read-only', () => {
  // These run against PRODUCTION with the service-role key. A stray write in
  // any of them would be unrecoverable.
  const probes = [
    'scripts/probe-transactions.mjs',
    'scripts/probe-daily-sheets.mjs',
    'scripts/probe-stranded-handoffs.mjs',
    'scripts/probe-stranded-detail.mjs',
    'scripts/probe-stranded-customers.mjs',
    'scripts/probe-sept29-activity.mjs',
    'scripts/audit-db-deep.mjs',
  ]
  for (const p of probes) {
    const code = read(p)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const re of [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(\s*\)\s*(?!\.)/]) {
      assert.ok(!re.test(code), `${p} must stay read-only — found ${re}`)
    }
    assert.doesNotMatch(code, /rpc\(\s*['"](run_payroll|complete_pos_sale|submit_daily_sheet|review_daily_sheet|reopen_daily_sheet)['"]/,
      `${p} must not call a money-mutating RPC`)
  }
})

test('the audit tells people NOT to ring up the stranded hand-offs', () => {
  // BUG-061 was first filed as unbooked revenue with the instruction "ring
  // these up from POS". Chasing the provenance showed both rows are manual POS
  // test residue, so following that instruction would post test data into the
  // real books. The audit is what an operator reads first; its advice has to
  // match the corrected finding.
  const audit = read('scripts/audit-db-deep.mjs')
  assert.match(audit, /Do NOT ring these up/,
    'the audit must warn against ringing up hand-offs that may be test residue')
  assert.doesNotMatch(audit, /Branch Admin can still ring these up/,
    'the old advice must not come back')
})