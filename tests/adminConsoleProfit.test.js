/**
 * Admin console pulse — sample revenue/expense/profit tiles removed; today revenue kept.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('retired admin console data helper', () => {
  it('removes the Console page', () => {
    assert.equal(existsSync(join(root, 'src/pages/AdminConsolePage.jsx')), false)
  })

  it('fetchAdminConsoleSnapshot still computes profit for API consumers', () => {
    const api = readFileSync(join(root, 'src/lib/adminApi.js'), 'utf8')
    assert.match(api, /\['paid', 'posted'\]/)
    assert.match(api, /const profitMinor = revenueMinor - approvedExpenseMinor/)
    assert.match(api, /profitMinor,/)
  })
})
