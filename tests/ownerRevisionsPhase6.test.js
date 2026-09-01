/**
 * Phase 6 seams: BA salary_draft_extras shape, detailer CA permission, My Pay period helper.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  attachSalaryDraftExtras,
  normalizeSalaryDraftExtras,
} from '../src/lib/shiftClose.js'
import {
  applySalaryDraftExtrasToPreview,
  buildPendingFloorPayrollQueue,
  collectSalaryDraftExtrasFromCloses,
  payrollPeriodRange,
} from '../src/lib/payroll.js'
import { canSubmitOpsFormKind, ROLES } from '../src/auth/permissions.js'
import { salaryPctPoolMinor, washPoolAmountMinor } from '../src/lib/compensation.js'

describe('salary_draft_extras shape', () => {
  it('normalizes valid extras and drops junk', () => {
    const rows = normalizeSalaryDraftExtras([
      { staff_name: 'Ana', amount_minor: 50000, kind: 'extra', note: 'OT' },
      { staff_id: 'u1', staff_name: 'Ben', amount_minor: 10000, kind: 'deduction' },
      { staff_name: '', amount_minor: 100, kind: 'extra' },
      { staff_name: 'X', amount_minor: 0, kind: 'extra' },
      { staff_name: 'Y', amount_minor: 100, kind: 'bonus' },
    ])
    assert.equal(rows.length, 2)
    assert.deepEqual(rows[0], {
      staff_id: null,
      staff_name: 'Ana',
      amount_minor: 50000,
      note: 'OT',
      kind: 'extra',
    })
    assert.equal(rows[1].kind, 'deduction')
    assert.equal(rows[1].staff_id, 'u1')
  })

  it('attaches onto submitted jsonb under salary_draft_extras', () => {
    const submitted = attachSalaryDraftExtras(
      { square_sales_minor: 100 },
      [{ staff_name: 'Ana', amount_minor: 2500, kind: 'extra', note: 'tip pool' }],
    )
    assert.equal(submitted.square_sales_minor, 100)
    assert.equal(submitted.salary_draft_extras.length, 1)
    assert.equal(submitted.salary_draft_extras[0].amount_minor, 2500)
  })

  it('surfaces on pending floor queue from accepted close submitted', () => {
    const queue = buildPendingFloorPayrollQueue({
      closes: [
        {
          id: 'c1',
          branch: 'bacoor',
          business_date: '2026-08-22',
          status: 'accepted',
          submitted: {
            square_sales_minor: 100000,
            salary_draft_extras: [
              { staff_name: 'Ana', amount_minor: 5000, kind: 'extra', note: 'OT' },
            ],
          },
        },
      ],
      runs: [],
    })
    assert.equal(queue[0].salary_draft_extras.length, 1)
    assert.equal(queue.groups[0].salary_draft_extras[0].staff_name, 'Ana')
    const drafts = collectSalaryDraftExtrasFromCloses(queue[0] ? [
      {
        id: 'c1',
        branch: 'bacoor',
        business_date: '2026-08-22',
        status: 'accepted',
        submitted: {
          salary_draft_extras: [{ staff_name: 'Ana', amount_minor: 5000, kind: 'extra' }],
        },
      },
    ] : [], { branch: 'bacoor', periodStart: '2026-08-22', periodEnd: '2026-08-22' })
    assert.equal(drafts.length, 1)
    const preview = applySalaryDraftExtrasToPreview(
      { lines: [], total_payout_minor: 0 },
      drafts,
      [{ id: 's1', full_name: 'Ana', branch_slug: 'bacoor' }],
    )
    assert.equal(preview.lines.length, 1)
    assert.equal(preview.lines[0].direction, 'add')
  })
})

describe('detailer cash advance permission', () => {
  it('allows detailer to submit cash_advance; blocks Super Admin', () => {
    assert.equal(canSubmitOpsFormKind({ role: ROLES.DETAILER }, 'cash_advance'), true)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.STAFF }, 'cash_advance'), true)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.SUPER_ADMIN }, 'cash_advance'), false)
  })
})

describe('My Pay period helper', () => {
  it('supports daily weekly monthly annual custom via payrollPeriodRange', () => {
    assert.deepEqual(payrollPeriodRange('daily', '2026-08-19'), {
      start: '2026-08-19',
      end: '2026-08-19',
    })
    assert.deepEqual(payrollPeriodRange('weekly', '2026-08-19'), {
      start: '2026-08-17',
      end: '2026-08-23',
    })
    assert.deepEqual(payrollPeriodRange('monthly', '2026-08-19'), {
      start: '2026-08-01',
      end: '2026-08-31',
    })
    assert.deepEqual(payrollPeriodRange('annual', '2026-08-19'), {
      start: '2026-01-01',
      end: '2026-12-31',
    })
    assert.deepEqual(
      payrollPeriodRange('custom', '2026-08-19', { start: '2026-08-01', end: '2026-08-10' }),
      { start: '2026-08-01', end: '2026-08-10' },
    )
  })
})

describe('optional salary_pct preview', () => {
  it('excludes salary_pct lines from wash base and contributes direct pool', () => {
    const sale = {
      sale_line_items: [
        { line_total_minor: 100000, services: { pay_category: 'general' } },
        { line_total_minor: 50000, services: { pay_category: 'general', salary_pct: 20 } },
      ],
    }
    assert.equal(washPoolAmountMinor(sale), 100000)
    assert.equal(salaryPctPoolMinor(sale), 10000)
  })
})
