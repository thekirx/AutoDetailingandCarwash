import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'scripts', 'e2e-daily-sheet-money.mjs')

describe('Daily Sheet live money contract', () => {
  it('scripts/e2e-daily-sheet-money.mjs covers the full sheet lifecycle on a sandbox date', () => {
    assert.equal(existsSync(script), true, 'e2e-daily-sheet-money.mjs must exist')
    const src = readFileSync(script, 'utf8')
    for (const name of [
      'sheet.anon_save_refused',
      'sheet.tl_save_refused',
      'sheet.ba_other_branch_refused',
      'sheet.direct_insert_refused',
      'sheet.submit_needs_salary_reason',
      'sheet.submit_needs_over_short_note',
      'sheet.ba_cannot_approve',
      'sheet.return_needs_note',
      'sheet.sa_return',
      'sheet.sa_approve',
      'sheet.posted_paid_expenses',
      'sheet.re_approve_posts_nothing',
      'sheet.audit_trail',
      'sheet.sa_reopen_voids',
      'receipts.ba_other_branch_refused',
      'rate.ba_cannot_set_daily_rate',
      'legacy.ba_run_payroll_denied',
      'legacy.submit_shift_close_denied',
      'legacy.review_shift_close_denied',
      'cleanup.sandbox_wiped',
    ]) {
      assert.match(src, new RegExp(`'${name.replace(/\./g, '\\.')}'`), `missing ${name}`)
    }
    assert.match(src, /QA_DATE = '2000-/, 'must stay on a far-past sandbox date, never a live business day')
    assert.match(src, /finally \{\s*await cleanup\(\)/, 'sandbox must be wiped even when a check fails')
  })
})
