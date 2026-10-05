/**
 * BUG-007 seam contract: money UI pack must exist and encode the floor path
 * Admin POS → Daily sheet (queue is denied); Boss Finance → Daily sheets; TL POS denied.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const moneyScript = join(root, 'scripts', 'e2e-ui-money.mjs')

describe('BUG-007 money UI pack contract', () => {

  it('scripts/e2e-ui-money.mjs covers required flow names', () => {
    assert.equal(existsSync(moneyScript), true, 'e2e-ui-money.mjs must exist')
    const src = readFileSync(moneyScript, 'utf8')
    for (const name of [
      'money.tl.pos_denied',
      'money.admin.queue_denied',
      'money.admin.pos',
      'money.admin.daily_sheet',
      'money.boss.finance_sheets',
    ]) {
      assert.match(src, new RegExp(name.replace(/\./g, '\\.')), `missing flow ${name}`)
    }
    assert.doesNotMatch(src, /End of shift|tab=shift-close/, 'retired End of shift flow must not be asserted')
  })

  it('scripts/e2e-lifecycle-flops.mjs is Daily Sheet–aware (read-only sheet; no EoS wait)', () => {
    const flops = join(root, 'scripts', 'e2e-lifecycle-flops.mjs')
    assert.equal(existsSync(flops), true, 'e2e-lifecycle-flops.mjs must exist')
    const src = readFileSync(flops, 'utf8')
    assert.match(src, /Daily sheet|daily_sheets/, 'FLOPS must reference Daily Sheet')
    assert.match(src, /e2e-daily-sheet-money/, 'FLOPS must point money writes to daily-sheet-money')
    assert.doesNotMatch(src, /waitForFunction\(\(\) => \/End of shift/, 'must not wait for retired End of shift UI')
    assert.doesNotMatch(src, /tab=shift-close|ShiftCloseWizard/, 'retired shift-close UI must not be driven')
  })
})
