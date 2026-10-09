/**
 * `probe-stranded-handoffs.mjs` exists to answer one question: is a stranded POS
 * hand-off September seed data (and therefore in scope for the wipe) or real
 * revenue (and therefore must not be touched)? It answers that with two seed
 * markers, and one of them has been silently broken.
 *
 * It selected `name` from `customers`. That column does not exist — verified
 * live against production on 2026-10-09:
 *
 *   select id, email, name from customers
 *   -> ERROR: column customers.name does not exist
 *
 * PostgREST returns `{ data: null, error }` rather than throwing, and the probe
 * never printed the error. So `c` was always null, the customer marker always
 * evaluated false, and every customer printed `MISSING`. The verdict still
 * happened to be right for these two rows because the *plate* marker carried it,
 * which is exactly how a broken check survives: the answer was right for the
 * wrong reason, and a hand-off whose plate looked real but whose customer was
 * seeded would have been misclassified as real.
 *
 * A probe whose output feeds a destructive cleanup decision has to fail loudly
 * on a bad read. That is what these assertions pin.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const CODE = read('scripts/probe-stranded-handoffs.mjs')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

test('the probe reads columns that exist', () => {
  // `customers.full_name` is the real column. Selecting `name` returns
  // `{ data: null, error }` and silently blanks the customer marker.
  assert.match(
    CODE,
    /\.select\('id, email, full_name'\)/,
    'the customer read must select full_name, the column that actually exists',
  )
  assert.doesNotMatch(
    CODE,
    /customers[\s\S]{0,80}select\([^)]*\bname\b/,
    'the probe must not select a bare `name` column that does not exist',
  )
})

test('a failed read aborts the probe instead of printing MISSING', () => {
  // A null `c` must be an error, not evidence. Otherwise "customer: MISSING"
  // reads as a finding when it only means "the query failed".
  assert.match(
    CODE,
    /function readOrFail\(/,
    'the probe needs a read helper that surfaces the PostgREST error',
  )
  assert.match(
    CODE,
    /throw new Error\([^)]*error\.message/s,
    'the helper must raise with the PostgREST message, not swallow it',
  )
  // Every read that feeds a verdict goes through it. The customer read is the
  // one that was silently failing, so it is pinned explicitly. Matched on the
  // helper's own argument rather than on the text *after* `.from('customers')`:
  // the call is wrapped from the outside, so a window anchored to the table
  // name never sees it.
  assert.match(
    CODE,
    /readOrFail\(\s*'customers'/,
    'the customer read must go through the error-raising helper',
  )
  assert.match(
    CODE,
    /readOrFail\(\s*'bookings'/,
    'the booking read must go through it too',
  )
  assert.doesNotMatch(
    CODE,
    /MISSING/,
    'a failed read must abort, not render as a missing row',
  )
})

test('the probe stays read-only', () => {
  // Its verdict decides what a destructive wipe may delete, so it must be
  // incapable of deleting anything itself.
  for (const re of [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(\s*\)\s*(?!\.)/]) {
    assert.ok(!re.test(CODE), `probe-stranded-handoffs.mjs must stay read-only — found ${re}`)
  }
})