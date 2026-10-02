import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyFloorPreviewToBacoorReport } from '../src/lib/payroll.js'
import { normalizeCompensationSettings } from '../src/lib/compensation.js'
import { shiftCloseHasActivity } from '../src/lib/bacoorDailyReport.js'

describe('money contract seams', () => {
  it('forces cash_advance_auto_deduct off in normalize', () => {
    const n = normalizeCompensationSettings({ cash_advance_auto_deduct: true, pending_floor_optional: false })
    assert.equal(n.cash_advance_auto_deduct, false)
    assert.equal(n.pending_floor_optional, false)
  })

  it('applies wash pool preview onto Bacoor salary lines with pct', () => {
    const report = applyFloorPreviewToBacoorReport(
      { carwash_salary_minor: 0 },
      { pool_minor: 683500, lines: [], rules: { wash_pool_pct: 35 } },
      { wash_pool_pct: 35 },
    )
    assert.equal(report.carwash_salary_minor, 683500)
    assert.equal(report.wash_pool_pct, 35)
    assert.equal(report.salary_from_preview, true)
  })

  it('EoS activity gate skips empty days', () => {
    assert.equal(shiftCloseHasActivity({}), false)
    assert.equal(
      shiftCloseHasActivity({ sales: [{ status: 'paid', total_minor: 100 }] }),
      true,
    )
  })

  it('Branch Admin submits the Daily Sheet but cannot approve it or edit the books', async () => {
    const { canEditFinanceBooks, ROLES } = await import('../src/auth/permissions.js')
    const { canEditDailySheet, canReviewDailySheet } = await import('../src/lib/dailySheet.js')
    const ba = { role: ROLES.ADMIN, id: 'ba-1' }
    assert.equal(canEditDailySheet(ba), true)
    assert.equal(canReviewDailySheet(ba), false)
    assert.equal(canEditFinanceBooks(ba), false)
    const boss = { role: ROLES.SUPER_ADMIN, id: 'sa-1' }
    assert.equal(canReviewDailySheet(boss), true)
    assert.equal(canEditFinanceBooks(boss), true)
  })
})
