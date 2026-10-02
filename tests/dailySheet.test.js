import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  summarizeSheetSales,
  suggestSalaries,
  computeSheetTotals,
  salaryLineNeedsReason,
  sheetChecklist,
  formatAccounting,
  hourlyNetSales,
  floorMoney,
} from '../src/lib/dailySheet.js'

const washLine = (total) => ({ item_type: 'service', line_total_minor: total, services: { name: 'Basic wash', slug: 'basic-wash', pay_category: 'carwash' } })
const coffeeLine = (total) => ({ item_type: 'product', line_total_minor: total, products: { name: 'Latte', tags: ['coffee'], category: 'coffee' } })

const SALES = [
  { id: 's1', status: 'paid', total_minor: 50000, discount_minor: 5000, payment_method: 'cash', occurred_at: '2026-10-01T02:00:00Z', sale_line_items: [washLine(55000)] },
  { id: 's2', status: 'paid', total_minor: 20000, discount_minor: 0, payment_method: 'gcash', occurred_at: '2026-10-01T05:30:00Z', sale_line_items: [coffeeLine(20000)] },
  { id: 's3', status: 'refunded', total_minor: 10000, discount_minor: 0, payment_method: 'card', occurred_at: '2026-10-01T06:00:00Z', sale_line_items: [coffeeLine(10000)] },
  { id: 's4', status: 'paid', total_minor: 30000, discount_minor: 0, payment_method: 'online', occurred_at: '2026-10-01T06:10:00Z', sale_line_items: [washLine(30000)] },
  { id: 'x', status: 'cancelled', total_minor: 99999, payment_method: 'cash' },
]

test('sales: gross before discounts, net = gross − discounts − refunds, avg = net ÷ transactions', () => {
  const s = summarizeSheetSales(SALES)
  assert.equal(s.grossMinor, 55000 + 20000 + 10000 + 30000)
  assert.equal(s.discountsMinor, 5000)
  assert.equal(s.refundsMinor, 10000)
  assert.equal(s.netMinor, s.grossMinor - s.discountsMinor - s.refundsMinor)
  assert.equal(s.netMinor, 100000)
  assert.equal(s.count, 3)
  assert.equal(s.avgMinor, Math.round(100000 / 3))
  assert.deepEqual(s.byMethod, { cash: 50000, gcash: 20000, card: 0, bank: 30000 })
  assert.equal(s.cashMinor, 50000)
  const fam = Object.fromEntries(s.byFamily.map((f) => [f.id, f.minor]))
  assert.equal(fam.car_wash, 85000)
  assert.equal(fam.coffee, 20000)
})

test('sales: empty day is all zeros, no NaN', () => {
  const s = summarizeSheetSales([])
  assert.equal(s.netMinor, 0)
  assert.equal(s.avgMinor, 0)
  assert.equal(s.byFamily.length, 0)
})

test('totals: profit excludes cash advances; expected cash and over/short', () => {
  const lines = [
    { kind: 'expense', description: 'Soap', account_id: 'a12', amount_minor: 5000 },
    { kind: 'salary', staff_id: 'c1', suggested_minor: 20000, amount_minor: 20000 },
    { kind: 'salary', staff_id: 't1', suggested_minor: 60000, amount_minor: 60000 },
    { kind: 'ca_release', staff_id: 'c1', amount_minor: 10000 },
    { kind: 'ca_repay', staff_id: 'c2', amount_minor: 3000 },
  ]
  const t = computeSheetTotals({ sales: SALES, lines, openingFloatMinor: 100000, countedCashMinor: 58000 })
  assert.equal(t.expensesMinor, 5000)
  assert.equal(t.salariesMinor, 80000)
  assert.equal(t.totalExpensesMinor, 85000)
  assert.equal(t.netProfitMinor, 100000 - 85000)
  assert.equal(t.caReleasedMinor, 10000)
  assert.equal(t.caRepaidMinor, 3000)
  // float 1000 + cash sales 500 + CA repaid 30 − expenses 50 − salaries 800 − CA released 100
  assert.equal(t.expectedCashMinor, 100000 + 50000 + 3000 - 5000 - 80000 - 10000)
  assert.equal(t.expectedCashMinor, 58000)
  assert.equal(t.overShortMinor, 0)
})

