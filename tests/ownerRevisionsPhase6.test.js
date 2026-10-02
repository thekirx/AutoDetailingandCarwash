/**
 * Phase 6 seams: BA salary_draft_extras shape, detailer CA permission, My Pay period helper.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeSalaryDraftExtras } from '../src/lib/shiftClose.js'
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


})

describe('detailer cash advance permission', () => {
  it('allows detailer to submit cash_advance; blocks Super Admin', () => {
    assert.equal(canSubmitOpsFormKind({ role: ROLES.DETAILER }, 'cash_advance'), true)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.STAFF }, 'cash_advance'), true)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.SUPER_ADMIN }, 'cash_advance'), false)
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
