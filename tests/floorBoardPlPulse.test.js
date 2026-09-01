/**
 * Floor board money strip — expenses + net must surface (not revenue-only).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('floor board P&L pulse', () => {
  it('fetchSuperAdminFloorBoard loads period expenses into financials', () => {
    const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
    assert.match(api, /from\('expenses'\)/)
    assert.match(api, /expense_minor/)
    assert.match(api, /net_minor/)
  })

  it('SuperAdminFloorBoard renders expense and net tiles', () => {
    const src = readFileSync(join(root, 'src/pages/SuperAdminFloorBoard.jsx'), 'utf8')
    assert.match(src, /financials\.expense_minor/)
    assert.match(src, /financials\.net_minor/)
    assert.match(src, /Posted expenses|Expenses/)
    assert.match(src, /Net profit|Net loss/)
  })
})
