/**
 * The 2026-09-29 POS hand-off void must be safe to run, and "safe" here means
 * several specific things that a careless edit would break.
 *
 * Owner decision 2026-10-09: the two stranded hand-offs were POS testing, so
 * they are voided and archived — never rung up. Verified read-only against
 * production before writing a line of this:
 *
 *   2 hand-offs, status pending, branch bacoor, 2026-09-29
 *     3dc882e1  PHP   297.50  booking fbecfcc7  plate ABC124   (no visit group)
 *     c8dfab00  PHP 5,100.00  booking b6e22863  plate ABC7643  (visit group)
 *   2 transactions, status pending_payment (one per hand-off)
 *   3 bookings to void — the ABC7643 VISIT has TWO bookings at PHP 2,550 each,
 *     which together are the PHP 5,100 hand-off. Only one of the pair carries a
 *     hand-off.
 *   0 sales attached to any of them -> there is no money to unbook.
 *
 * That third bullet is the one that matters. Cancelling per hand-off would have
 * left booking 1c3c2528 sitting in `for_payment` forever, waiting for a payment
 * that is never coming, while its sibling was cancelled. `admin_override_queue_status`
 * avoids this by expanding to the whole visit group, and this migration has to
 * do the same — that is the contract pinned below.
 *
 * The migration is NOT executed automatically by anything. It is a file for a
 * human to run after reading it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')
const FILE = readdirSync(migrationsDir).find((f) => f.includes('void_20260929_pos_test'))
assert.ok(FILE, 'the 2026-09-29 POS test hand-off void migration must exist')

/**
 * Assertions run against the SQL with its comments stripped.
 *
 * This is not cosmetic. A mutation that "removes" the queue_events insert by
 * commenting it out leaves the words `insert into public.queue_events` sitting
 * in the file, so a plain substring match still passed and the audit-trail
 * guard was never actually exercised. A safety step that is commented out is
 * not a safety step, so the test must not see it.
 */
const stripSqlComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
const SQL = stripSqlComments(readFileSync(join(migrationsDir, FILE), 'utf8'))

test('the migration refuses to run unless the world still matches what we verified', () => {
  // Row-count guards. If someone rings one of these up, or the data drifts, this
  // migration must abort rather than "helpfully" voiding whatever is left.
  assert.match(SQL, /raise exception/i, 'the migration must abort on unexpected state')
  // Pinned to the specific guard, not to "a count compared against 2". A looser
  // regex passed when this guard was deleted because the transaction guard also
  // compares a count against 2 — the test then proved the wrong thing.
  assert.match(
    SQL,
    /count\(\*\)\s+from\s+unnest\(target_handoff_ids\)\)\s*<>\s*2\b/,
    'it must assert exactly 2 pending test hand-offs',
  )
  assert.match(
    SQL,
    /count\(\*\)[^;]{0,120}from\s+public\.sales[^;]{0,160}<>\s*0\b/i,
    'it must check for attached sales and abort if any exist',
  )
  // Never unbook. There is no sale to remove, and removing one would corrupt the
  // books for a test ticket that never earned anything.
  assert.doesNotMatch(SQL, /delete\s+from\s+public\.sales/i, 'it must never delete a sale')
  assert.doesNotMatch(SQL, /complete_pos_sale/i, 'it must never complete a sale')
})

test('it refuses to proceed if anything is not exactly as verified', () => {
  assert.match(
    SQL,
    /count\(\*\)\s+from\s+public\.sales[^;]{0,160}<>\s*0\b/i,
    'it must check for attached sales and abort if any exist',
  )
})

test('it voids the whole visit, not just the rows that happen to have a hand-off', () => {
  // The ABC7643 visit is two bookings; only one carries the hand-off. This is
  // the bug that a per-hand-off migration ships.
  assert.match(
    SQL,
    /or\s+b\.visit_group_id\s+in\s*\(/,
    'the booking set must be widened by visit group, not by hand-off alone',
  )
  assert.match(SQL, /group_ids/, 'the widened set is what the later writes must use')
  assert.match(
    SQL,
    /count\(\*\)\s+from\s+unnest\(group_ids\)\)\s*<>\s*3\b/,
    'it must assert exactly 3 bookings across both visits',
  )
  // And every write must target that widened set, not the hand-off bookings.
  assert.match(SQL, /where\s+b\.id\s*=\s*any\(group_ids\)/i, 'the booking writes must use the group set')
})

test('it mirrors the sanctioned override: cancel the hand-off AND its transaction', () => {
  // admin_override_queue_status cancels pos_handoffs.status='pending' and
  // transactions.status='pending_payment' in the same breath. Cancelling only
  // the hand-off would leave an orphaned pending_payment row.
  assert.match(
    SQL,
    /update\s+public\.pos_handoffs[\s\S]*?set\s+status\s*=\s*'cancelled'/i,
    'pending hand-offs must be cancelled',
  )
  assert.match(
    SQL,
    /update\s+public\.transactions[\s\S]*?set\s+status\s*=\s*'cancelled'/i,
    'their pending_payment transactions must be cancelled too',
  )
  // Scoping matters as much as the statement existing: an update that touches
  // nothing is still an update that matches `set status = 'cancelled'`.
  assert.match(
    SQL,
    /update\s+public\.transactions[\s\S]{0,400}?where\s+t\.pos_handoff_id\s*=\s*any\(target_handoff_ids\)/i,
    'the transaction cancel must be scoped to the target hand-offs',
  )
  assert.match(SQL, /pending_payment/, 'only pending_payment transactions may be touched')
})

test('it archives the bookings and leaves an audit trail', () => {
  assert.match(
    SQL,
    /update\s+public\.bookings[\s\S]*?is_archived\s*=\s*true/i,
    'the voided bookings must be archived',
  )
  assert.match(
    SQL,
    /insert\s+into\s+public\.queue_events/i,
    'it must write a queue_events row so the change is explainable later',
  )
  // 'cancelled' is a real value in the live enum (verified: rows exist).
  assert.match(SQL, /'cancelled'/, 'bookings must land on a real enum value')
})

test('it runs atomically', () => {
  assert.match(SQL, /^\s*begin;/im, 'the migration must open a transaction')
  assert.match(SQL, /commit;/i, 'the migration must commit explicitly')
  // A rollback-only migration is a footgun with no error path.
  assert.doesNotMatch(SQL, /rollback/i, 'it must not leave a rollback branch in place')
})