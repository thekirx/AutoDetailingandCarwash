import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOwnerDailySmsFromClose,
  buildShiftCloseAcceptCopy,
  isOwnerSmsEnabled,
} from '../server/notifyShiftClose.mjs'

const copy = buildShiftCloseAcceptCopy({ branch: 'bacoor', businessDate: '2026-08-27', closeId: 'c1' })
assert.match(copy.title, /bacoor/i)
assert.match(copy.body, /Confirm floor payroll/i)

// Helper stays for optional ENABLE_OWNER_SMS=1 QA only — product default is no owner SMS.
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

assert.equal(isOwnerSmsEnabled(), false, 'owner SMS off unless ENABLE_OWNER_SMS=1')

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../server/notifyShiftClose.mjs'), 'utf8')
assert.match(src, /owner_sms_disabled/)
assert.match(src, /ENABLE_OWNER_SMS/)

const fin = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/finance/FinanceShiftCloseTab.jsx'),
  'utf8',
)
assert.match(fin, /\/api\/notify-shift-close/)
// Finance must not nag operators to configure OWNER_SMS — outbound reminders only, no owner daily SMS.
assert.doesNotMatch(fin, /set OWNER_SMS_PHONE/)
assert.doesNotMatch(fin, /Owner SMS skipped/)
assert.doesNotMatch(fin, /Owner SMS sent/)

console.log('notifyShiftClose owner SMS policy: ok')
