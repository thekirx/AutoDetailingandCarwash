/**
 * Pending floor payroll queue: accepted closes accumulate until a floor run covers them.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { floorPayrollCoversDay, isFloorPayrollRun, shiftClosePayrollCoverage } from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('pending floor payroll from shift closes', () => {

  it('does not treat fixed salary as covering floor days', () => {
    assert.equal(
      floorPayrollCoversDay(
        {
          branch: 'hq',
          period_start: '2026-08-18',
          period_end: '2026-08-20',
          status: 'confirmed',
          run_kind: 'fixed',
        },
        '2026-08-19',
        'bacoor',
      ),
      false,
    )
    assert.equal(isFloorPayrollRun({ notes: 'Fixed salary · Aug' }), false)
    assert.equal(isFloorPayrollRun({ run_kind: 'floor' }), true)
  })

  it('labels finance coverage for reporting', () => {
    const close = { branch: 'bacoor', business_date: '2026-08-19', status: 'accepted' }
    assert.equal(shiftClosePayrollCoverage(close, []).label, 'Floor coverage · pending confirm')
    assert.equal(
      shiftClosePayrollCoverage(close, [
        {
          branch: 'bacoor',
          period_start: '2026-08-19',
          period_end: '2026-08-19',
          status: 'confirmed',
          run_kind: 'floor',
        },
      ]).covered,
      true,
    )
  })

  it('migration and Finance shift-close history keep floor coverage', () => {
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821170000_payroll_run_kind_pending_floor.sql'),
      'utf8',
    )
    assert.match(mig, /run_kind/)
    assert.match(mig, /payroll_runs_floor_coverage_idx/)
    assert.match(mig, /shift_close_reports_pending_payroll_idx/)
    const finance = readFileSync(join(root, 'src/pages/finance/FinanceShiftCloseTab.jsx'), 'utf8')
    assert.match(finance, /shiftClosePayrollCoverage/)
    assert.match(finance, /Floor coverage/)
  })
})
