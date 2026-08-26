/**
 * End-of-shift close: validation, money snapshot, RBAC helpers, wiring scan.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canReviewShiftClose,
  canSubmitShiftClose,
  datetimeLocalToIso,
  moneySnapshotFromReport,
  parsePesosToMinor,
  shiftCloseDiffRows,
  shiftCloseFieldLabel,
  toDatetimeLocalValue,
  validateShiftCloseSubmit,
  SHIFT_CLOSE_FIELD_LABELS,
} from '../src/lib/shiftClose.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('shift close money helpers', () => {
  it('parses pesos to minor and rejects negatives', () => {
    assert.equal(parsePesosToMinor('12.50'), 1250)
    assert.equal(parsePesosToMinor('0'), 0)
    assert.equal(parsePesosToMinor('-1'), null)
    assert.equal(parsePesosToMinor('abc'), null)
  })

  it('requires override reason when submitted ≠ baseline', () => {
    const baseline = moneySnapshotFromReport({ total_gcash_minor: 10000 })
    const submitted = { ...baseline, total_gcash_minor: 12000 }
    const bad = validateShiftCloseSubmit({
      baseline,
      submitted,
      reasons: {},
      fieldConfig: [{ field_key: 'total_gcash_minor', allow_override: true, is_active: true }],
    })
    assert.equal(bad.ok, false)
    assert.ok(bad.errors.total_gcash_minor)

    const good = validateShiftCloseSubmit({
      baseline,
      submitted,
      reasons: { total_gcash_minor: 'Counted drawer twice' },
      fieldConfig: [{ field_key: 'total_gcash_minor', allow_override: true, is_active: true }],
    })
    assert.equal(good.ok, true)
    assert.equal(good.overrideReasons.total_gcash_minor, 'Counted drawer twice')
  })

  it('cash left and CA collected are first-class override money keys', () => {
    const baseline = moneySnapshotFromReport({
      total_cash_left_minor: 50000,
      ca_collected_minor: 0,
      total_gcash_minor: 10000,
    })
    assert.equal(baseline.total_cash_left_minor, 50000)
    assert.equal(baseline.ca_collected_minor, 0)
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821130000_shift_close_money_fields_complete.sql'),
      'utf8',
    )
    assert.match(mig, /ca_collected_minor/)
    assert.match(mig, /total_cash_left_minor/)
    assert.match(mig, /total_gcash_minor/)
  })

  it('diff rows only list changed fields', () => {
    const base = moneySnapshotFromReport({ total_gcash_minor: 100, credit_card_minor: 50 })
    const sub = { ...base, total_gcash_minor: 200 }
    const rows = shiftCloseDiffRows(base, sub, [
      { field_key: 'total_gcash_minor', label: 'Total GCash' },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].delta_minor, 100)
  })
})

describe('shift close RBAC helpers', () => {
  it('BA/SA/ASA(pos) submit; SA and ASA finance_view review', () => {
    assert.equal(canSubmitShiftClose({ role: 'admin' }), true)
    assert.equal(canSubmitShiftClose({ role: 'BossMich' }), true)
    assert.equal(canSubmitShiftClose({ role: 'staff' }), false)
    assert.equal(
      canSubmitShiftClose({ role: 'assistant_super_admin', permission_grants: { pos: true } }),
      true,
    )
    assert.equal(
      canSubmitShiftClose({ role: 'assistant_super_admin', permission_grants: { pos: false, finance_write: false } }),
      false,
    )
    assert.equal(canReviewShiftClose({ role: 'BossMich' }), true)
    assert.equal(
      canReviewShiftClose({ role: 'assistant_super_admin', permission_grants: { finance_view: true } }),
      true,
    )
    assert.equal(
      canReviewShiftClose({ role: 'assistant_super_admin', permission_grants: { finance_view: false } }),
      false,
    )
  })

  it('datetime-local helpers round-trip', () => {
    const local = toDatetimeLocalValue(new Date('2026-08-21T20:15:00'))
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.ok(datetimeLocalToIso(local))
    assert.equal(datetimeLocalToIso(''), null)
  })
})

describe('shift close wiring', () => {
  it('POS submits RPC with shift end time; ASA allowed in migration', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    const fin = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    const wiz = readFileSync(join(root, 'src/components/ShiftCloseWizard.jsx'), 'utf8')
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821120000_shift_end_asa_semimonthly.sql'),
      'utf8',
    )
    assert.match(pos, /submit_shift_close/)
    assert.match(pos, /ShiftCloseWizard/)
    assert.match(pos, /shift_ended_at/)
    assert.match(pos, /End of shift/)
    assert.match(pos, /hakum-pos-end-shift/)
    assert.match(pos, /openEndOfShift/)
    assert.match(wiz, /Total sales/)
    assert.match(wiz, /From POS/)
    assert.match(fin, /FinanceShiftCloseTab/)
    assert.match(fin, /shift-close/)
    assert.match(mig, /shift_ended_at/)
    assert.match(mig, /assistant_super_admin/)
    assert.match(mig, /semimonthly/)
  })

  it('never labels Total sales as Square in UI helpers', () => {
    assert.equal(SHIFT_CLOSE_FIELD_LABELS.square_sales_minor, 'Total sales')
    assert.equal(shiftCloseFieldLabel('square_sales_minor'), 'Total sales')
    assert.equal(
      shiftCloseFieldLabel('square_sales_minor', [
        { field_key: 'square_sales_minor', label: 'Square sales' },
      ]),
      'Total sales',
    )
  })
})
