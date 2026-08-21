/**
 * Pending floor payroll queue: accepted closes accumulate until a floor run covers them.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPendingFloorPayrollQueue,
  buildRunPayrollPayload,
  floorPayrollCoversDay,
  isFloorPayrollRun,
  shiftClosePayrollCoverage,
} from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('pending floor payroll from shift closes', () => {
  it('accumulates three missed accepted days into one branch window', () => {
    const queue = buildPendingFloorPayrollQueue({
      closes: [
        { id: '1', branch: 'bacoor', business_date: '2026-08-18', status: 'accepted', submitted: { total_sales_minor: 10000 } },
        { id: '2', branch: 'bacoor', business_date: '2026-08-19', status: 'accepted', submitted: { total_sales_minor: 20000 } },
        { id: '3', branch: 'bacoor', business_date: '2026-08-20', status: 'accepted', submitted: { square_sales_minor: 30000 } },
      ],
      runs: [],
    })
    assert.equal(queue.ready_day_count, 3)
    assert.equal(queue.groups.length, 1)
    assert.equal(queue.groups[0].period_start, '2026-08-18')
    assert.equal(queue.groups[0].period_end, '2026-08-20')
    assert.equal(queue.groups[0].total_sales_minor, 60000)
    assert.equal(queue.groups[0].days.length, 3)
  })

  it('drops days already covered by a confirmed floor run', () => {
    const queue = buildPendingFloorPayrollQueue({
      closes: [
        { id: '1', branch: 'bacoor', business_date: '2026-08-18', status: 'accepted', submitted: { total_sales_minor: 1 } },
        { id: '2', branch: 'bacoor', business_date: '2026-08-19', status: 'accepted', submitted: { total_sales_minor: 1 } },
        { id: '3', branch: 'bacoor', business_date: '2026-08-20', status: 'accepted', submitted: { total_sales_minor: 1 } },
      ],
      runs: [
        {
          branch: 'bacoor',
          period_start: '2026-08-18',
          period_end: '2026-08-18',
          status: 'confirmed',
          run_kind: 'floor',
        },
      ],
    })
    assert.equal(queue.ready_day_count, 2)
    assert.equal(queue.groups[0].period_start, '2026-08-19')
    assert.equal(queue.groups[0].period_end, '2026-08-20')
  })

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
    assert.equal(shiftClosePayrollCoverage(close, []).label, 'Pending floor pay')
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

  it('payload includes run_kind for finance accuracy', () => {
    const payload = buildRunPayrollPayload({
      preview: {
        period: { start: '2026-08-18', end: '2026-08-20' },
        rules: { wash_pool_pct: 35 },
        proof: [],
        lines: [{ staff_id: 's1', staff_name: 'A', branch: 'bacoor', kind: 'wash_pool', pay_minor: 100 }],
      },
      branch: 'bacoor',
      frequency: 'custom',
      runKind: 'floor',
      notes: 'Floor pay',
    })
    assert.equal(payload.run_kind, 'floor')
  })

  it('dashboard and migration wire pending floor accumulation', () => {
    const page = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
    assert.match(page, /buildPendingFloorPayrollQueue/)
    assert.match(page, /Pending floor pay/)
    assert.match(page, /startAccumulatedFloorPay/)
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821170000_payroll_run_kind_pending_floor.sql'),
      'utf8',
    )
    assert.match(mig, /run_kind/)
    assert.match(mig, /payroll_runs_floor_coverage_idx/)
    assert.match(mig, /shift_close_reports_pending_payroll_idx/)
    const finance = readFileSync(join(root, 'src/pages/finance/FinanceShiftCloseTab.jsx'), 'utf8')
    assert.match(finance, /shiftClosePayrollCoverage/)
    assert.match(finance, /Floor pay/)
  })
})
