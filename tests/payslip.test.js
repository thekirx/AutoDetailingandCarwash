import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDayCrewRole, officePayrollPeople, payHalf, payHalfChoices, payPeriodList, payrollPaidFrom, payslipStatusLabel, payslipTakeHome } from '../src/lib/payslip.js'

describe('payslips', () => {
  it('pays the salary plus the incentive and does not take tax', () => {
    assert.equal(payslipTakeHome(2000000, 50000), 2050000)
    assert.equal(payslipTakeHome(2000000, 0), 2000000)
    assert.equal(payslipTakeHome(2000000), 2000000)
  })

  it('uses 14-day periods from the Monday anchor', () => {
    assert.deepEqual(payHalf('2026-01-05'), {
      start: '2026-01-05',
      end: '2026-01-18',
      label: 'January 5–18',
    })
    assert.equal(payHalf('2026-01-19').start, '2026-01-19')
    assert.equal(payHalf('2026-01-19').end, '2026-02-01')
  })

  it('offers the current period and the one before it', () => {
    const choices = payHalfChoices('2026-01-10')
    assert.equal(choices[0].start, '2026-01-05')
    assert.equal(choices[1].end, '2026-01-04')
  })

  it('lists four bi-weekly tabs with this period first', () => {
    const periods = payPeriodList('2026-01-20', 4)
    assert.deepEqual(periods.map((row) => row.start), ['2026-01-19', '2026-01-05', '2025-12-22', '2025-12-08'])
  })

  it('keeps crew off the office roster', () => {
    const rows = officePayrollPeople([
      { role: 'staff', full_name: 'Crew', is_active: true },
      { role: 'admin', full_name: 'Branch', is_active: true },
      { role: 'assistant_super_admin', full_name: 'Office', is_active: false },
    ])
    assert.deepEqual(rows.map((row) => row.full_name), ['Branch'])
  })

  it('the database chooses the 14-day block and will not store a made-up span', () => {
    const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20261028150000_payroll_period_calendar.sql'), 'utf8')
    const lib = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/lib/payslip.js'), 'utf8')
    assert.match(sql, /payroll_period_containing/)
    assert.match(sql, /date '2026-01-05'/)
    assert.match(sql, /floor\(\(p_on - date '2026-01-05'\)::numeric \/ 14\)/)
    assert.match(sql, /Use the 14-day payroll block/)
    assert.match(sql, /payslips_branch_period_idx/)
    assert.match(sql, /payslip_id/)
    assert.match(lib, /Date\.UTC\(2026, 0, 5\)/)
    assert.doesNotMatch(sql, /p_end - p_start\) > 16/)
  })

  it('does not turn a GCash slip into cash when the editor has not chosen a method', () => {
    assert.equal(payrollPaidFrom('', 'gcash'), 'gcash')
    assert.equal(payrollPaidFrom(undefined, 'gcash'), 'gcash')
    assert.equal(payrollPaidFrom('cash', 'gcash'), 'cash')
    assert.equal(payrollPaidFrom('', null), 'cash')
    const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/pages/MonthlyPayrollPage.jsx'), 'utf8')
    assert.match(page, /payrollPaidFrom/)
    assert.doesNotMatch(page, /paidFrom: 'cash'/)
  })

  it('payroll page uses period tabs and a lock', () => {
    const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/pages/MonthlyPayrollPage.jsx'), 'utf8')
    const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20261028130000_payroll_period_lock.sql'), 'utf8')
    assert.match(page, /This period/)
    assert.match(page, /Lock period/)
    assert.match(page, /officePayrollPeople/)
    assert.match(page, /set_payroll_period_lock/)
    assert.match(sql, /This payroll period is locked/)
    assert.match(sql, /Only Super Admin can unlock/)
  })

  it('keeps crew off the monthly list', () => {
    assert.equal(isDayCrewRole('staff'), true)
    assert.equal(isDayCrewRole('team_lead'), true)
    assert.equal(isDayCrewRole('detailer'), true)
    assert.equal(isDayCrewRole('admin'), false)
    assert.equal(isDayCrewRole('BossMich'), false)
  })

  it('names the three statuses', () => {
    assert.equal(payslipStatusLabel('sent'), 'Sent')
    assert.equal(payslipStatusLabel('received'), 'Received')
    assert.equal(payslipStatusLabel('signed'), 'Signed')
  })
})
