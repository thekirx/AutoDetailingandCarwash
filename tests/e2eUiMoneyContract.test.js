/**
 * BUG-007 seam contract: money UI pack must exist and encode the floor path
 * Admin queue → POS → End of shift wizard; Boss finance shift-close; TL POS denied.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { canAccessPos } from '../src/auth/permissions.js'
import { canReviewShiftClose, canSubmitShiftClose } from '../src/lib/shiftClose.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const moneyScript = join(root, 'scripts', 'e2e-ui-money.mjs')

describe('BUG-007 money UI pack contract', () => {
  it('RBAC: TL cannot POS; admin can POS + submit EoS; Boss reviews closes', () => {
    assert.equal(canAccessPos({ role: 'team_lead' }), false)
    assert.equal(canAccessPos({ role: 'admin' }), true)
    assert.equal(canSubmitShiftClose({ role: 'admin' }), true)
    assert.equal(canSubmitShiftClose({ role: 'team_lead' }), false)
    assert.equal(canReviewShiftClose({ role: 'BossMich' }), true)
    assert.equal(canReviewShiftClose({ role: 'admin' }), false)
  })

  it('scripts/e2e-ui-money.mjs covers required flow names', () => {
    assert.equal(existsSync(moneyScript), true, 'e2e-ui-money.mjs must exist')
    const src = readFileSync(moneyScript, 'utf8')
    for (const name of [
      'money.tl.pos_denied',
      'money.admin.queue',
      'money.admin.pos',
      'money.admin.eos_wizard',
      'money.boss.finance_shift_close',
    ]) {
      assert.match(src, new RegExp(name.replace(/\./g, '\\.')), `missing flow ${name}`)
    }
  })
})
