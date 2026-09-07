/**
 * Seams (BUG-007 residual + CHEM-RECON + owner SMS):
 * 1) BA RPC submit_shift_close on QA sandbox business_date
 * 2) Boss RPC review_shift_close accept → status accepted
 * 3) Owner SMS phone resolve (+ optional live send via SEND_LIVE_OWNER_SMS=1)
 * 4) Pending floor queue + hard gate unlock for that sandbox day
 * 5) Boss run_payroll confirm with sale claim + sandbox cleanup
 * 6) Approved chem recon + at least one recon line
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'scripts', 'e2e-shift-close-money.mjs')

describe('BUG-007 shift-close money RPC contract', () => {
  it('scripts/e2e-shift-close-money.mjs covers required flow names', () => {
    assert.equal(existsSync(script), true, 'e2e-shift-close-money.mjs must exist')
    const src = readFileSync(script, 'utf8')
    for (const name of [
      'money.rpc.ba_submit',
      'money.rpc.boss_accept',
      'money.rpc.status_accepted',
      'money.payroll.pending_floor_after_accept',
      'money.payroll.hard_gate_unlocked',
      'money.rpc.sandbox_sale_seed',
      'money.rpc.run_payroll_confirm',
      'money.rpc.run_payroll_sale_claim',
      'money.rpc.run_payroll_cleanup',
      'chem.qa_seed_if_empty',
      'chem.qa_recon_line',
    ]) {
      assert.match(src, new RegExp(name.replace(/\./g, '\\.')), `missing ${name}`)
    }
    assert.match(src, /listOwnerSmsPhones/)
    assert.match(src, /money\.owner_sms\.phone_(sources|gap)/)
    assert.match(src, /money\.owner_sms\.notify_(skip|sent|dry)/)
    assert.match(src, /SEND_LIVE_OWNER_SMS/)
    assert.match(src, /notifyShiftCloseAccepted/)
    assert.match(src, /submit_shift_close/)
    assert.match(src, /review_shift_close/)
    assert.match(src, /run_payroll/)
    assert.match(src, /payroll_run_sales/)
    assert.match(src, /buildPendingFloorPayrollQueue/)
    assert.match(src, /floorConfirmBlockedByPendingCloses/)
    assert.match(src, /inventory_recon_lines/)
    assert.match(src, /2099-01-01/)
  })
})
