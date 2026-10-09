import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * BUG-066 — the September cleanup must not orphan the rows that point at a booking.
 *
 * The script runs its deletes with `session_replication_role = replica`, which
 * disables the FK triggers. That has a consequence worth stating plainly: a child
 * row neither blocks its parent from being deleted nor is cascaded away with it.
 * It is simply left pointing at a row that no longer exists. So every referencing
 * table has to be named explicitly and deleted *before* its parent.
 *
 * These assertions are about order, not mere presence. `pos_handoffs` appearing
 * anywhere in the file proves nothing; appearing after the booking delete is the
 * same defect with extra steps.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/** Comments are stripped first: prose naming the hazard satisfies a grep for it. */
const stripComments = (src) => src.replace(/--.*$/gm, '')

const WIPE = stripComments(read('scripts/seed/wipe-september-2026.sql'))

function migrations() {
  const dir = join(root, 'supabase', 'migrations')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, sql: readFileSync(join(dir, f), 'utf8') }))
}

/** Which columns does a migration ever name for `public.<table>`? */
function columnsNamedFor(table) {
  const cols = new Set()
  for (const { sql } of migrations()) {
    const re = new RegExp(
      String.raw`(?:insert\s+into|create\s+table(?:\s+if\s+not\s+exists)?)\s+(?:public\.)?${table}\s*\(([\s\S]*?)\n\s*\)?\s*;`,
      'gi',
    )
    let m
    while ((m = re.exec(sql))) {
      for (const raw of m[1].split(/[,\n]/)) {
        const c = raw.trim().split(/\s+/)[0]
        if (/^\w+$/.test(c) && !/^(primary|foreign|unique|check|constraint|references)$/i.test(c)) cols.add(c.toLowerCase())
      }
    }
  }
  return cols
}

const indexOf = (needle) => {
  const i = WIPE.indexOf(needle)
  assert.notEqual(i, -1, `the cleanup must contain: ${needle}`)
  return i
}

describe('the September cleanup deletes children before their parent', () => {
  it('removes hand-offs and their money rows before the bookings they point at', () => {
    const bookings = indexOf('delete from public.bookings')
    const handoffs = indexOf('delete from public.pos_handoffs')
    const transactions = indexOf('delete from public.transactions')
    const sales = indexOf('delete from public.sales')
    assert.ok(handoffs < bookings, 'pos_handoffs must be deleted before bookings, or the rows are stranded')
    assert.ok(transactions < bookings, 'transactions must be deleted before bookings')
    assert.ok(sales < bookings, 'sales must be deleted before bookings')
    // transactions carries the money, so it goes first of all.
    assert.ok(transactions < handoffs, 'a transaction may reference its hand-off, so money goes first')
  })

  it('runs in replica mode, which is exactly why the order matters', () => {
    // Without this the ordering assertions would be about a non-existent hazard.
    assert.match(WIPE, /set local session_replication_role = replica/)
    // And the deletes must be inside that window, not after the mode is restored.
    const replica = WIPE.indexOf('session_replication_role = replica')
    const origin = WIPE.indexOf('session_replication_role = origin')
    const bookings = indexOf('delete from public.bookings')
    assert.ok(replica < bookings && bookings < origin, 'bookings must be deleted inside the replica window')
  })

  it('derives hand-offs and money rows from the seed bookings, not only from a tag', () => {
    // A row the seed failed to tag is still residue; matching only `notes` orphans it.
    assert.match(WIPE, /create temp table seed_handoffs[\s\S]*?booking_id in \(select id from seed_bookings\)/)
    assert.match(WIPE, /create temp table seed_transactions[\s\S]*?booking_id in \(select id from seed_bookings\)/)
    assert.match(WIPE, /create temp table seed_transactions[\s\S]*?pos_handoff_id in \(select id from seed_handoffs\)/)
  })

  it('refuses to commit if anything would be left pointing at a deleted booking', () => {
    assert.match(WIPE, /raise exception/, 'the cleanup must be able to abort')
    assert.match(WIPE, /stranded/i, 'the abort must say what it found')
    // The guard has to run before the commit, or it cannot protect anything.
    const guard = WIPE.indexOf('raise exception')
    const commit = WIPE.lastIndexOf('commit;')
    assert.ok(guard > -1 && commit > guard, 'the guard must precede the commit')
    // And it must actually gate on a count, not just be present.
    assert.match(WIPE, /if stranded_handoffs > 0 or stranded_transactions > 0 or stranded_sales > 0 then/)
  })
})

describe('the columns the cleanup relies on really exist', () => {
  // A wrong column name does not fail loudly at authoring time — it fails the
  // owner's cleanup at run time, after the seed rows are already gone.
  it('pos_handoffs and transactions really carry booking_id / pos_handoff_id', () => {
    const handoffCols = columnsNamedFor('pos_handoffs')
    assert.ok(handoffCols.has('booking_id'), 'pos_handoffs.booking_id must exist — the cleanup filters on it')
    const txnCols = columnsNamedFor('transactions')
    assert.ok(txnCols.has('booking_id'), 'transactions.booking_id must exist')
    assert.ok(txnCols.has('pos_handoff_id'), 'transactions.pos_handoff_id must exist — the cleanup filters on it')
    const saleCols = columnsNamedFor('sales')
    assert.ok(saleCols.has('booking_id'), 'sales.booking_id must exist — the cleanup filters on it')
    assert.ok(saleCols.has('pos_handoff_id'), 'sales.pos_handoff_id must exist — the cleanup filters on it')
  })
})