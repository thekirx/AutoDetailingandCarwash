import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFloorPreviewToBacoorReport,
  buildPendingFloorPayrollQueue,
  floorConfirmBlockedByPendingCloses,
  posProofTotalsByBranchDay,
} from '../src/lib/payroll.js'
import { normalizeCompensationSettings } from '../src/lib/compensation.js'
import { shiftCloseHasActivity } from '../src/lib/bacoorDailyReport.js'

describe('money contract seams', () => {
  it('forces cash_advance_auto_deduct off in normalize', () => {
    const n = normalizeCompensationSettings({ cash_advance_auto_deduct: true, pending_floor_optional: false })
    assert.equal(n.cash_advance_auto_deduct, false)
    assert.equal(n.pending_floor_optional, false)
  })

  it('pending queue shows close attested and POS proof side by side', () => {
    const proof = posProofTotalsByBranchDay([
      { status: 'paid', branch: 'bacoor', total_minor: 2175000, occurred_at: '2026-08-22T10:00:00+08:00' },
    ])
    const q = buildPendingFloorPayrollQueue({
      closes: [
        {
          id: 'c1',
          branch: 'bacoor',
          business_date: '2026-08-22',
          status: 'accepted',
          submitted: { square_sales_minor: 2000000 },
        },
      ],
      runs: [],
      posProofByKey: proof,
    })
    assert.equal(q.days[0].close_sales_minor, 2000000)
    assert.equal(q.days[0].pos_proof_minor, 2175000)
    assert.equal(q.groups[0].pos_proof_known, true)
  })

  it('hard-blocks floor confirm when pending_floor_optional is false and close not accepted', () => {
    const blocked = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: 'bacoor',
      periodStart: '2026-08-22',
      periodEnd: '2026-08-22',
      closes: [
        { branch: 'bacoor', business_date: '2026-08-22', status: 'submitted' },
      ],
    })
    assert.equal(blocked.blocked, true)
    assert.match(blocked.reason, /Accept/i)

    const ok = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: 'bacoor',
      periodStart: '2026-08-22',
      periodEnd: '2026-08-22',
      closes: [
        { branch: 'bacoor', business_date: '2026-08-22', status: 'accepted' },
      ],
    })
    assert.equal(ok.blocked, false)

    const soft = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: true,
      runKind: 'floor',
      branch: 'bacoor',
      periodStart: '2026-08-22',
      periodEnd: '2026-08-22',
      closes: [],
    })
    assert.equal(soft.blocked, false)
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
})
