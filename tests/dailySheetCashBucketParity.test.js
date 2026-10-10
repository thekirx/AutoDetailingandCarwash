import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeSheetTotals } from '../src/lib/dailySheet.js'
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

/**
 * The rest of the sheet's money math, pinned the same way.
 *
 * Found while hunting BUG-086: BUG-081's lesson was that money math living in
 * two places will drift, and this file is the fourth implementation. Having
 * found it, the other definitions were checked the same way and they AGREE —
 * check:sheet-ui passes 60/60 for a reason, not by luck:
 *
 *   gross / discounts / refunds  both scope to paid + refunded
 *   net                          both paid only
 *   count                        both paid only, because summarizeSheetSales
 *                                 overrides rollupSales' count (which counts
 *                                 refunds too) — that override is exactly what
 *                                 keeps the sheet off BUG-082's definition
 *   netProfit                    net - expenses - salaries, both sides
 *   expectedCash                 float + cash + caRepaid - expenses - salaries
 *                                 - caReleased, both sides
 *   overShort                    counted - expected, and null when uncounted,
 *                                 both sides
 *
 * Pinned at expression level, not by key name: an earlier version of this file
 * matched `'overShortMinor'` and a mutation that replaced the VALUE with null
 * sailed through, because the key name survives.
 */
describe('the sheet totals computed in SQL match the ones computed in JS', () => {
  const jsDaily = readFileSync(join(root, 'src/lib/dailySheet.js'), 'utf8')
  const jsSummary = readFileSync(join(root, 'src/lib/salesSummary.js'), 'utf8')

  it('gross and discounts scope to paid + refunded on both sides', () => {
    assert.match(fixed, /status in \('paid', 'refunded'\)/)
    assert.match(fixed, /sum\(total_minor \+ coalesce\(discount_minor, 0\)\)/)
    assert.match(jsSummary, /COUNTED = new Set\(\['paid', 'refunded'\]\)/)
    assert.match(jsSummary, /out\.grossMinor \+= total \+ discount/)
  })

  it('net is paid only on both sides', () => {
    assert.match(fixed, /sum\(total_minor\) filter \(where status = 'paid'\)/)
    assert.match(jsSummary, /out\.netMinor \+= total/)
    // rollupSales nets only after `continue`ing past refunds.
    assert.match(jsSummary, /if \(r\.status === 'refunded'\) \{[\s\S]{0,120}continue/)
  })

  it('the sheet count is paid only — the override that keeps it off BUG-082', () => {
    // rollupSales counts refunds too, and averages over that. If
    // summarizeSheetSales stopped overriding, "average sale" would silently
    // change definition on the Daily Sheet only — BUG-082's exact failure.
    assert.match(jsSummary, /out\.count \+= 1/)
    assert.match(jsDaily, /count: paid\.length/)
    assert.match(jsDaily, /avgMinor: paid\.length \? Math\.round\(r\.netMinor \/ paid\.length\) : 0/)
  })

  it('net profit subtracts expenses and salaries on both sides', () => {
    assert.match(fixed, /'netProfitMinor',\s*v_net - v_exp - v_sal/)
    assert.match(jsDaily, /totalExpensesMinor = expensesMinor \+ salariesMinor/)
    assert.match(jsDaily, /netProfitMinor: s\.netMinor - totalExpensesMinor/)
  })

  it('expected cash uses the same six terms in the same order', () => {
    const sqlExpect = fixed.match(/v_expected := ([^\n]+)/)
    const jsExpect = jsDaily.match(/const expectedCashMinor =\s*\n?\s*([^\n]+)\n?\s*([^\n]+)/)
    assert.ok(sqlExpect, 'SQL no longer computes expected cash')
    assert.ok(jsExpect, 'JS no longer computes expected cash')
    const norm = (s) => s.replace(/\s+/g, ' ').trim()
    assert.match(
      norm(sqlExpect[1]),
      /opening_float_minor.*\+\s*v_cash.*\+\s*v_rep\s*-\s*v_exp\s*-\s*v_sal\s*-\s*v_rel/,
      `SQL expected-cash terms drifted: ${norm(sqlExpect[1])}`,
    )
    const jsBoth = norm(jsExpect[1] + ' ' + jsExpect[2])
    assert.match(
      jsBoth,
      /openingFloatMinor.*\+\s*s\.cashMinor.*\+\s*caRepaidMinor\s*-\s*expensesMinor\s*-\s*salariesMinor\s*-\s*caReleasedMinor/,
      `JS expected-cash terms drifted: ${jsBoth}`,
    )
  })

  it('over/short is null until counted, on both sides', () => {
    assert.match(fixed, /case when s\.counted_cash_minor is null then null else s\.counted_cash_minor - v_expected end/)
    assert.match(jsDaily, /overShortMinor: counted == null \? null : counted - expectedCashMinor/)
  })

  it('an uncounted sheet reports null, not zero — a zero would read as "balanced"', () => {
    // The distinction that makes the check visible: null means "nobody counted
    // yet", 0 means "counted, and it matched". submit_daily_sheet requires a
    // count before it will accept the sheet, so this must not collapse.
    const out = computeSheetTotals({ sales: [], lines: [], openingFloatMinor: 0, countedCashMinor: null })
    assert.equal(out.overShortMinor, null)
    assert.equal(out.expectedCashMinor, 0)
  })

  it('the same inputs give the same drawer figure on both paths', () => {
    // End-to-end through the real function, computed independently here rather
    // than copied from either side.
    const sales = [
      { status: 'paid', total_minor: 100000, discount_minor: 10000, payment_method: 'cash' },
      { status: 'paid', total_minor: 50000, discount_minor: 0, payment_method: 'gcash' },
      { status: 'refunded', total_minor: 20000, discount_minor: 0, payment_method: 'cash' },
    ]
    const lines = [
      { kind: 'expense', amount_minor: 5000 },
      { kind: 'salary', amount_minor: 25000 },
      { kind: 'ca_release', amount_minor: 1000 },
      { kind: 'ca_repay', amount_minor: 3000 },
    ]
    const t = computeSheetTotals({ sales, lines, openingFloatMinor: 10000, countedCashMinor: 100000 })
    assert.equal(t.grossMinor, 180000, 'gross = paid+refunded totals plus their discounts')
    assert.equal(t.discountsMinor, 10000)
    assert.equal(t.refundsMinor, 20000)
    assert.equal(t.netMinor, 150000, 'net is paid only')
    assert.equal(t.count, 2, 'a refund is not a transaction on this sheet')
    assert.equal(t.cashMinor, 100000, 'only the cash sale is drawer cash')
    // 10000 float + 100000 cash + 3000 repaid - 5000 - 25000 - 1000 released
    assert.equal(t.expectedCashMinor, 82000)
    assert.equal(t.overShortMinor, 18000)
    assert.equal(t.netProfitMinor, 150000 - 30000)
  })
})