/**
 * Phase 0 — seed audit fixture seam.
 * Dry-run counts + required table tags in the seed script.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAuditFixture, BACOOR, IMUS } from '../src/lib/auditFixtures.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('seed audit fixtures', () => {
  it('builds multi-branch month with required row counts', () => {
    const f = buildAuditFixture()
    assert.equal(f.meta.branches.includes(BACOOR), true)
    assert.equal(f.meta.branches.includes(IMUS), true)
    assert.ok(f.counts.staff >= 8)
    assert.ok(f.counts.attendance_rows >= 30 * 4)
    assert.ok(f.counts.sales_month >= 60)
    assert.ok(f.counts.expenses >= 5)
    assert.ok(f.counts.shift_closes >= 5)
    assert.ok(f.counts.bookings >= 2)
    assert.ok(f.counts.operating_hours >= 14)
    assert.ok(f.counts.expense_reports >= 1)
  })

  it('seed script source-scans required tables and dry-run flag', () => {
    const src = readFileSync(join(root, 'scripts/seed-audit-data.mjs'), 'utf8')
    for (const table of [
      'branch_operating_hours',
      'staff_attendance',
      'sales',
      'expenses',
      'shift_close_reports',
      'bookings',
      'expense_categories',
      'expense_reports',
      'payroll_runs',
    ]) {
      assert.match(src, new RegExp(table))
    }
    assert.match(src, /--dry-run/)
    assert.match(src, /buildAuditFixture/)
  })

  it('dry-run summary file is written when script was run (optional)', () => {
    const path = join(root, 'docs/audits/2026-08-31/seed-fixture-summary.json')
    if (!existsSync(path)) return
    const json = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(json.ok, true)
    assert.ok(json.counts.sales_month >= 60)
  })
})
