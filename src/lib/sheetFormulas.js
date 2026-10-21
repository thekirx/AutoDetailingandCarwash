/**
 * Daily sheet collection (Sir, 21 Oct 2026). These rules replace the morning-float
 * reading of FOrmulas.md. The sheet, the close slip, and the server totals share them.
 *
 * Total sales = paid POS − cash advances given out (every channel).
 * A cash advance is not an expense. It already came off total sales, and it also
 * leaves the channel that paid it so cash left / GCash left match the drawer.
 * Expenses = manual expenses + salaries. Profit = total sales − those expenses.
 * That means a cash advance lowers profit by lowering the sales figure, not by
 * sitting on the expense list. Salary is an expense, so it lowers profit once.
 *
 * Total cash transaction  = POS cash − salaries paid cash
 * Total GCash transaction = POS GCash − salaries paid GCash
 * Salary is not subtracted again when cash left / GCash left are built.
 *
 * Cash left  = total cash transaction + CA paid back (cash) − expenses cash − CA given (cash)
 * GCash left = total GCash transaction + CA paid back (GCash) − expenses GCash − CA given (GCash)
 * There is no morning float. Cash left is what gets collected.
 * Over / short = cash counted − cash left.
 *
 * Total credit/debit transaction = credit card + debit card + bank transfer.
 * Those stay in total sales and out of both drawers.
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
  const cashTransactionMinor = n(input.posCashMinor) - n(input.salaryCashMinor)
  const gcashTransactionMinor = n(input.posGcashMinor) - n(input.salaryGcashMinor)
  const cashLeftMinor =
    cashTransactionMinor +
    n(input.caRepayCashMinor) -
    n(input.expenseCashMinor) -
    n(input.caReleaseCashMinor)
  const gcashLeftMinor =
    gcashTransactionMinor +
    n(input.caRepayGcashMinor) -
    n(input.expenseGcashMinor) -
    n(input.caReleaseGcashMinor)
  return {
    cashTransactionMinor,
    gcashTransactionMinor,
    cashLeftMinor,
    gcashLeftMinor,
    expectedCashMinor: cashLeftMinor,
  }
}
