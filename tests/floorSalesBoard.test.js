import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateDailySalesSummary, resolveBranchFilter } from '../src/queue/queueLogic.js'
import { ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Floor board sales totals', () => {
  it('aggregates daily_sales_summary rows for branch totals', () => {
    const summary = aggregateDailySalesSummary([
      { total_sales_minor: 150000, cash_sales_minor: 100000, online_sales_minor: 50000, paid_count: 3 },
      { total_sales_minor: 50000, cash_sales_minor: 0, online_sales_minor: 50000, paid_count: 1 },
    ])
    assert.equal(summary.total_sales_minor, 200000)
    assert.equal(summary.cash_sales_minor, 100000)
    assert.equal(summary.online_sales_minor, 100000)
    assert.equal(summary.paid_count, 4)
    assert.equal(summary.average_ticket_minor, 50000)
  })

  it('empty rows yield zero totals', () => {
    assert.deepEqual(aggregateDailySalesSummary([]), {
      total_sales_minor: 0,
      cash_sales_minor: 0,
      online_sales_minor: 0,
      paid_count: 0,
      average_ticket_minor: 0,
    })
  })

  it('Team Lead sales queries stay on assigned branch', () => {
    const p = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }
    assert.equal(resolveBranchFilter(p, 'all'), 'bacoor')
    assert.equal(resolveBranchFilter(p, 'imus'), 'bacoor')
  })

  it('dashboard loads branch sales board and shows sales total', () => {
    const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(api, /export async function fetchBranchSalesBoard/)
    assert.match(api, /daily_sales_summary/)
    assert.match(api, /from\('sales'\)/)
    assert.match(page, /fetchBranchSalesBoard/)
    assert.match(page, /Sales total/)
    assert.match(page, /Paid sales ·/)
  })
})
