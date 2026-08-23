/**
 * POS / Payroll settings seam: DB-backed lists + attendance policy on compensation_settings.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePosSettings, toPosSettingsRow } from '../src/lib/posSettings.js'
import {
  attendanceWeight,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '../src/lib/compensation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS + Payroll settings', () => {
  it('normalizes ops_pos_settings payment methods and expense kinds', () => {
    const n = normalizePosSettings({
      payment_methods: [{ value: 'cash', label: 'Cash' }, { value: 'maya', label: 'Maya' }],
      expense_kinds: [{ value: 'daily', label: 'Daily' }],
    })
    assert.equal(n.payment_methods.length, 2)
    assert.equal(n.expense_kinds[0].value, 'daily')
    const row = toPosSettingsRow(n)
    assert.equal(row.id, 1)
    assert.equal(row.payment_methods[1].value, 'maya')
  })

  it('forces cash_advance_auto_deduct off; pending_floor_optional persists', () => {
    const n = normalizeCompensationSettings({
      wash_pool_pct: 40,
      attendance_present_weight: 1,
      attendance_late_weight: 0.5,
      cash_advance_auto_deduct: true,
      pending_floor_optional: false,
    })
    assert.equal(attendanceWeight('late', n), 0.5)
    assert.equal(attendanceWeight('present', n), 1)
    assert.equal(n.cash_advance_auto_deduct, false)
    const row = toCompensationSettingsRow(n)
    assert.equal(row.cash_advance_auto_deduct, false)
    assert.equal(row.pending_floor_optional, false)
    assert.equal(row.attendance_late_weight, 0.5)
  })

  it('routes and migration ship settings modules', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    assert.match(app, /settings\/pos/)
    assert.match(app, /settings\/payroll/)
    const hub = readFileSync(join(root, 'src/pages/SettingsHubPage.jsx'), 'utf8')
    assert.match(hub, /POS settings/)
    assert.match(hub, /Payroll settings/)
    const mig = readFileSync(join(root, 'supabase/migrations/20260821210000_pos_payroll_settings.sql'), 'utf8')
    assert.match(mig, /ops_pos_settings/)
    assert.match(mig, /cash_advance_auto_deduct/)
  })
})
