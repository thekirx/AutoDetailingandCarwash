import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summarizeSheetSales, computeSheetTotals } from '../src/lib/dailySheet.js'
import { rollupSales } from '../src/lib/salesSummary.js'
import { normalizePaymentMethod, aggregateSalesFinancials, paymentBucket } from '../src/lib/paymentMethods.js'

/**
 * BUG-081 — the drawer reconciliation could tell a Branch Admin their correct
 * drawer was short.
 *
 * There are three independent implementations of "what payment method is this":
 *
 *   paymentMethods.js  normalizePaymentMethod  -> cash | gcash | card
 *   dailySheet.js      METHOD_OF               -> cash | gcash | card | bank
 *   salesSummary.js    METHOD_BUCKET           -> cash | gcash | card | other
 *
 * and they disagree:
 *
 *   'bank'    -> card   | bank   | other
 *   'online'  -> card   | bank   | card
 *   'wallet'  -> cash   | cash   | other
 *   'CASH'    -> cash   | cash   | other    (salesSummary never lowercases)
 *
 * The money bug is the shared `|| 'cash'` fallback in dailySheet.js:
 *
 *   byMethod[METHOD_OF[...] || 'cash'] += amount(s.total_minor)
 *
 * Anything unrecognised is counted as CASH, and cashMinor feeds
 * expectedCashMinor, which feeds overShortMinor. `posSettings.js` lets an
 * admin configure payment methods of their own naming, so this is reachable in
 * production, not theoretical. A wallet sale that never touched the drawer
 * makes the sheet expect money that was never there, and the BA — whose
 * count is correct — is told the drawer is short by exactly that amount.
 *
 * dailySheet.js opens with "POS and Finance both read these, so their numbers
 * cannot disagree". The mechanism by which they disagree was the private map.
 *
 * The rules below are the ones that actually protect the drawer:
 *
 *   1. Money is CASH only when the stored method says so. Unknown means
 *      unknown, never "cash" — cash is the one bucket that implies a note in
 *      the drawer, so a fallback into it invents money.
 *   2. One sale cannot be in two buckets. The Daily Sheet and the Finance
 *      summary are the two screens the owner reconciles against each other.
 *   3. Casing is not data. 'CASH' and 'cash' are the same method.
 */

const sale = (payment_method, total_minor = 100000) => ({ status: 'paid', payment_method, total_minor })

describe('an unrecognised payment method is never counted as cash in the drawer', () => {
  // Deliberately NOT including '', null, undefined, 'CASH' or 'Cash '.
  //
  // A missing payment_method on a paid sale is a different question from a
  // method nobody recognises. `posSale.js` itself defaults to 'cash', the shop
  // is cash-first, and some money demonstrably came in — so defaulting a
  // MISSING method to cash keeps the drawer math honest. What must never happen
  // is a method that was recorded and is not recognised being called cash:
  // that invents a note in the drawer that was never there.
  //
  // Casing and stray whitespace are not data either. 'CASH' and 'Cash ' are the
  // same method and must still count as cash.
  const unknowns = ['wallet', 'other', 'maya', 'bank_transfer_v2', 'coins', 'cheque', 'bdo', 'xyz']

  it('the Daily Sheet does not put an unknown method in the cash bucket', () => {
    for (const method of unknowns) {
      const { byMethod } = summarizeSheetSales([sale(method)])
      assert.equal(
        byMethod.cash,
        0,
        `${JSON.stringify(method)} was counted as ₱1,000.00 of cash in the drawer`,
      )
    }
  })

  it('casing and whitespace are not data — real cash still counts as cash', () => {
    for (const method of ['CASH', 'Cash', 'Cash ', ' cash', 'cAsH']) {
      const { byMethod } = summarizeSheetSales([sale(method)])
      assert.equal(byMethod.cash, 100000, `${JSON.stringify(method)} should be cash`)
    }
  })

  it('an unknown method does not move expectedCash at all', () => {
    // The drawer-count comparison is the whole point of the sheet. If an unknown
    // method cannot inflate expectedCash, a BA whose count is right is never
    // told the drawer is short.
    for (const method of unknowns) {
      const t = computeSheetTotals({
        sales: [sale(method)],
        lines: [],
        openingFloatMinor: 0,
        countedCashMinor: 0,
      })
      assert.equal(
        t.expectedCashMinor,
        0,
        `${JSON.stringify(method)} invented ₱1,000.00 of expected drawer cash`,
      )
      assert.equal(t.overShortMinor, 0, `${JSON.stringify(method)} reported a false over/short`)
    }
  })

  it('real cash is still counted as cash — the fix must not empty the drawer', () => {
    const t = computeSheetTotals({
      sales: [sale('cash'), sale('CASH'), sale('Cash')],
      lines: [],
      openingFloatMinor: 50000,
      countedCashMinor: 300000,
    })
    assert.equal(t.byMethod.cash, 300000, 'three ₱1,000.00 cash sales are ₱3,000.00 of drawer cash')
    assert.equal(t.expectedCashMinor, 300000, 'three ₱1,000.00 cash sales are the cash to collect — no morning float')
    assert.equal(t.overShortMinor, 0, 'a correctly counted drawer must reconcile to zero')
  })

  it('a sale with no recorded method still counts as cash, as the POS default says', () => {
    for (const method of ['', null, undefined]) {
      const t = computeSheetTotals({
        sales: [{ status: 'paid', total_minor: 100000, payment_method: method }],
        lines: [],
        openingFloatMinor: 0,
        countedCashMinor: 100000,
      })
      assert.equal(
        t.expectedCashMinor,
        100000,
        `${JSON.stringify(method)}: a sale with no method recorded must still reconcile against a real drawer`,
      )
      assert.equal(t.overShortMinor, 0)
    }
  })
})

