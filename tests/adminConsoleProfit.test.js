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
  it('renders sample revenue, expenses, and profit from snapshot fields', () => {
    const src = readFileSync(join(root, 'src/pages/AdminConsolePage.jsx'), 'utf8')
    assert.match(src, /revenueMinor/)
    assert.match(src, /approvedExpenseMinor/)
    assert.match(src, /profitMinor/)
    assert.match(src, /Sample revenue/)
    assert.match(src, /Sample expenses/)
    assert.match(src, /Sample profit|Sample loss/)
  })

  it('fetchAdminConsoleSnapshot computes profit from paid/posted expenses', () => {
    const api = readFileSync(join(root, 'src/lib/adminApi.js'), 'utf8')
    assert.match(api, /\['paid', 'posted'\]/)
    assert.match(api, /const profitMinor = revenueMinor - approvedExpenseMinor/)
    assert.match(api, /profitMinor,/)
  })
})
