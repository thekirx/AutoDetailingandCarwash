import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawerPaymentBucket, paymentBucket } from '../src/lib/paymentMethods.js'

/**
 * BUG-086 — the Daily Sheet's drawer cash test is a fourth payment_method map.
 *
 * BUG-081 replaced three disagreeing JavaScript maps with one canonical
 * vocabulary in paymentMethods.js. The SQL that stamps `totals` onto the sheet
 * kept its own, because nothing in that commit could see it:
 *
 *   lower(coalesce(payment_method, 'cash')) = 'cash'
 *
 * `coalesce` substitutes for NULL but passes '' straight through, and there is
 * no `trim()`. drawerPaymentBucket() treats a blank or padded method as cash.
 * So on these inputs the two disagree:
 *
 *   ''        JS cash · SQL not cash
 *   ' cash'   JS cash · SQL not cash
 *   'cash '   JS cash · SQL not cash
 *
 * cashMinor feeds expectedCashMinor feeds overShortMinor — the drawer
 * reconciliation. A disagreement means the Branch Admin counts a correct drawer
 * and is told it is short by exactly the amount that fell out of the sum, then
 * writes a note explaining a discrepancy that does not exist. That is BUG-081's
 * defect, in the one implementation BUG-081 did not reach.
 *
 * Reachability: every complete_pos_sale revision reads
 *   v_method text := coalesce(payload->>'payment_method', 'cash')
 * which likewise stores '' verbatim, and the function is security-definer, so
 * the client-side isAllowedPosPaymentMethod() guard does not protect it — a
 * direct rpc() call bypasses it, the same way BUG-071 bypassed the page gates.
 *
 * Measured on production 2026-10-10: 988 paid rows, payment_method only ever
 * 'cash' / 'gcash' / 'card'. No drift today. scripts/probe-payment-method-drift.mjs
 * re-checks it read-only. This is a latent hole, not a live miscount.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function body(name, file) {
  const raw = readFileSync(join(root, file), 'utf8')
  const sql = raw.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')
  const start = sql.indexOf(`create or replace function public.${name}`)
  assert.notEqual(start, -1, `${name} not found in ${file}`)
  const end = sql.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} body end not found in ${file}`)
  return sql.slice(start, end)
}

const ORIG = 'supabase/migrations/20261001090000_daily_sheet.sql'
const FIX = 'supabase/migrations/20261010170000_daily_sheet_cash_blank_is_cash.sql'

/** The function as originally shipped — history, and the shape the bug lived in. */
const totals = body('daily_sheet_server_totals', ORIG)
/** The function as it stands once BUG-086 is applied. */
const fixed = body('daily_sheet_server_totals', FIX)

const NORMALIZED = /lower\s*\(\s*coalesce\s*\(\s*nullif\s*\(\s*btrim\s*\(\s*payment_method\s*\)\s*,\s*''\s*\)\s*,\s*'cash'\s*\)\s*\)\s*=\s*'cash'/

