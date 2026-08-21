import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS + payroll concurrency guards', () => {
  it('POS one-sale migration locks handoff and unique-indexes paid sales', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260819133000_pos_handoff_one_sale.sql'),
      'utf8',
    )
    assert.match(sql, /for update/i)
    assert.match(sql, /sales_pos_handoff_paid_uidx/)
    assert.match(sql, /This ticket is already paid/)
  })

  it('run_payroll serializes confirms with advisory lock', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260820190000_run_payroll_advisory_lock.sql'),
      'utf8',
    )
    assert.match(sql, /pg_advisory_xact_lock\(87201401\)/)
    assert.match(sql, /Overlapping payroll run already exists/)
    assert.match(sql, /sale already paid in another payroll run/)
    assert.match(sql, /revoke all on function public\.run_payroll\(jsonb\) from public, anon/)
  })

  it('payroll_runs schema unique-indexes each sale to one run', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260819100000_payroll_runs.sql'),
      'utf8',
    )
    assert.match(sql, /payroll_run_sales_sale_uidx/)
  })
})
