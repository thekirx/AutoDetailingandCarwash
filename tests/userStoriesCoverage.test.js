/**
 * User-story coverage seams — remaining ACs that were open until wiring/migration scans locked them.
 * Public seams only (page source + migration SQL). Literals from product stories.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('US-PAY-03 · Crew estimate banner + settings path', () => {
  it('Crew shows estimate-only copy and never inserts wash-pool expenses', () => {
    const crew = read('src/pages/OperationsPages.jsx')
    assert.match(crew, /Estimate only — not posted pay/)
    assert.match(crew, /\/operations\/payroll/)
    assert.doesNotMatch(crew, /\.from\('expenses'\)\.insert\(pending\)/)
  })

  it('Payroll rules live under settings/payroll, not the Settings hub poster', () => {
    const hub = read('src/pages/SettingsHubPage.jsx')
    assert.match(hub, /settings\/payroll/)
    assert.doesNotMatch(hub, /toCompensationSettingsRow/)
    assert.match(read('src/pages/settings/PayrollSettingsPage.jsx'), /toCompensationSettingsRow|compensation_settings/)
  })
})

describe('US-CLOSE-01 · One close per branch-day', () => {
  it('migration enforces unique open close per branch + business_date', () => {
    const sql = read('supabase/migrations/20260821010000_shift_close_reports.sql')
    assert.match(sql, /shift_close_reports_branch_date_open_uidx/)
    assert.match(sql, /unique index[\s\S]*\(branch, business_date\)/)
    assert.match(sql, /status in \('draft', 'submitted', 'accepted', 'locked'\)/)
  })
})

describe('US-DOPS-02 · POS handoff keeps visit group + queue number', () => {
  it('POS loads queue_number and visit_group_id on handoff bookings', () => {
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /queue_number/)
    assert.match(pos, /visit_group_id/)
    assert.match(pos, /eq\('visit_group_id'/)
  })
})

describe('US-FIN-01 · Finance loads books tables', () => {
  it('Finance page reads daily_sales_summary, finance_daily_pl, and expenses', () => {
    const page = read('src/pages/FinancePage.jsx')
    assert.match(page, /from\('daily_sales_summary'\)/)
    assert.match(page, /from\('finance_daily_pl'\)/)
    assert.match(page, /from\('expenses'\)/)
    assert.match(page, /loadError/)
    assert.match(page, /Finance data failed to load/)
  })
})
