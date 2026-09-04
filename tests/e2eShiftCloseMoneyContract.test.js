/**
 * Seams (BUG-007 residual + CHEM-RECON):
 * 1) BA RPC submit_shift_close on QA sandbox business_date
 * 2) Boss RPC review_shift_close accept → status accepted
 * 3) Optional QA chem recon seed when approved_count was 0
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
      'chem.qa_seed_if_empty',
    ]) {
      assert.match(src, new RegExp(name.replace(/\./g, '\\.')), `missing ${name}`)
    }
    assert.match(src, /submit_shift_close/)
    assert.match(src, /review_shift_close/)
    assert.match(src, /2099-01-01/)
  })
})
