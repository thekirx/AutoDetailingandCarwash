import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isDayCrewRole, payHalf, payHalfChoices, payslipStatusLabel, payslipTakeHome } from '../src/lib/payslip.js'

describe('payslips', () => {
  it('pays the salary plus the incentive and does not take tax', () => {
    assert.equal(payslipTakeHome(2000000, 50000), 2050000)
    assert.equal(payslipTakeHome(2000000, 0), 2000000)
    assert.equal(payslipTakeHome(2000000), 2000000)
  })

  it('splits the month into two halves', () => {
    assert.deepEqual(payHalf('2026-10-07'), {
      start: '2026-10-01',
      end: '2026-10-15',
      label: 'October 1–15',
    })
    assert.equal(payHalf('2026-10-26').start, '2026-10-16')
    assert.equal(payHalf('2026-10-26').end, '2026-10-31')
    assert.equal(payHalf('2026-02-20').end, '2026-02-28')
  })

  it('offers the current half and the one before it', () => {
    const choices = payHalfChoices('2026-10-02')
    assert.equal(choices[0].start, '2026-10-01')
    assert.equal(choices[1].end, '2026-09-30')
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