describe('the Daily Sheet and the Finance summary cannot disagree about a sale', () => {
  const METHODS = ['cash', 'gcash', 'card', 'online', 'bank', 'transfer', 'credit', 'debit', 'wallet', 'CASH', 'Cash']

  it('no payment method lands in a different bucket on each surface', () => {
    for (const method of METHODS) {
      const sheet = summarizeSheetSales([sale(method)]).byMethod
      const fin = rollupSales([sale(method)]).byMethod

      // Compare against the shared bucket vocabulary. bank/other collapse to
      // "not a drawer method" on both sides so the comparison is about the
      // disagreement, not about how many display rows each screen has.
      const norm = (b) => ({
        cash: b.cash || 0,
        gcash: b.gcash || 0,
        // dailySheet: card + bank. finance: card + other.
        nonCashSettled: (b.card || 0) + (b.bank || 0) + (b.other || 0),
      })
      assert.deepEqual(
        norm(sheet),
        norm(fin),
        `${JSON.stringify(method)} is bucketed differently by the sheet and the finance summary`,
      )
    }
  })

  it('the Daily Sheet places every sale in the bucket the one normalizer names', () => {
    // paymentBucket is the canonical 5-bucket vocabulary. normalizePaymentMethod
    // is the historical 3-bucket projection floor financials still report, so it
    // is NOT the right reference here — asserting against it would have forced
    // the sheet to collapse 'bank' into 'card' and lose the distinction the drawer
    // does not care about but the slip does print.
    for (const method of METHODS) {
      const canonical = paymentBucket(method)
      const sheet = summarizeSheetSales([sale(method)]).byMethod
      assert.equal(
        sheet[canonical] || 0,
        100000,
        `${JSON.stringify(method)} should land in "${canonical}" but the sheet put it elsewhere`,
      )
      // And nothing may sit in a bucket the normalizer did not name.
      const stray = Object.entries(sheet).filter(([id, v]) => v && id !== canonical)
      assert.deepEqual(stray, [], `${JSON.stringify(method)} also landed in ${stray.map(([id]) => id).join(', ')}`)
    }
  })

  it('the 3-bucket projection never calls a non-cash method cash', () => {
    // This is the property floor financials actually depend on: the projection
    // may collapse bank/other into card, but it must never invent drawer cash.
    // GCash is its own bucket — it is a wallet, not a card terminal.
    assert.equal(normalizePaymentMethod('gcash'), 'gcash')
    assert.equal(normalizePaymentMethod('g-cash'), 'gcash')
    for (const method of ['card', 'online', 'bank', 'transfer', 'credit', 'debit', 'wallet', 'cheque']) {
      assert.equal(normalizePaymentMethod(method), 'card', `${method} projected to the wrong bucket`)
    }
    for (const method of ['cash', 'CASH', 'Cash ', '']) {
      assert.equal(normalizePaymentMethod(method), 'cash', `${JSON.stringify(method)} should be cash`)
    }
  })

  it('floor financials agree with the Daily Sheet on what is cash', () => {
    for (const method of METHODS) {
      const fin = aggregateSalesFinancials([sale(method)])
      const sheet = summarizeSheetSales([sale(method)]).byMethod
      assert.equal(
        fin.cash_sales_minor,
        sheet.cash || 0,
        `${JSON.stringify(method)}: floor financials and the daily sheet disagree on cash`,
      )
    }
  })
})

describe('an unknown method is visible as unknown, not silently absorbed', () => {
  it('it still appears somewhere, so the money is never simply lost', () => {
    // The alternative to "cash" must not be "nowhere" — that would make the
    // sheet's method rows stop summing to net sales.
    const t = summarizeSheetSales([sale('wallet')])
    const bucketTotal = Object.values(t.byMethod).reduce((s, v) => s + v, 0)
    assert.equal(bucketTotal, t.netMinor, 'the method buckets must account for every peso of net sales')
  })
})