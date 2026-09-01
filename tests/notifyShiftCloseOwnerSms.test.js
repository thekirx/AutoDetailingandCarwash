import assert from 'node:assert/strict'
import { buildOwnerDailySmsFromClose, buildShiftCloseAcceptCopy } from '../server/notifyShiftClose.mjs'

const copy = buildShiftCloseAcceptCopy({ branch: 'bacoor', businessDate: '2026-08-27', closeId: 'c1' })
assert.match(copy.title, /bacoor/i)
assert.match(copy.body, /Confirm floor payroll/i)

const sms = buildOwnerDailySmsFromClose({
  branch: 'bacoor',
  businessDate: '2026-08-27',
  submitted: {
    branch_slug: 'bacoor',
    date: '2026-08-27',
    total_sales_minor: 1500000,
    car_wash_sales_minor: 900000,
    detailing_sales_minor: 400000,
    ceramic_tint_sales_minor: 100000,
    refreshment_sales_minor: 50000,
    car_accessories_minor: 50000,
    total_gcash_minor: 500000,
    credit_card_minor: 200000,
    total_expenses_minor: 100000,
    carwash_salary_minor: 80000,
    detailer_salary_minor: 20000,
    daily_expenses: [{ label: 'Supplies', amount_minor: 100000 }],
  },
})
assert.match(sms, /BACOOR SALES REPORT/)
assert.match(sms, /Car Wash Sales/)
assert.match(sms, /Tint Sales/)
assert.match(sms, /Carwash Salary/)

console.log('notifyShiftClose owner SMS: ok')
