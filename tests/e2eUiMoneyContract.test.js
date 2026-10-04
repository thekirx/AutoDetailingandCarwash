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
})