describe('BUG-086: the sheet’s SQL cash test matches the JS drawer bucket', () => {
  it('the drawer is the only thing that implies a note, so it is the thing that must match', () => {
    assert.equal(drawerPaymentBucket('cash'), 'cash')
    assert.equal(drawerPaymentBucket(null), 'cash', 'absent means the money came in')
    assert.equal(drawerPaymentBucket(''), 'cash')
    assert.equal(drawerPaymentBucket('   '), 'cash')
    assert.equal(drawerPaymentBucket(' CASH '), 'cash')
    assert.equal(drawerPaymentBucket('gcash'), 'gcash')
    assert.equal(drawerPaymentBucket('wallet'), 'other', 'unrecognised must never inflate the drawer')
  })

  it('a recorded method that is not cash is not drawer cash — BUG-081 must not regress', () => {
    assert.equal(paymentBucket('wallet'), 'other')
    assert.equal(paymentBucket('online'), 'bank')
    assert.equal(paymentBucket('bank'), 'bank')
  })

  it('the original function is left alone — history is not edited', () => {
    // The defect lives in the applied migration. Rewriting it would make the
    // repo disagree with the database, so the fix ships as a replacement and
    // this assertion stops anyone "tidying up" the old body and losing the fix.
    assert.match(totals, /lower\s*\(\s*coalesce\s*\(\s*payment_method\s*,\s*'cash'\s*\)\s*\)\s*=\s*'cash'/)
    assert.doesNotMatch(totals, NORMALIZED, 'the original must stay as history; the fix is the replacement')
  })

  it('the replacement strips padding before comparing', () => {
    // Without btrim, ' cash' counts on screen and vanishes from cashMinor.
    assert.match(fixed, /btrim\s*\(\s*payment_method\s*\)/, 'the SQL cash filter must btrim payment_method')
    assert.match(fixed, NORMALIZED, 'the SQL cash filter must match the JS drawer bucket')
  })

  it('the SQL treats a blank method as cash, because coalesce alone does not', () => {
    // coalesce(x,'cash') returns '' for ''. btrim handles padding. But the blank
    // must map ONTO 'cash', not onto NULL: nullif(...)=NULL would leave
    // lower(NULL) = 'cash' as NULL, which is not TRUE and would exclude the row
    // anyway -- the same bug wearing a fix's clothing. Hence the outer coalesce.
    assert.match(
      fixed,
      /coalesce\s*\(\s*nullif\s*\(\s*btrim\s*\(\s*payment_method\s*\)\s*,\s*''\s*\)\s*,\s*'cash'\s*\)/,
      'the blank must resolve to cash, not to NULL',
    )
  })

  it('the SQL never maps a blank to NULL, which would exclude the row anyway', () => {
    // Guards the guard: an expression that normalises to NULL instead of to cash
    // still drops blank rows, so assert the outer coalesce is really there.
    assert.doesNotMatch(
      fixed,
      /nullif\s*\([^)]*payment_method[^)]*\)\s*=\s*'cash'/,
      'a nullif result compared directly to cash can never equal it',
    )
  })

  it('the filter still reads only paid rows, or blank-mapping would over-credit the drawer', () => {
    assert.match(fixed, /filter\s*\(\s*where\s+status\s*=\s*'paid'/)
  })

  it('an unrecognised recorded method still falls out — BUG-081 must not regress', () => {
    // The whole point of `other`. This change is about blank and padding, never
    // about making every method count as cash.
    const cashFilter = fixed.slice(fixed.indexOf('filter ('), fixed.indexOf('into v_gross'))
    assert.match(cashFilter, /=\s*'cash'/)
    assert.doesNotMatch(cashFilter, /like\s+'%cash%'/i, 'a substring match would swallow cash register')
    assert.equal(paymentBucket('wallet'), 'other')
  })

  it('the guarded replacement carries the fix', () => {
    const fix = readFileSync(join(root, FIX), 'utf8')
    assert.match(fix, /create or replace function public\.daily_sheet_server_totals/)
    assert.match(fix, NORMALIZED)
    // Each of these must match the EXPRESSION, not the key name. Asserting
    // `'overShortMinor'` alone passes even when the value is replaced with
    // null -- which is exactly what the revert-prove mutation did, and it
    // reported NOT PROVED because a presence check cannot fail on a value
    // change. create or replace silently drops or neuters whatever the new
    // text omits, so the computed results are what matter.
    for (const [label, re] of [
      ['net profit', /'netProfitMinor',\s*v_net - v_exp - v_sal/],
      ['expected cash', /'expectedCashMinor',\s*v_expected\b/],
      ['over/short', /'overShortMinor',\s*case when s\.counted_cash_minor is null then null else s\.counted_cash_minor - v_expected end/],
      ['cash advance release', /'caReleasedMinor',\s*v_rel\b/],
      ['cash advance repay', /'caRepaidMinor',\s*v_rep\b/],
      ['cash sales count', /'count',\s*v_count\b/],
    ]) {
      assert.match(fix, re, `the replacement no longer computes "${label}"`)
    }
  })
})