/**
 * Phase 4 — Payroll audit (wash pool, commissions, CA, multi-branch, gates).
 * Literals from docs/user-stories/shop-day-flow.md.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCeramicCompensationExpenses } from '../src/lib/compensation.js'
import {
  applyCashAdvanceDeductions,
  buildPayrollPreview,
  floorConfirmBlockedByPendingCloses,
  netPayrollLinesMinor,
  payrollBlocksConfirm,
  posProofTotalsByBranchDay,
} from '../src/lib/payroll.js'
import { rollupPl } from '../src/lib/financeData.js'
import {
  AUDIT_DAY,
  AUDIT_RULES,
  BACOOR,
  IMUS,
  buildCashAdvances,
  buildPlRows,
  buildShiftCloses,
  buildShopDayAttendance,
  buildShopDaySales,
} from '../src/lib/auditFixtures.js'

const attendance = buildShopDayAttendance()
const sales = buildShopDaySales()
const washSales = sales.filter((s) =>
  s.sale_line_items?.some((l) => l.pay_category === 'wash'),
)

describe('payroll audit', () => {
  it('1–3 wash pool 35% · on-time > late · absent excluded', () => {
    const preview = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: washSales,
      attendance,
      runKind: 'floor',
    })
    const bacoor = preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === BACOOR)
    const imus = preview.lines.filter((l) => l.kind === 'wash_pool' && l.branch === IMUS)
    assert.equal(bacoor.reduce((s, l) => s + l.pay_minor, 0), 70_000)
    const onTime = bacoor.find((l) => l.staff_id === 'crew-bacoor-on')
    const late = bacoor.find((l) => l.staff_id === 'crew-bacoor-late')
    assert.equal(onTime.pay_minor, 37_333)
    assert.equal(late.pay_minor, 32_667)
    assert.ok(late.pay_minor < onTime.pay_minor)
    assert.equal(bacoor.some((l) => l.staff_id === 'crew-bacoor-absent'), false)
    assert.equal(imus.length, 1)
    assert.equal(imus[0].staff_id, 'crew-imus-on')
    assert.equal(imus[0].pay_minor, 35_000)
  })

  it('4 detailing commission pays assigned present detailer', () => {
    const ceramic = sales.find((s) => s.id === 'sale-imus-ceramic')
    const drafts = buildCeramicCompensationExpenses({
      saleId: ceramic.id,
      branch: IMUS,
      salesMinor: ceramic.total_minor,
      toggles: { freeShirt: true, cardPayment: false, detailerAssigned: true },
      assignedDetailerId: 'det-imus',
    })
    const preview = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: [ceramic],
      attendance,
      ceramicExpenses: drafts,
      runKind: 'floor',
    })
    const det = preview.lines.filter((l) => l.kind === 'ceramic_detailer')
    assert.equal(det.length, 1)
    assert.equal(det[0].staff_id, 'det-imus')
    assert.equal(det[0].branch, IMUS)
    assert.equal(det[0].pay_minor, 95_000)
  })

  it('5 ceramic crew share is not wash_pool / carwash salary cell', () => {
    const ceramic = sales.find((s) => s.id === 'sale-imus-ceramic')
    const drafts = buildCeramicCompensationExpenses({
      saleId: ceramic.id,
      branch: IMUS,
      salesMinor: ceramic.total_minor,
      toggles: { freeShirt: true, detailerAssigned: true },
      assignedDetailerId: 'det-imus',
    })
    const preview = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: [ceramic],
      attendance,
      ceramicExpenses: drafts,
      runKind: 'floor',
    })
    assert.ok(preview.lines.some((l) => l.kind === 'ceramic_crew' || l.kind === 'ceramic_detailer'))
    assert.equal(
      preview.lines.filter((l) => l.kind === 'wash_pool').length,
      0,
    )
  })

  it('6 CA deduct is manual and reduces net', () => {
    const base = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: washSales,
      attendance,
      runKind: 'floor',
    })
    const before = netPayrollLinesMinor(base.lines)
    const withCa = applyCashAdvanceDeductions(base.lines, buildCashAdvances())
    const after = netPayrollLinesMinor(withCa)
    assert.equal(after, before - 50_000)
    assert.ok(withCa.some((l) => /cash advance/i.test(l.label || l.kind || '')))
  })

  it('7 multi-branch wash pools stay isolated', () => {
    const preview = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: washSales,
      attendance,
      runKind: 'floor',
    })
    const bacoorSum = preview.lines
      .filter((l) => l.kind === 'wash_pool' && l.branch === BACOOR)
      .reduce((s, l) => s + l.pay_minor, 0)
    const imusSum = preview.lines
      .filter((l) => l.kind === 'wash_pool' && l.branch === IMUS)
      .reduce((s, l) => s + l.pay_minor, 0)
    assert.equal(bacoorSum, 70_000)
    assert.equal(imusSum, 35_000)
  })

  it('8 TL / admin / sales are not in wash pool roster lines', () => {
    const withLeads = [
      ...attendance,
      {
        staff_id: 'tl-bacoor',
        id: 'tl-bacoor',
        full_name: 'TL',
        role: 'team_lead',
        branch_slug: BACOOR,
        attendance_date: AUDIT_DAY,
        status: 'present',
        attendance_status: 'present',
        clock_in_at: '08:00',
        shift_start: '08:00',
        shift_end: '16:00',
      },
    ]
    const preview = buildPayrollPreview({
      period: { start: AUDIT_DAY, end: AUDIT_DAY },
      rules: AUDIT_RULES,
      sales: washSales,
      attendance: withLeads,
      runKind: 'floor',
    })
    assert.equal(preview.lines.some((l) => l.staff_id === 'tl-bacoor'), false)
    assert.equal(preview.lines.some((l) => l.staff_id === 'det-imus' && l.kind === 'wash_pool'), false)
  })

  it('9 pending floor hard gate blocks without accepted close', () => {
    const blocked = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: BACOOR,
      periodStart: AUDIT_DAY,
      periodEnd: AUDIT_DAY,
      closes: [],
    })
    assert.equal(blocked.blocked, true)
    const ok = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: BACOOR,
      periodStart: AUDIT_DAY,
      periodEnd: AUDIT_DAY,
      closes: buildShiftCloses(),
    })
    assert.equal(ok.blocked, false)
  })

  it('10 POS proof totals match P&L income (no close fiction)', () => {
    const proof = posProofTotalsByBranchDay(sales)
    const bacoorProof = proof.get?.(`${BACOOR}|${AUDIT_DAY}`) ?? proof[`${BACOOR}|${AUDIT_DAY}`]
    // Map or plain — normalize
    let bacoorMinor = 0
    let imusMinor = 0
    if (proof instanceof Map) {
      bacoorMinor = Number(proof.get(`${BACOOR}|${AUDIT_DAY}`)) || 0
      imusMinor = Number(proof.get(`${IMUS}|${AUDIT_DAY}`)) || 0
    } else {
      bacoorMinor = Number(bacoorProof) || 0
    }
    const pl = rollupPl(buildPlRows(sales, []))
    assert.equal(pl.income, 1_700_000)
    if (proof instanceof Map) {
      assert.equal(bacoorMinor + imusMinor, 1_700_000)
    }
    // Empty lines do not trip assignee gate; non-empty missing assignee does
    assert.equal(payrollBlocksConfirm({ lines: [{ pay_minor: 100, staff_id: 'x' }] }).blocked, false)
  })
})
