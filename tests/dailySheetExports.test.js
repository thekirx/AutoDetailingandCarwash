import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closeOfDaySlip, filterSheets, sheetSubmitters } from '../src/lib/dailySheet.js'

const rows = [
  { id: 'a', business_date: '2026-10-01', branch: 'bacoor', submitted_by: 'u1', staff_profiles: { full_name: 'Ana Cruz' }, notes: 'GCash late', review_note: null, totals: { netProfitMinor: 500000, overShortMinor: 0 } },
  { id: 'b', business_date: '2026-10-02', branch: 'batangas', submitted_by: 'u2', staff_profiles: { full_name: 'Ben Reyes' }, notes: null, review_note: 'Missing receipt', totals: { netProfitMinor: -20000, overShortMinor: -5000 } },
  { id: 'c', business_date: '2026-10-02', branch: 'bacoor', submitted_by: 'u1', staff_profiles: { full_name: 'Ana Cruz' }, notes: null, review_note: null, totals: { netProfitMinor: 1200000 } },
]
const names = { bacoor: 'Hakum Bacoor', batangas: 'Hakum Batangas' }
const ids = (list) => list.map((r) => r.id)

describe('filterSheets', () => {
  it('no filters keeps every sheet', () => {
    assert.deepEqual(ids(filterSheets(rows)), ['a', 'b', 'c'])
  })

  it('search matches date, branch name, submitter and notes, ignoring case', () => {
    const opts = { branchName: (s) => names[s] }
    assert.deepEqual(ids(filterSheets(rows, { ...opts, search: '2026-10-02' })), ['b', 'c'])
    assert.deepEqual(ids(filterSheets(rows, { ...opts, search: 'batangas' })), ['b'])
    assert.deepEqual(ids(filterSheets(rows, { ...opts, search: 'ana' })), ['a', 'c'])
    assert.deepEqual(ids(filterSheets(rows, { ...opts, search: 'RECEIPT' })), ['b'])
    assert.deepEqual(ids(filterSheets(rows, { ...opts, search: 'gcash' })), ['a'])
  })

  it('submitter, net profit range (pesos, inclusive) and over/short combine', () => {
    assert.deepEqual(ids(filterSheets(rows, { submitter: 'u1' })), ['a', 'c'])
    assert.deepEqual(ids(filterSheets(rows, { minNet: '5000' })), ['a', 'c'])
    assert.deepEqual(ids(filterSheets(rows, { maxNet: '0' })), ['b'])
    assert.deepEqual(ids(filterSheets(rows, { minNet: '5000', maxNet: '5000' })), ['a'])
    assert.deepEqual(ids(filterSheets(rows, { overShortOnly: true })), ['b'])
    assert.deepEqual(ids(filterSheets(rows, { submitter: 'u1', minNet: '10000' })), ['c'])
  })

  it('a blank or non-number range is ignored, not treated as zero', () => {
    assert.deepEqual(ids(filterSheets(rows, { minNet: '', maxNet: 'abc' })), ['a', 'b', 'c'])
  })
})

describe('closeOfDaySlip', () => {
  const slip = closeOfDaySlip({
    branchLabel: 'Bacoor',
    sheet: { business_date: '2026-10-02', status: 'approved', opening_float_minor: 100000, counted_cash_minor: 114000, notes: 'Short 10 pesos', staff_profiles: { full_name: 'Ana Cruz' } },
    sales: [
      { status: 'paid', total_minor: 150000, payment_method: 'cash' },
      { status: 'paid', total_minor: 50000, payment_method: 'gcash' },
    ],
    lines: [
      { kind: 'expense', description: 'Soap', account_label: '18 Online Expenses and Others', amount_minor: 30000 },
      { kind: 'salary', staff_name: 'Ana Cruz', suggested_minor: 80000, amount_minor: 90000, reason: 'Overtime' },
      { kind: 'ca_release', staff_name: 'Ben Reyes', amount_minor: 20000 },
      { kind: 'ca_repay', staff_name: 'Ben Reyes', amount_minor: 5000 },
    ],
  })
  const row = (section, item) => slip.rows.find((r) => r.section === section && r.item === item)

  it('names the branch, day and status', () => {
    assert.match(slip.title, /Bacoor/)
    assert.match(slip.title, /2026-10-02/)
    assert.match(slip.subtitle, /Approved/)
    assert.match(slip.subtitle, /Ana Cruz/)
  })

  it('sales and payments: net ₱2,000 = cash ₱1,500 + GCash ₱500, unused methods left out', () => {
    assert.equal(row('Sales', 'Net sales').amount_minor, 200000)
    assert.equal(row('Payments', 'Cash').amount_minor, 150000)
    assert.equal(row('Payments', 'GCash').amount_minor, 50000)
    assert.equal(row('Payments', 'Card'), undefined)
    assert.equal(row('Sales', 'Transactions').amount_minor, null)
    assert.match(row('Sales', 'Transactions').detail, /^2 /)
  })

  it('every expense, salary and cash advance line is listed with its detail', () => {
    assert.equal(row('Expenses', 'Soap').amount_minor, 30000)
    assert.equal(row('Expenses', 'Soap').detail, '18 Online Expenses and Others')
    assert.equal(row('Salaries', 'Ana Cruz').amount_minor, 90000)
    assert.match(row('Salaries', 'Ana Cruz').detail, /Overtime/)
    assert.equal(row('Cash advances', 'Given out · Ben Reyes').amount_minor, 20000)
    assert.equal(row('Cash advances', 'Paid back · Ben Reyes').amount_minor, 5000)
  })

  it('drawer: ₱1,000 + 1,500 + 50 − 300 − 900 − 200 = ₱1,150 expected; counted ₱1,140 is ₱10 short', () => {
    assert.equal(row('Drawer', 'Expected cash').amount_minor, 115000)
    assert.equal(row('Drawer', 'Counted cash').amount_minor, 114000)
    assert.equal(row('Drawer', 'Over/short').amount_minor, -1000)
    assert.equal(row('Drawer', 'Over/short').detail, 'Short 10 pesos')
    assert.equal(row('Drawer', 'Expenses paid').amount_minor, -30000)
  })

  it('net profit ₱800 = net sales ₱2,000 − expenses ₱300 − salaries ₱900', () => {
    assert.equal(row('Result', 'Net profit').amount_minor, 80000)
  })
})

describe('sheetSubmitters', () => {
  it('lists each Branch Admin once, sorted by name', () => {
    assert.deepEqual(sheetSubmitters(rows), [
      { value: 'u1', label: 'Ana Cruz' },
      { value: 'u2', label: 'Ben Reyes' },
    ])
  })
})
