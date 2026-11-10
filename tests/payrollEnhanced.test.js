import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPeriodsForYearMonth,
  lastDayOfMonth,
  payHalf,
  payslipTakeHome,
} from '../src/lib/payslip.js'
import { canEditFinanceBooks } from '../src/auth/permissions.js'

test('Payroll Enhanced - Fixed cutoff dates (15th and end of month including Feb)', () => {
  // February non-leap year (e.g. 2025/2026/2027)
  assert.equal(lastDayOfMonth(2026, 2), 28)
  assert.equal(lastDayOfMonth(2024, 2), 29) // Leap year

  // 30-day months
  assert.equal(lastDayOfMonth(2026, 4), 30) // April
  assert.equal(lastDayOfMonth(2026, 6), 30) // June
  assert.equal(lastDayOfMonth(2026, 9), 30) // September
  assert.equal(lastDayOfMonth(2026, 11), 30) // November

  // 31-day months
  assert.equal(lastDayOfMonth(2026, 1), 31) // January
  assert.equal(lastDayOfMonth(2026, 3), 31) // March
  assert.equal(lastDayOfMonth(2026, 12), 31) // December

  // Fixed cutoffs
  const febFirstHalf = payHalf('2026-02-05')
  assert.deepEqual(febFirstHalf, {
    start: '2026-02-01',
    end: '2026-02-15',
    label: 'February 1–15',
  })

  const febSecondHalf = payHalf('2026-02-20')
  assert.deepEqual(febSecondHalf, {
    start: '2026-02-16',
    end: '2026-02-28',
    label: 'February 16–28',
  })
})

test('Payroll Enhanced - getPeriodsForYearMonth returns 24 semi-monthly periods for full year', () => {
  const fullYear = getPeriodsForYearMonth(2026)
  assert.equal(fullYear.length, 24)
  assert.equal(fullYear[0].start, '2026-12-16')
  assert.equal(fullYear[0].end, '2026-12-31')
  assert.equal(fullYear[fullYear.length - 1].start, '2026-01-01')
  assert.equal(fullYear[fullYear.length - 1].end, '2026-01-15')

  // Filtered by specific month (e.g. November)
  const november = getPeriodsForYearMonth(2026, 11)
  assert.equal(november.length, 2)
  assert.equal(november[0].start, '2026-11-16')
  assert.equal(november[0].end, '2026-11-30')
  assert.equal(november[1].start, '2026-11-01')
  assert.equal(november[1].end, '2026-11-15')
})

test('Payroll Enhanced - BossMich, Lucy, and Robert are authorized to process and edit payroll', () => {
  // Super Admin / Owner
  const bossMich = { role: 'BossMich', full_name: 'BossMich', login_email: 'bossmich@hakumautocare.com' }
  assert.equal(canEditFinanceBooks(bossMich), true)

  // Lucy (Assistant Super Admin)
  const lucy = { role: 'assistant_super_admin', full_name: 'Luci', login_email: 'assistant@hakumautocare.com' }
  assert.equal(canEditFinanceBooks(lucy), true)

  // Robert (Assistant Super Admin)
  const robert = { role: 'assistant_super_admin', full_name: 'Robert', login_email: 'robert@hakumautocare.com' }
  assert.equal(canEditFinanceBooks(robert), true)

  // Other ASA with finance_write grant
  const asaWithGrant = { role: 'assistant_super_admin', full_name: 'Admin User', permission_grants: { finance_write: true } }
  assert.equal(canEditFinanceBooks(asaWithGrant), true)

  // Other ASA without grant and not Lucy/Robert
  const asaNoGrant = { role: 'assistant_super_admin', full_name: 'John Doe', permission_grants: {} }
  assert.equal(canEditFinanceBooks(asaNoGrant), false)

  // Branch Admin is not authorized
  const branchAdmin = { role: 'admin', full_name: 'Branch Admin' }
  assert.equal(canEditFinanceBooks(branchAdmin), false)
})

test('Payroll Enhanced - Base monthly salary and take-home calculations', () => {
  const monthlySalaryMinor = 3000000 // ₱30,000.00 / month
  const semiMonthlyCutoff = monthlySalaryMinor / 2 // ₱15,000.00 / cutoff
  const incentiveMinor = 250000 // ₱2,500.00 incentive
  const takeHome = payslipTakeHome(semiMonthlyCutoff, incentiveMinor)

  assert.equal(semiMonthlyCutoff, 1500000)
  assert.equal(takeHome, 1750000) // ₱17,500.00 net
})
