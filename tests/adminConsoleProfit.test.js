/**
 * Admin console pulse — profitMinor must be visible (not computed-and-hidden).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('admin console profit pulse', () => {
  it('renders period expenses and profit from snapshot fields', () => {
    const src = readFileSync(join(root, 'src/pages/AdminConsolePage.jsx'), 'utf8')
    assert.match(src, /approvedExpenseMinor/)
    assert.match(src, /profitMinor/)
    assert.match(src, /Period expenses/)
    assert.match(src, /Period profit|Period loss/)
  })

  it('fetchAdminConsoleSnapshot still computes profitMinor', () => {
    const api = readFileSync(join(root, 'src/lib/adminApi.js'), 'utf8')
    assert.match(api, /const profitMinor = revenueMinor - approvedExpenseMinor/)
    assert.match(api, /profitMinor,/)
  })
})
