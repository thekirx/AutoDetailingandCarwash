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
  moneySnapshotFromReport,
  parsePesosToMinor,
  shiftCloseDiffRows,
  validateShiftCloseSubmit,
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
  it('BA/SA submit; SA and ASA finance_view review', () => {
    assert.equal(canSubmitShiftClose({ role: 'admin' }), true)
    assert.equal(canSubmitShiftClose({ role: 'BossMich' }), true)
    assert.equal(canSubmitShiftClose({ role: 'staff' }), false)
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
})

describe('shift close wiring', () => {
  it('POS submits RPC; Finance hosts review tab; migration has tables', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    const fin = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821010000_shift_close_reports.sql'),
      'utf8',
    )
    assert.match(pos, /submit_shift_close/)
    assert.match(pos, /End of shift/)
    assert.match(fin, /FinanceShiftCloseTab/)
    assert.match(fin, /shift-close/)
    assert.match(mig, /create table if not exists public\.shift_close_reports/)
    assert.match(mig, /submit_shift_close/)
    assert.match(mig, /review_shift_close/)
  })
})