test('totals: over/short sign — counted below expected is short (negative)', () => {
  const t = computeSheetTotals({ sales: [], lines: [], openingFloatMinor: 50000, countedCashMinor: 49000 })
  assert.equal(t.expectedCashMinor, 50000)
  assert.equal(t.overShortMinor, -1000)
  const missing = computeSheetTotals({ sales: [], lines: [], openingFloatMinor: 50000, countedCashMinor: null })
  assert.equal(missing.overShortMinor, null)
})

test('salary reason: required only when amount differs from suggestion', () => {
  assert.equal(salaryLineNeedsReason({ kind: 'salary', suggested_minor: 100, amount_minor: 100 }), false)
  assert.equal(salaryLineNeedsReason({ kind: 'salary', suggested_minor: 100, amount_minor: 150 }), true)
  assert.equal(salaryLineNeedsReason({ kind: 'salary', suggested_minor: 100, amount_minor: 150, reason: 'extra hours' }), false)
  assert.equal(salaryLineNeedsReason({ kind: 'expense', amount_minor: 1 }), false)
})

test('suggestSalaries: wash pool by attendance weight, TL daily rate, everyone clocked in gets a row', () => {
  const attendance = [
    { staff_id: 'c1', full_name: 'Crew One', role: 'staff', status: 'present' },
    { staff_id: 'c2', full_name: 'Crew Two', role: 'staff', status: 'late' },
    { staff_id: 't1', full_name: 'Lead', role: 'team_lead', status: 'present' },
    { staff_id: 'gone', full_name: 'Absent', role: 'staff', status: 'absent' },
  ]
  const sales = [{ id: 'w1', branch: 'bacoor', status: 'paid', total_minor: 170000, occurred_at: '2026-10-01T03:00:00Z', sale_line_items: [washLine(170000)] }]
  const rows = suggestSalaries({
    date: '2026-10-01',
    branch: 'bacoor',
    sales,
    attendance,
    rules: { wash_pool_pct: 35, attendance_late_weight: 0.7 },
    dailyRates: { t1: 60000 },
  })
  const by = Object.fromEntries(rows.map((r) => [r.staff_id, r]))
  assert.equal(rows.length, 3, 'absent staff get no row')
  const pool = Math.round(170000 * 0.35)
  assert.equal(by.c1.suggested_minor + by.c2.suggested_minor, pool)
  assert.equal(by.c1.suggested_minor, Math.round(pool / 1.7))
  assert.equal(by.t1.suggested_minor, 60000, 'TL is out of the wash pool and gets the daily rate')
  assert.equal(by.t1.parts.wash_minor, 0)
})

test('suggestSalaries: detailing crew share from checkout drafts splits on the roster', () => {
  const attendance = [{ staff_id: 'c1', full_name: 'Crew One', role: 'staff', status: 'present' }]
  const sales = [{ id: 'd1', branch: 'bacoor', status: 'paid', total_minor: 500000, occurred_at: '2026-10-01T03:00:00Z', sale_line_items: [] }]
  const rows = suggestSalaries({
    date: '2026-10-01',
    branch: 'bacoor',
    sales,
    attendance,
    ceramicExpenses: [{ description: 'detailing:d1:crew', total_minor: 100000, branch: 'bacoor' }],
    rules: { wash_pool_pct: 0 },
  })
  assert.equal(rows[0].parts.detailing_minor, 100000)
  assert.equal(rows[0].suggested_minor, 100000)
})

test('checklist: blocks submit with a plain "what is missing" list', () => {
  const sheet = { opening_float_minor: null, counted_cash_minor: null, notes: '' }
  const lines = [
    { kind: 'expense', description: '', account_id: null, amount_minor: 0 },
    { kind: 'salary', staff_id: 'c1', suggested_minor: 100, amount_minor: 200 },
    { kind: 'ca_release', staff_id: null, amount_minor: 500 },
  ]
  const c = sheetChecklist({ sheet, lines, sales: [] })
  assert.equal(c.canSubmit, false)
  assert.ok(c.missing.some((m) => /opening float/i.test(m)))
  assert.ok(c.missing.some((m) => /count the cash/i.test(m)))
  assert.ok(c.missing.some((m) => /expense/i.test(m)))
  assert.ok(c.missing.some((m) => /reason/i.test(m)))
  assert.ok(c.missing.some((m) => /cash advance/i.test(m)))
  assert.equal(c.sections.expenses, false)
})

