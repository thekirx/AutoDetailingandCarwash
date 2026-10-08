/**
 * The queue hand-off function and `complete_pos_sale` agree on exactly one
 * status value, and if they ever stop agreeing the money strands silently.
 *
 * Background, because this was a real defect once. Migration
 * 20260707132730_queue_production_schema_cache_fix.sql created the transaction
 * with status `pending`. The POS settle path
 * (20260819081507_complete_pos_sale_settle_txn.sql) settles only rows matching
 *
 *     where t.status = 'pending_payment'
 *
 * so every hand-off raised between 2026-07-07 and the 2026-07-15 correction
 * produced a transaction that no code path could ever settle. Four such rows
 * are still in production (PHP 2,400). Nothing was lost — `sales` is the money
 * source of truth — but the rows can never transition, and the failure is
 * silent: no error, no warning, just a row that sits there forever.
 *
 * These tests pin both ends of the contract so the mismatch cannot return.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const MIGRATIONS = join(root, 'supabase', 'migrations')

const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

/** Every `insert into public.transactions (...) values (...)` in the migrations. */
function transactionInserts() {
  const out = []
  for (const f of migrationFiles) {
    const s = readFileSync(join(MIGRATIONS, f), 'utf8')
    const re = /insert into public\.transactions\s*\(([\s\S]{0,500}?)\)\s*values\s*\(([\s\S]{0,500}?)\)\s*(?:returning|;)/g
    let m
    while ((m = re.exec(s))) {
      const status = /'(pending_payment|pending|completed|for_payment)'/.exec(m[2])
      out.push({ file: f, status: status ? status[1] : null })
    }
  }
  return out
}

test('the hand-off function creates transactions in a status POS can settle', () => {
  const inserts = transactionInserts()
  assert.ok(inserts.length > 0, 'the migrations must still contain a transactions insert')

  // The newest definition wins: it is the one live in production.
  const latest = inserts[inserts.length - 1]
  assert.equal(
    latest.status, 'pending_payment',
    `${latest.file} inserts status "${latest.status}", but complete_pos_sale only settles ` +
    "status='pending_payment'. A hand-off would strand its own transaction forever.",
  )
})

test('no migration reintroduces a status POS can never settle', () => {
  // 20260707132730 is the known historical offender: it inserted `pending`,
  // which nothing can settle. Migrations are immutable history, so the file
  // stays. What must not happen is a SECOND one appearing, or the offender
  // being copied forward into a newer migration.
  const KNOWN_HISTORICAL = '20260707132730_queue_production_schema_cache_fix.sql'
  const offenders = transactionInserts().filter((i) => i.status && i.status !== 'pending_payment')
  const unexpected = offenders.filter((o) => o.file !== KNOWN_HISTORICAL)
  assert.deepEqual(
    unexpected.map((o) => `${o.file}:${o.status}`), [],
    'only the known 20260707132730 offender may exist; any other unsettleable insert is a regression',
  )
  // And it must be superseded, not current: a later migration must fix it.
  const laterFix = transactionInserts().some((i) => i.file > KNOWN_HISTORICAL && i.status === 'pending_payment')
  assert.ok(laterFix, 'a later migration must re-insert with a settleable status')
})

test('complete_pos_sale settles exactly the status the hand-off creates', () => {
  const settle = read('supabase/migrations/20260819081507_complete_pos_sale_settle_txn.sql')
  assert.match(
    settle, /update\s+public\.transactions/,
    'complete_pos_sale must settle the transaction it is completing',
  )
  assert.match(
    settle, /t\.status\s*=\s*'pending_payment'/,
    "the settle predicate must name the same status the hand-off inserts",
  )
  // A settle that matches more than it should would silently mark unpaid
  // hand-offs as paid. Pin the predicate exactly.
  assert.match(settle, /where\s+t\.status\s*=\s*'pending_payment'\s*\n\s*and\s+t\.pos_handoff_id\s*=/,
    'the settle must be scoped to status AND the handoff being paid')
})

test('the audit reconciles transactions against handoffs instead of calling the table dead', () => {
  const audit = read('scripts/audit-db-deep.mjs')
  // Strip comments first: the audit's own explanation of why the earlier
  // "dead ledger" claim was wrong necessarily repeats the phrase.
  const code = audit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /dead ledger/i,
    'the audit must not claim `transactions` is dead; complete_pos_sale writes to it')
  assert.doesNotMatch(code, /No source file reads `transactions`/,
    'the stale justification must not come back')
  assert.match(code, /handoff completed but its transaction never settled/,
    'the audit must reconcile handoff status against transaction status')
  assert.match(code, /pending_payment/,
    'the audit must know which transaction status is settleable')
})

test('the read-only probe stays read-only', () => {
  const probe = read('scripts/probe-transactions.mjs')
  for (const re of [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(\s*\)\s*(?!\.)/]) {
    assert.ok(!re.test(probe), `probe must stay read-only — found ${re}`)
  }
})