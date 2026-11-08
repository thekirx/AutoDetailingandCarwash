import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeSheetTotals,
  sheetChecklist,
  formatAccounting,
  mergeSalarySuggestions,
  filterSheets,
  groupSheetsByPeriod,
  floorMoneyBreakdown,
  toSheetPayloadLines,
} from '../src/lib/dailySheet.js'
import { moneyLeft, channelPaidFrom, sumChannel } from '../src/lib/sheetFormulas.js'
import {
  buildBacoorDailyReport,
  emptyBacoorDailyReport,
  formatBacoorReportText,
} from '../src/lib/bacoorDailyReport.js'
import {
  calendarPeriod,
  buildComparePeriods,
  plByPeriods,
  plByBranches,
} from '../src/lib/financeBooks.js'
import { splitCashGcash } from '../src/lib/posSale.js'

describe('Finance Edge Cases & Architecture Verification', () => {
  describe('1. Split-Payment Integrity (Cash + GCash)', () => {
    it('validates exact split tender when cash + gcash = total', () => {
      const res = splitCashGcash({
        cashMinor: 50000,
        gcashMinor: 30000,
        totalMinor: 80000,
      })
      assert.equal(res.ok, true)
      assert.equal(res.paymentMethod, 'split')
      assert.equal(res.cashMinor, 50000)
      assert.equal(res.gcashMinor, 30000)
    })

    it('rejects split tender when cash is 0 or negative', () => {
      const res1 = splitCashGcash({
        cashMinor: 0,
        gcashMinor: 80000,
        totalMinor: 80000,
      })
      assert.equal(res1.ok, false)
      assert.match(res1.error, /Use one payment method when the other amount is zero/i)

      const res2 = splitCashGcash({
        cashMinor: -100,
        gcashMinor: 80100,
        totalMinor: 80000,
      })
      assert.equal(res2.ok, false)
      assert.match(res2.error, /Enter the cash amount and the GCash amount/i)
    })

    it('rejects split tender when sum does not equal total', () => {
      const res = splitCashGcash({
        cashMinor: 50000,
        gcashMinor: 40000,
        totalMinor: 80000,
      })
      assert.equal(res.ok, false)
      assert.match(res.error, /add up to the ticket/i)
    })
  })

  describe('2. Multi-Channel Daily Sheet Arithmetic (Cash vs GCash)', () => {
    it('accurately isolates cash vs gcash across sales, expenses, salaries, releases, and repayments', () => {
      const sales = [
        { status: 'paid', payment_method: 'cash', total_minor: 100000 },
        { status: 'paid', payment_method: 'gcash', total_minor: 50000 },
        { status: 'paid', payment_method: 'card', total_minor: 30000 },
        { status: 'paid', payment_method: 'split', cash_minor: 20000, gcash_minor: 10000, total_minor: 30000 },
      ]

      const lines = [
        // Cash expense ₱100
        { kind: 'expense', amount_minor: 10000, paid_from: 'cash', description: 'Soap', account_id: 'acc-1' },
        // GCash expense ₱50
        { kind: 'expense', amount_minor: 5000, paid_from: 'gcash', description: 'Permit fee', account_id: 'acc-2' },
        // Cash salary ₱300
        { kind: 'salary', amount_minor: 30000, paid_from: 'cash', staff_id: 'st-1', suggested_minor: 30000 },
        // GCash salary ₱150
        { kind: 'salary', amount_minor: 15000, paid_from: 'gcash', staff_id: 'st-2', suggested_minor: 15000 },
        // CA Release Cash ₱200
        { kind: 'ca_release', amount_minor: 20000, paid_from: 'cash', staff_id: 'st-3' },
        // CA Release GCash ₱100
        { kind: 'ca_release', amount_minor: 10000, paid_from: 'gcash', staff_id: 'st-4' },
        // CA Repayment Cash ₱50
        { kind: 'ca_repay', amount_minor: 5000, paid_from: 'cash', staff_id: 'st-5' },
        // CA Repayment GCash ₱80
        { kind: 'ca_repay', amount_minor: 8000, paid_from: 'gcash', staff_id: 'st-6' },
      ]

      const totals = computeSheetTotals({ sales, lines, countedCashMinor: 65000 })

      // Sales breakdown
      // Total gross net: 100000 + 50000 + 30000 + 30000 = 210000
      // POS Cash = 100000 + 20000 = 120000
      // POS GCash = 50000 + 10000 = 60000
      // POS Card = 30000
      assert.equal(totals.netMinor, 210000)
      assert.equal(totals.cashMinor, 120000)
      assert.equal(totals.byMethod.gcash, 60000)
      assert.equal(totals.creditDebitMinor, 30000)

      // CA Released = 20000 + 10000 = 30000
      // Total Sales = Net Sales - CA Released = 210000 - 30000 = 180000
      assert.equal(totals.caReleasedMinor, 30000)
      assert.equal(totals.totalSalesMinor, 180000)

      // Expenses & Salaries
      assert.equal(totals.expensesMinor, 15000)
      assert.equal(totals.cashExpensesMinor, 10000)
      assert.equal(totals.gcashExpensesMinor, 5000)
      assert.equal(totals.salariesMinor, 45000)
      assert.equal(totals.salaryCashMinor, 30000)
      assert.equal(totals.salaryGcashMinor, 15000)
      assert.equal(totals.totalExpensesMinor, 60000)

      // Net profit = Total Sales (180000) - Total Expenses (60000) = 120000
      assert.equal(totals.netProfitMinor, 120000)

      // Channel Transactions:
      // Cash Transaction = POS Cash (120000) - Salary Cash (30000) = 90000
      // GCash Transaction = POS GCash (60000) - Salary GCash (15000) = 45000
      assert.equal(totals.cashTransactionMinor, 90000)
      assert.equal(totals.gcashTransactionMinor, 45000)

      // Money Left:
      // Cash Left = Cash Txn (90000) + CA Repay Cash (5000) - Exp Cash (10000) - CA Rel Cash (20000) = 65000
      // GCash Left = GCash Txn (45000) + CA Repay GCash (8000) - Exp GCash (5000) - CA Rel GCash (10000) = 38000
      assert.equal(totals.cashLeftMinor, 65000)
      assert.equal(totals.gcashLeftMinor, 38000)
      assert.equal(totals.expectedCashMinor, 65000)

      // Drawer Count reconciliation
      // Counted Cash = 65000 -> overShort = 0
      assert.equal(totals.countedCashMinor, 65000)
      assert.equal(totals.overShortMinor, 0)
    })

    it('verifies channelPaidFrom defaults legacy/blank to cash and sumChannel isolates totals', () => {
      assert.equal(channelPaidFrom({ paid_from: 'gcash' }), 'gcash')
      assert.equal(channelPaidFrom({ paid_from: 'GCash' }), 'gcash')
      assert.equal(channelPaidFrom({ paid_from: 'cash' }), 'cash')
      assert.equal(channelPaidFrom({}), 'cash')
      assert.equal(channelPaidFrom(null), 'cash')

      const sampleLines = [
        { paid_from: 'cash', amount_minor: 1000 },
        { paid_from: 'gcash', amount_minor: 2000 },
        { paid_from: null, amount_minor: 3000 },
      ]
      assert.equal(sumChannel(sampleLines, 'cash'), 4000)
      assert.equal(sumChannel(sampleLines, 'gcash'), 2000)
    })

    it('handles over and short cash drawer balances properly', () => {
      const left = moneyLeft({
        posCashMinor: 100000,
        salaryCashMinor: 20000,
        caRepayCashMinor: 5000,
        expenseCashMinor: 10000,
        caReleaseCashMinor: 15000,
      })
      // Expected = 100000 - 20000 + 5000 - 10000 - 15000 = 60000
      assert.equal(left.expectedCashMinor, 60000)

      // Counted 65000 -> over 5000
      const overSheet = computeSheetTotals({
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 100000 }],
        lines: [
          { kind: 'salary', amount_minor: 20000, paid_from: 'cash' },
          { kind: 'expense', amount_minor: 10000, paid_from: 'cash' },
          { kind: 'ca_release', amount_minor: 15000, paid_from: 'cash' },
          { kind: 'ca_repay', amount_minor: 5000, paid_from: 'cash' },
        ],
        countedCashMinor: 65000,
      })
      assert.equal(overSheet.overShortMinor, 5000)

      // Counted 55000 -> short 5000
      const shortSheet = computeSheetTotals({
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 100000 }],
        lines: [
          { kind: 'salary', amount_minor: 20000, paid_from: 'cash' },
          { kind: 'expense', amount_minor: 10000, paid_from: 'cash' },
          { kind: 'ca_release', amount_minor: 15000, paid_from: 'cash' },
          { kind: 'ca_repay', amount_minor: 5000, paid_from: 'cash' },
        ],
        countedCashMinor: 55000,
      })
      assert.equal(shortSheet.overShortMinor, -5000)

      // Uncounted -> null overShort
      const uncountedSheet = computeSheetTotals({
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 100000 }],
        lines: [],
        countedCashMinor: null,
      })
      assert.equal(uncountedSheet.overShortMinor, null)
    })
  })

  describe('3. Daily Sheet Checklist & Strict Validation', () => {
    it('blocks submission if cash is not counted', () => {
      const check = sheetChecklist({
        sheet: { counted_cash_minor: null },
        lines: [],
        sales: [],
      })
      assert.equal(check.canSubmit, false)
      assert.ok(check.missing.some((m) => m.includes('Count the cash')))
    })

    it('blocks submission if cash has over/short without an explanatory note', () => {
      const check = sheetChecklist({
        sheet: { counted_cash_minor: 70000, notes: '' },
        lines: [],
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 60000 }],
      })
      assert.equal(check.canSubmit, false)
      assert.ok(check.missing.some((m) => m.includes('add a note')))
    })

    it('allows submission when over/short is accompanied by a note', () => {
      const check = sheetChecklist({
        sheet: { counted_cash_minor: 70000, notes: 'Found ₱100 extra in coin compartment' },
        lines: [],
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 60000 }],
      })
      assert.equal(check.canSubmit, true)
    })

    it('blocks submission when salary line is changed from suggested without a reason', () => {
      const check = sheetChecklist({
        sheet: { counted_cash_minor: 50000 },
        lines: [
          { kind: 'salary', amount_minor: 40000, suggested_minor: 50000, reason: '', staff_id: 's1' },
        ],
        sales: [{ status: 'paid', payment_method: 'cash', total_minor: 50000 }],
      })
      assert.equal(check.canSubmit, false)
      assert.ok(check.missing.some((m) => m.includes('Add a reason for 1 changed salary')))
    })

    it('formats sheet payload lines for save_daily_sheet RPC', () => {
      const inputLines = [
        { kind: 'expense', amount_minor: 10000, description: 'Fuel', paid_from: 'cash', account_id: 'acc1' },
        { kind: 'salary', amount_minor: 25000, suggested_minor: 25000, staff_id: 'staff1', paid_from: 'cash' },
        { kind: 'unknown_kind', amount_minor: 500 }, // dropped
      ]
      const payloadLines = toSheetPayloadLines(inputLines)
      assert.equal(payloadLines.length, 2)
      assert.equal(payloadLines[0].kind, 'expense')
      assert.equal(payloadLines[0].paid_from, 'cash')
      assert.equal(payloadLines[1].kind, 'salary')
    })

    it('merges new salary suggestions preserving touched values', () => {
      const existing = [
        { kind: 'salary', staff_id: 's1', staff_name: 'Alden', suggested_minor: 20000, amount_minor: 25000, reason: 'Overtime' },
        { kind: 'salary', staff_id: 's2', staff_name: 'Bob', suggested_minor: 18000, amount_minor: 18000, reason: '' },
      ]
      const suggestions = [
        { staff_id: 's1', staff_name: 'Alden', role: 'staff', parts: {}, suggested_minor: 22000 },
        { staff_id: 's2', staff_name: 'Bob', role: 'staff', parts: {}, suggested_minor: 19000 },
        { staff_id: 's3', staff_name: 'Charlie', role: 'detailer', parts: {}, suggested_minor: 30000 },
      ]
      const merged = mergeSalarySuggestions(existing, suggestions)
      // s1 was modified (25000), keeps 25000
      const s1 = merged.find((l) => l.staff_id === 's1')
      assert.equal(s1.amount_minor, 25000)
      assert.equal(s1.suggested_minor, 22000)

      // s2 was untouched, updates to new suggestion (19000)
      const s2 = merged.find((l) => l.staff_id === 's2')
      assert.equal(s2.amount_minor, 19000)

      // s3 is new, added with suggestion
      const s3 = merged.find((l) => l.staff_id === 's3')
      assert.equal(s3.amount_minor, 30000)
    })
  })

  describe('4. Formatting, Filters & Floor Breakdown', () => {
    it('formats currency with peso sign and accounting parentheses', () => {
      assert.ok(formatAccounting(150050).includes('1,500.50'))
      assert.ok(formatAccounting(-250000).startsWith('('))
      assert.ok(formatAccounting(-250000).endsWith(')'))
      assert.ok(formatAccounting(0).includes('0.00'))
    })

    it('filters daily sheets by search text, submitter, and net bounds', () => {
      const sheets = [
        { business_date: '2026-10-20', branch: 'bacoor', submitted_by: 'user1', totals: { netProfitMinor: 100000 } },
        { business_date: '2026-10-21', branch: 'bacoor', submitted_by: 'user2', totals: { netProfitMinor: 50000 } },
        { business_date: '2026-10-22', branch: 'imus', submitted_by: 'user1', totals: { netProfitMinor: 200000 } },
      ]
      const f1 = filterSheets(sheets, { search: 'bacoor' })
      assert.equal(f1.length, 2)

      const f2 = filterSheets(sheets, { submitter: 'user2' })
      assert.equal(f2.length, 1)
      assert.equal(f2[0].business_date, '2026-10-21')

      const f3 = filterSheets(sheets, { minNet: '800' })
      assert.equal(f3.length, 2)
    })

    it('groups sheets into period buckets', () => {
      const sheets = [
        { business_date: '2026-10-15', status: 'approved', totals: { netProfitMinor: 50000 } },
        { business_date: '2026-10-16', status: 'submitted', totals: { netProfitMinor: 40000 } },
      ]
      const grouped = groupSheetsByPeriod(sheets, 'month')
      assert.equal(grouped.length, 1)
      assert.equal(grouped[0].key, '2026-10')
      assert.equal(grouped[0].count, 2)
      assert.equal(grouped[0].approved, 1)
      assert.equal(grouped[0].pending, 1)
    })

    it('computes floor money breakdown and KPIs', () => {
      const sales = [{ status: 'paid', branch: 'bacoor', total_minor: 100000, payment_method: 'cash' }]
      const priorSales = [{ status: 'paid', branch: 'bacoor', total_minor: 80000, payment_method: 'cash' }]
      const breakdown = floorMoneyBreakdown({ sales, priorSales })
      assert.equal(breakdown.totals.netMinor, 100000)
      assert.equal(breakdown.prior.netMinor, 80000)
      assert.equal(breakdown.byBranch.length, 1)
      assert.equal(breakdown.byBranch[0].branch, 'bacoor')
    })
  })

  describe('5. P&L Books Period Pivoting & Aggregation', () => {
    it('generates exact calendar months, quarters, and compare periods', () => {
      const monthPeriod = calendarPeriod('2026-10-15', 'month', 0)
      assert.equal(monthPeriod.start, '2026-10-01')
      assert.equal(monthPeriod.end, '2026-10-31')
      assert.equal(monthPeriod.label, 'Oct 2026')

      const quarterPeriod = calendarPeriod('2026-10-15', 'quarter', 0)
      assert.equal(quarterPeriod.start, '2026-10-01')
      assert.equal(quarterPeriod.end, '2026-12-31')
      assert.equal(quarterPeriod.label, 'Q4 2026')

      const compare = buildComparePeriods({ end: '2026-10-15', unit: 'month', count: 2 })
      assert.equal(compare.length, 3)
      assert.equal(compare[2].key, '2026-10')
      assert.equal(compare[1].key, '2026-09')
      assert.equal(compare[0].key, '2026-08')
    })

    it('pivots P&L income and expense rows across columns and branches accurately', () => {
      const plRows = [
        { branch: 'bacoor', period_date: '2026-10-05', kind: 'income', category: 'Car wash', amount_minor: 50000 },
        { branch: 'bacoor', period_date: '2026-10-12', kind: 'income', category: 'Ceramic coating', amount_minor: 120000 },
        { branch: 'imus', period_date: '2026-10-08', kind: 'expense', category: 'Chemicals', amount_minor: 30000 },
        { branch: 'bacoor', period_date: '2026-11-02', kind: 'income', category: 'Car wash', amount_minor: 60000 },
      ]

      const periods = [
        { key: '2026-10', start: '2026-10-01', end: '2026-10-31' },
        { key: '2026-11', start: '2026-11-01', end: '2026-11-30' },
      ]

      const pivoted = plByPeriods(plRows, periods)
      assert.equal(pivoted.totals.income[0], 170000)
      assert.equal(pivoted.totals.income[1], 60000)
      assert.equal(pivoted.totals.expenses[0], 30000)
      assert.equal(pivoted.totals.expenses[1], 0)
      assert.equal(pivoted.totals.net[0], 140000)
      assert.equal(pivoted.totals.net[1], 60000)

      const branches = ['bacoor', 'imus']
      const branchPivoted = plByBranches(plRows, branches)
      // Bacoor income = 50000 + 120000 + 60000 = 230000
      assert.equal(branchPivoted.totals.income[0], 230000)
      // Imus expense = 30000
      assert.equal(branchPivoted.totals.expenses[1], 30000)
    })
  })

  describe('6. Bacoor Report Text Generator & Multi-Branch Isolation', () => {
    it('produces empty report with default zero totals', () => {
      const empty = emptyBacoorDailyReport({ branch: 'bacoor' })
      assert.equal(empty.branch, 'bacoor')
      assert.equal(empty.total_sales_minor, 0)
      assert.equal(empty.total_expenses_minor, 0)
      assert.equal(empty.total_cash_left_minor, 0)
    })

    it('produces verified text breakdown with all financial buckets', () => {
      const report = buildBacoorDailyReport({
        branch: 'bacoor',
        branchDisplay: 'Bacoor Flagship',
        date: '2026-10-25',
        sales: [
          { status: 'paid', payment_method: 'cash', total_minor: 150000, service_slug: 'premium-wash', pay_category: 'wash' },
          { status: 'paid', payment_method: 'gcash', total_minor: 80000, service_slug: 'paint-protection-film', pay_category: 'ppf' },
        ],
        expenses: [
          { expense_kind: 'daily', amount_minor: 25000, label: 'Microfiber towels' },
        ],
        cashAdvances: [],
      })

      assert.equal(report.branch, 'Bacoor Flagship')
      assert.equal(report.total_sales_minor, 230000)
      assert.equal(report.total_gcash_minor, 80000)
      assert.equal(report.total_expenses_minor, 25000)
      assert.equal(report.cash_sales_minor, 150000)
      assert.equal(report.total_cash_left_minor, 150000 - 25000)

      const text = formatBacoorReportText(report, (n) => `₱${(n / 100).toFixed(2)}`)
      assert.ok(text.includes('BACOOR SALES REPORT'))
      assert.ok(text.includes('Square Sales: ₱2300.00'))
      assert.ok(text.includes('Total Expenses: ₱250.00'))
      assert.ok(text.includes('Total Cash Left: ₱1250.00'))
    })
  })
})
