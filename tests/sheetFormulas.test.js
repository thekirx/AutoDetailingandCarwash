import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeSheetTotals, sheetChecklist } from '../src/lib/dailySheet.js'
import { moneyLeft } from '../src/lib/sheetFormulas.js'
import { paymentBucket, paymentMethodLabel } from '../src/lib/paymentMethods.js'

describe('sheet formulas', () => {
  it('splits cash left and GCash left and keeps advances out of profit', () => {
    const left = moneyLeft({
      posCashMinor: 50000,
      posGcashMinor: 20000,
      caRepayCashMinor: 0,
      caRepayGcashMinor: 3000,
      expenseCashMinor: 5000,
      expenseGcashMinor: 1000,
      salaryCashMinor: 80000,
      salaryGcashMinor: 0,
      caReleaseCashMinor: 10000,
      caReleaseGcashMinor: 0,
      openingFloatMinor: 100000,
    })
    assert.equal(left.cashLeftMinor, 50000 - 5000 - 80000 - 10000)
    assert.equal(left.gcashLeftMinor, 20000 + 3000 - 1000)
    assert.equal(left.expectedCashMinor, 100000 + left.cashLeftMinor)

    const sales = [
      { status: 'paid', total_minor: 50000, payment_method: 'cash', sale_line_items: [{ item_type: 'service', line_total_minor: 50000, services: { pay_category: 'car_wash', name: 'Wash' } }] },
      { status: 'paid', total_minor: 20000, payment_method: 'gcash', sale_line_items: [{ item_type: 'product', line_total_minor: 20000, products: { category: 'coffee', name: 'Coffee' } }] },
    ]
    const t = computeSheetTotals({
      sales,
      lines: [
        { kind: 'expense', amount_minor: 5000, paid_from: 'cash' },
        { kind: 'expense', amount_minor: 1000, paid_from: 'gcash' },
        { kind: 'salary', amount_minor: 80000, paid_from: 'cash' },
        { kind: 'ca_release', amount_minor: 10000, paid_from: 'cash' },
        { kind: 'ca_repay', amount_minor: 3000, paid_from: 'gcash' },
      ],
      openingFloatMinor: 100000,
      countedCashMinor: left.expectedCashMinor,
    })
    assert.equal(t.netProfitMinor, 70000 - 6000 - 80000)
    assert.equal(t.cashLeftMinor, left.cashLeftMinor)
    assert.equal(t.gcashLeftMinor, left.gcashLeftMinor)
    assert.equal(t.overShortMinor, 0)
    assert.equal(t.byFamily.find((f) => f.id === 'car_wash')?.label, 'Car wash sales')
    assert.equal(t.byFamily.find((f) => f.id === 'car_wash')?.minor, 50000)
    assert.equal(t.byFamily.some((f) => f.id === 'coffee'), true)
  })

  it('follows FOrmulas.md on a worked day', () => {
    // Independent pesos, not a replay of the function body.
    // Cash ticket ₱540: wash ₱500 + accessory ₱40.
    // GCash ticket ₱220: ceramic ₱200 + coffee ₱20.
    // Card tint ₱150. Bank transfer PPF ₱300.
    // Expense cash ₱50, expense GCash ₱10, salary cash ₱80.
    // Advance given cash ₱30. Advance paid back GCash ₱15.
    const t = computeSheetTotals({
      openingFloatMinor: 100000,
      countedCashMinor: 138000,
      sales: [
        {
          status: 'paid',
          total_minor: 54000,
          payment_method: 'cash',
          sale_line_items: [
            { item_type: 'service', line_total_minor: 50000, name: 'Carwash', services: { slug: 'premium-car-wash', name: 'Carwash', pay_category: 'wash' } },
            { item_type: 'product', line_total_minor: 4000, name: 'Air freshener', products: { category: 'accessories', name: 'Air freshener', tags: ['accessories'] } },
          ],
        },
        {
          status: 'paid',
          total_minor: 22000,
          payment_method: 'gcash',
          sale_line_items: [
            { item_type: 'service', line_total_minor: 20000, name: 'Ceramic Coating', services: { slug: 'ceramic-coating', name: 'Ceramic Coating', pay_category: 'detailing' } },
            { item_type: 'product', line_total_minor: 2000, name: 'Coffee', products: { category: 'coffee', name: 'Coffee', tags: ['coffee'] } },
          ],
        },
        {
          status: 'paid',
          total_minor: 15000,
          payment_method: 'card',
          sale_line_items: [
            { item_type: 'service', line_total_minor: 15000, name: 'Nano Ceramic Tint', services: { slug: 'nano-ceramic-tint', name: 'Nano Ceramic Tint', pay_category: 'detailing' } },
          ],
        },
        {
          status: 'paid',
          total_minor: 30000,
          payment_method: 'bank',
          sale_line_items: [
            { item_type: 'service', line_total_minor: 30000, name: 'Paint Protection Film (PPF)', services: { slug: 'paint-protection-film', name: 'Paint Protection Film (PPF)', pay_category: 'detailing' } },
          ],
        },
      ],
      lines: [
        { kind: 'expense', amount_minor: 5000, paid_from: 'cash', account_id: 'acct', description: 'Soap' },
        { kind: 'expense', amount_minor: 1000, paid_from: 'gcash', account_id: 'acct', description: 'Load' },
        { kind: 'salary', amount_minor: 8000, paid_from: 'cash' },
        { kind: 'ca_release', amount_minor: 3000, paid_from: 'cash', staff_id: 's1' },
        { kind: 'ca_repay', amount_minor: 1500, paid_from: 'gcash', staff_id: 's1' },
      ],
    })
    assert.equal(t.netMinor, 121000)
    assert.equal(t.byMethod.cash, 54000)
    assert.equal(t.byMethod.gcash, 22000)
    assert.equal(t.byMethod.card, 15000)
    assert.equal(t.byMethod.bank, 30000)
    assert.equal(t.byFamily.find((f) => f.id === 'car_wash').minor, 50000)
    assert.equal(t.byFamily.find((f) => f.id === 'coating').minor, 20000)
    assert.equal(t.byFamily.find((f) => f.id === 'tint').minor, 15000)
    assert.equal(t.byFamily.find((f) => f.id === 'ppf').minor, 30000)
    assert.equal(t.byFamily.find((f) => f.id === 'coffee').minor, 2000)
    assert.equal(t.totalExpensesMinor, 14000)
    assert.equal(t.netProfitMinor, 107000)
    assert.equal(t.cashLeftMinor, 38000)
    assert.equal(t.gcashLeftMinor, 22500)
    assert.equal(t.expectedCashMinor, 138000)
    assert.equal(t.overShortMinor, 0)

    const blocked = sheetChecklist({
      sheet: { opening_float_minor: 0, counted_cash_minor: 0 },
      lines: [{ kind: 'expense', amount_minor: 5000, paid_from: 'cash', description: 'Soap' }],
      sales: [],
    })
    assert.equal(blocked.canSubmit, false)
  })

  it('names credit, debit, and bank on the report', () => {
    assert.equal(paymentBucket('debit'), 'debit')
    assert.equal(paymentBucket('credit'), 'card')
    assert.equal(paymentBucket('bank'), 'bank')
    assert.equal(paymentMethodLabel('debit'), 'Debit card')
    assert.equal(paymentMethodLabel('bank'), 'Bank transfer')
    assert.equal(paymentMethodLabel('card'), 'Credit card')
  })
})
