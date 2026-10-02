/**
 * Remaining money-path gap seams: Manila sale day, ceramic-by-sale, CA staff bind.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichCashAdvancePayload, floorPayrollCoversDay, saleBusinessDate } from '../src/lib/payroll.js'
import { getLocalCalendarDate } from '../src/lib/localCalendarDate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('saleBusinessDate · Manila not UTC slice', () => {
  it('maps late PH evening UTC stamp to Manila calendar day', () => {
    // 2026-08-22 23:30 +08 = 2026-08-22T15:30:00.000Z — UTC date is still 22
    assert.equal(saleBusinessDate({ occurred_at: '2026-08-22T15:30:00.000Z' }), '2026-08-22')
    // 2026-08-23 01:00 +08 = 2026-08-22T17:00:00.000Z — UTC slice(0,10) wrongly yields 22
    assert.equal(saleBusinessDate({ occurred_at: '2026-08-22T17:00:00.000Z' }), '2026-08-23')
    assert.notEqual(
      String('2026-08-22T17:00:00.000Z').slice(0, 10),
      saleBusinessDate({ occurred_at: '2026-08-22T17:00:00.000Z' }),
    )
  })

  it('prefers explicit business_date and bare YYYY-MM-DD', () => {
    assert.equal(saleBusinessDate({ business_date: '2026-08-20', occurred_at: '2026-08-22T17:00:00.000Z' }), '2026-08-20')
    assert.equal(saleBusinessDate({ sale_date: '2026-08-19' }), '2026-08-19')
  })

  it('claimed-sale coverage uses Manila day from occurred_at', () => {
    const run = {
      branch: 'bacoor',
      period_start: '2026-08-22',
      period_end: '2026-08-23',
      status: 'confirmed',
      run_kind: 'floor',
      payroll_run_sales: [
        {
          branch: 'bacoor',
          sale_id: 's1',
          // UTC date 22, Manila date 23
          occurred_at: '2026-08-22T17:00:00.000Z',
          business_date: saleBusinessDate({ occurred_at: '2026-08-22T17:00:00.000Z' }),
        },
      ],
    }
    assert.equal(floorPayrollCoversDay(run, '2026-08-23', 'bacoor'), true)
    assert.equal(floorPayrollCoversDay(run, '2026-08-22', 'bacoor'), false)
  })
})


describe('cash advance staff bind', () => {
  it('stamps staff_id from profile when missing', () => {
    const out = enrichCashAdvancePayload(
      { employee_name: 'Ty', amount: 200, branch: 'bacoor' },
      { id: 'staff-ty', full_name: 'Ty Crew' },
    )
    assert.equal(out.staff_id, 'staff-ty')
    assert.equal(out.employee_name, 'Ty')
  })

  it('does not overwrite an existing staff_id', () => {
    const out = enrichCashAdvancePayload(
      { staff_id: 'staff-other', employee_name: 'Other', amount: 100 },
      { id: 'staff-ty', full_name: 'Ty Crew' },
    )
    assert.equal(out.staff_id, 'staff-other')
  })

  it('fills employee_name from profile when blank', () => {
    const out = enrichCashAdvancePayload({ amount: 50, branch: 'bacoor' }, { id: 'staff-ty', full_name: 'Ty Crew' })
    assert.equal(out.employee_name, 'Ty Crew')
  })
})

describe('getLocalCalendarDate sanity', () => {
  it('agrees with saleBusinessDate for ISO timestamps', () => {
    const iso = '2026-08-22T17:00:00.000Z'
    assert.equal(saleBusinessDate({ occurred_at: iso }), getLocalCalendarDate(iso))
  })
})

describe('cash advance request wiring', () => {
  it('staff CA submit stamps staff_id via enrichCashAdvancePayload', () => {
    const panel = readFileSync(join(root, 'src/pages/planning/PlanningFormsSmartPanel.jsx'), 'utf8')
    assert.match(panel, /enrichCashAdvancePayload/)
  })
})
