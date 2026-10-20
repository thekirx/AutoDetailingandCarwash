/**
 * Daily sheet money formulas (FOrmulas.md, 19 Oct 2026).
 * One module so the sheet, the slip, and the server totals stay on the same rules.
 *
 * Total sales = every paid POS ticket.
 * Car wash / ceramic coating / ceramic tint / PPF = those service lines only (not coffee, merch, accessories).
 * Expenses = manual expense lines + crew salaries. Category and cash|GCash are required on expenses.
 * Cash advance given out is deducted from money left and is not an expense.
 * Cash advance paid back is added to money left and is not an expense.
 *
 * Cash left  = POS cash + CA paid back (cash) − expenses cash − salaries cash − CA given out (cash)
 * GCash left = POS GCash + CA paid back (GCash) − expenses GCash − salaries GCash − CA given out (GCash)
 * Expected drawer cash = opening float + cash left
 *   (float is the till at open; FOrmulas.md names cash left without float. Over/short still compares the count to the till.)
 */

export const REPORT_FAMILIES = Object.freeze([
  { id: 'car_wash', label: 'Car wash sales' },
  { id: 'coating', label: 'Ceramic coating sales' },
  { id: 'tint', label: 'Ceramic tint sales' },
  { id: 'ppf', label: 'Paint protection film sales' },
])

/** cash | gcash. Anything else is cash so old rows still hit the drawer. */
export function channelPaidFrom(line = {}) {
  return String(line?.paid_from || 'cash').toLowerCase() === 'gcash' ? 'gcash' : 'cash'
}

export function sumChannel(lines, channel) {
  return (lines || []).reduce((sum, line) => {
    if (channelPaidFrom(line) !== channel) return sum
    const n = Math.round(Number(line?.amount_minor) || 0)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

/**
 * @param {object} input amounts in minor units
 */
export function moneyLeft(input = {}) {
  const n = (v) => {
    const x = Math.round(Number(v) || 0)
    return Number.isFinite(x) ? x : 0
  }
  const cashLeftMinor =
    n(input.posCashMinor) +
    n(input.caRepayCashMinor) -
    n(input.expenseCashMinor) -
    n(input.salaryCashMinor) -
    n(input.caReleaseCashMinor)
  const gcashLeftMinor =
    n(input.posGcashMinor) +
    n(input.caRepayGcashMinor) -
    n(input.expenseGcashMinor) -
    n(input.salaryGcashMinor) -
    n(input.caReleaseGcashMinor)
  const opening = n(input.openingFloatMinor)
  return {
    cashLeftMinor,
    gcashLeftMinor,
    expectedCashMinor: opening + cashLeftMinor,
  }
}