test('checklist: over/short needs a note; complete sheet can submit', () => {
  const lines = [{ kind: 'expense', description: 'Soap', account_id: 'a', amount_minor: 1000 }]
  const short = sheetChecklist({ sheet: { opening_float_minor: 5000, counted_cash_minor: 3000, notes: '' }, lines, sales: [] })
  assert.equal(short.canSubmit, false)
  assert.ok(short.missing.some((m) => /note/i.test(m)))
  const ok = sheetChecklist({ sheet: { opening_float_minor: 5000, counted_cash_minor: 4000, notes: '' }, lines, sales: [] })
  assert.deepEqual(ok.missing, [])
  assert.equal(ok.canSubmit, true)
  const explained = sheetChecklist({ sheet: { opening_float_minor: 5000, counted_cash_minor: 3000, notes: 'Paid tip' }, lines, sales: [] })
  assert.equal(explained.canSubmit, true)
})

test('formatAccounting: Xero style, negatives in parentheses', () => {
  assert.equal(formatAccounting(123456), '₱1,234.56')
  assert.equal(formatAccounting(-5000), '(₱50.00)')
  assert.equal(formatAccounting(0), '₱0.00')
})

test('hourlyNetSales: Manila hours, today vs prior day', () => {
  const rows = hourlyNetSales(SALES, [{ status: 'paid', total_minor: 7000, occurred_at: '2026-09-30T02:15:00Z' }])
  const ten = rows.find((r) => r.hour === 10)
  assert.equal(ten.today, 500)
  assert.equal(ten.prior, 70)
  assert.equal(rows.find((r) => r.hour === 13).today, 200)
  assert.equal(rows.find((r) => r.hour === 14).today, 300, 'refunded sale adds nothing to net')
  assert.equal(rows.length, 24)
})

test('floorMoney: today vs yesterday by the same hour per branch, MTD net, waiting sheets, drawer alerts', () => {
  const m = floorMoney({
    nowHour: 12,
    todaySales: [
      { branch: 'bacoor', status: 'paid', total_minor: 100000, occurred_at: '2026-10-02T01:00:00Z' },
      { branch: 'imus', status: 'refunded', total_minor: 20000, occurred_at: '2026-10-02T02:00:00Z' },
    ],
    yesterdaySales: [
      { branch: 'bacoor', status: 'paid', total_minor: 50000, occurred_at: '2026-10-01T01:00:00Z' },
      { branch: 'bacoor', status: 'paid', total_minor: 70000, occurred_at: '2026-10-01T12:00:00Z' },
    ],
    plRows: [
      { kind: 'income', amount_minor: 900000 },
      { kind: 'expense', amount_minor: 250000 },
    ],
    sheets: [
      { id: 'a', branch: 'bacoor', business_date: '2026-10-01', status: 'submitted', totals: { overShortMinor: 0 } },
      { id: 'b', branch: 'imus', business_date: '2026-09-30', status: 'approved', totals: { overShortMinor: -5000 } },
      { id: 'c', branch: 'imus', business_date: '2026-10-02', status: 'draft', totals: { overShortMinor: 900 } },
    ],
  })
  assert.deepEqual(m.byBranch, [
    { branch: 'bacoor', todayMinor: 100000, yesterdayMinor: 50000 },
    { branch: 'imus', todayMinor: 0, yesterdayMinor: 0 },
  ])
  assert.equal(m.yesterdayMinor, 50000, '8 pm yesterday is after noon — not compared yet')
  assert.equal(m.mtdNetMinor, 650000)
  assert.equal(m.waiting, 1)
  assert.deepEqual(m.alerts, [{ id: 'b', branch: 'imus', date: '2026-09-30', overShortMinor: -5000 }])
  assert.equal(m.allGood, false)
  assert.equal(floorMoney({}).allGood, true)
})

test('Floor Board shows the Money panel only to sheet reviewers (SA / ASA finance view)', () => {
  const board = readFileSync(new URL('../src/pages/SuperAdminFloorBoard.jsx', import.meta.url), 'utf8')
  assert.match(board, /const showMoney = canReviewDailySheet\(profile\)/)
  assert.match(board, /showMoney \? \([\s\S]*<FloorMoneyPanel/)
})
