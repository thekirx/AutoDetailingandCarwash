/**
 * Phase 3 — End of shift / Finance accept audit.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  moneySnapshotFromReport,
  validateShiftCloseSubmit,
} from '../src/lib/shiftClose.js'
import {
  floorConfirmBlockedByPendingCloses,
} from '../src/lib/payroll.js'
import {
  AUDIT_DAY,
  BACOOR,
  IMUS,
  buildShiftCloses,
} from '../src/lib/auditFixtures.js'

const closes = buildShiftCloses()

describe('shift close audit', () => {
  it('1 BA close with matching drawer has variance 0', () => {
    const close = closes.find((c) => c.id === 'close-bacoor-day')
    assert.equal(close.variance_minor, 0)
    assert.equal(close.status, 'accepted')
    const snap = moneySnapshotFromReport(close.submitted)
    assert.equal(snap.square_sales_minor || snap.total_sales_minor, 600_000)
  })

  it('2 close with short variance is visible on review', () => {
    const short = closes.find((c) => c.id === 'close-bacoor-short')
    assert.equal(short.variance_minor, -5_000)
    assert.equal(short.status, 'submitted')
  })

  it('3 BA salary_draft_extras surface on accepted close', () => {
    const close = closes.find((c) => c.id === 'close-bacoor-day')
    assert.ok(Array.isArray(close.submitted.salary_draft_extras))
    assert.equal(close.submitted.salary_draft_extras[0].staff_id, 'crew-bacoor-on')
    assert.equal(close.submitted.salary_draft_extras[0].amount_minor, 5_000)
  })

  it('4 Finance accept → accepted status enables pending floor', () => {
    const accepted = closes.filter((c) => c.status === 'accepted')
    assert.ok(accepted.length >= 2)
    const gate = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: BACOOR,
      periodStart: AUDIT_DAY,
      periodEnd: AUDIT_DAY,
      closes,
    })
    assert.equal(gate.blocked, false)
  })

  it('5 locked close cannot be treated as editable submitted', () => {
    const locked = closes.find((c) => c.id === 'close-bacoor-prev')
    assert.equal(locked.status, 'locked')
    assert.notEqual(locked.status, 'submitted')
  })

  it('6 missing accepted close blocks payroll confirm', () => {
    const gate = floorConfirmBlockedByPendingCloses({
      pendingFloorOptional: false,
      runKind: 'floor',
      branch: IMUS,
      periodStart: '2026-08-15',
      periodEnd: '2026-08-15',
      closes: [],
    })
    assert.equal(gate.blocked, true)
    assert.match(gate.reason || '', /accepted|close/i)
  })

  it('7 day expenses + CA reduce cash left on close snapshot', () => {
    const close = closes.find((c) => c.id === 'close-bacoor-day')
    const snap = moneySnapshotFromReport(close.submitted)
    assert.equal(snap.total_expenses_minor, 155_000)
    assert.equal(snap.ca_collected_minor, 20_000)
    // cash left = cash sales − expenses + CA collected (when modeled that way)
    assert.equal(snap.total_cash_left_minor, 115_000)
  })

  it('validateShiftCloseSubmit accepts matching baseline', () => {
    const baseline = moneySnapshotFromReport({
      total_sales_minor: 100_000,
      square_sales_minor: 100_000,
      cash_sales_minor: 100_000,
      total_expenses_minor: 10_000,
      ca_collected_minor: 0,
      total_cash_left_minor: 90_000,
    })
    const result = validateShiftCloseSubmit({
      baseline,
      submitted: { ...baseline },
      reasons: {},
      fieldConfig: [],
    })
    assert.equal(result.ok, true)
  })
})
