/**
 * End-of-shift close: validation, money snapshot, RBAC helpers, wiring scan.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moneySnapshotFromReport, parsePesosToMinor, shiftCloseDiffRows, shiftCloseFieldLabel, SHIFT_CLOSE_FIELD_LABELS } from '../src/lib/shiftClose.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('shift close money helpers', () => {
  it('parses pesos to minor and rejects negatives', () => {
    assert.equal(parsePesosToMinor('12.50'), 1250)
    assert.equal(parsePesosToMinor('0'), 0)
    assert.equal(parsePesosToMinor('-1'), null)
    assert.equal(parsePesosToMinor('abc'), null)
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

describe('shift close wiring', () => {
  it('End of shift is retired from POS; Finance keeps the legacy history tab', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    const fin = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260821120000_shift_end_asa_semimonthly.sql'),
      'utf8',
    )
    assert.doesNotMatch(pos, /submit_shift_close|ShiftCloseWizard|openEndOfShift/)
    assert.equal(existsSync(join(root, 'src/components/ShiftCloseWizard.jsx')), false)
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
