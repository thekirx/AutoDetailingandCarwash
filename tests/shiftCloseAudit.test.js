/**
 * Phase 3 — End of shift / Finance accept audit.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { moneySnapshotFromReport } from '../src/lib/shiftClose.js'
import { buildShiftCloses } from '../src/lib/auditFixtures.js'

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

  it('5 locked close cannot be treated as editable submitted', () => {
    const locked = closes.find((c) => c.id === 'close-bacoor-prev')
    assert.equal(locked.status, 'locked')
    assert.notEqual(locked.status, 'submitted')
  })

  it('7 day expenses + CA reduce cash left on close snapshot', () => {
    const close = closes.find((c) => c.id === 'close-bacoor-day')
    const snap = moneySnapshotFromReport(close.submitted)
    assert.equal(snap.total_expenses_minor, 155_000)
    assert.equal(snap.ca_collected_minor, 20_000)
    // cash left = cash sales − expenses + CA collected (when modeled that way)
    assert.equal(snap.total_cash_left_minor, 115_000)
  })

  it('legacy reopen rules stay in SQL; Finance shows old closes read-only', () => {
    const sql = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20260923143000_shift_close_reopen.sql'),
      'utf8',
    )
    assert.match(sql, /'reopen'/)
    assert.match(sql, /Only Super Admin may reopen an accepted close/)
    assert.match(sql, /Only accepted reports can be reopened/)
    assert.match(sql, /v_status = 'locked'/)
    assert.match(sql, /char_length\(v_note\) < 3/)
    const page = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/pages/finance/FinanceShiftCloseTab.jsx'),
      'utf8',
    )
    // The Daily Sheet migration revokes review_shift_close, so the Finance tab is history only.
    assert.doesNotMatch(page, /review_shift_close|review\('(accept|reject|reopen|lock)'\)|shift_close_field_config'\)\s*\.update/)
    assert.match(page, /Read-only history from before Daily Sheets/)
    assert.match(page, /\/operations\/finance\?tab=sheets/)
  })
})
