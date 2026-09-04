/**
 * Admin console pulse — sample revenue/expense/profit tiles removed; today revenue kept.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('admin console profit pulse', () => {
  it('keeps today revenue and drops sample pulse tiles', () => {
    const src = readFileSync(join(root, 'src/pages/AdminConsolePage.jsx'), 'utf8')
    assert.match(src, /Today revenue/)
    assert.match(src, /todayRevenueMinor/)
    assert.doesNotMatch(src, /Sample revenue/)
    assert.doesNotMatch(src, /Sample expenses/)
    assert.doesNotMatch(src, /Sample profit|Sample loss/)
  })

  it('fetchAdminConsoleSnapshot still computes profit for API consumers', () => {
    const api = readFileSync(join(root, 'src/lib/adminApi.js'), 'utf8')
    assert.match(api, /\['paid', 'posted'\]/)
    assert.match(api, /const profitMinor = revenueMinor - approvedExpenseMinor/)
    assert.match(api, /profitMinor,/)
  })
})
