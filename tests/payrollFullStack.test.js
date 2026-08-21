/**
 * Full payroll stack: RPC payload, wizard/My pay UI, SQL grants, one salary path.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { ROLES, canAccessPayroll, canViewOwnPay } from '../src/auth/permissions.js'
import {
  buildPayrollPreview,
  buildRunPayrollPayload,
  payrollBlocksConfirm,
} from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('run_payroll payload from POS-proofed preview', () => {
  it('sends sale_id proof and amount_minor lines; skips zero pay', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-17', end: '2026-08-23' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-w',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 100000,
          occurred_at: '2026-08-19T10:00:00+08:00',
        },
      ],
      attendance: [
        { id: 'staff-ty', full_name: 'Ty', branch_slug: 'bacoor', attendance_date: '2026-08-19', status: 'present' },
      ],
    })
    const payload = buildRunPayrollPayload({
      preview,
      branch: 'bacoor',
      frequency: 'weekly',
      notes: 'week 34',
    })
    assert.equal(payload.branch, 'bacoor')
    assert.equal(payload.frequency, 'weekly')
    assert.equal(payload.period_start, '2026-08-17')
    assert.equal(payload.period_end, '2026-08-23')
    assert.equal(payload.wash_pool_pct, 35)
    assert.equal(payload.notes, 'week 34')
    assert.equal(payload.run_kind, 'floor')
    assert.equal(payload.sales[0].sale_id, 'sale-w')
    assert.equal(payload.sales[0].wash_pool_minor, 100000)
    assert.equal(payload.lines.length, 1)
    assert.equal(payload.lines[0].staff_id, 'staff-ty')
    assert.equal(payload.lines[0].amount_minor, 35000)
    assert.equal(payload.lines[0].kind, 'wash_pool')
    assert.equal('pay_minor' in payload.lines[0], false)
  })
})

describe('payroll frontend contract', () => {
  it('wizard posts via buildRunPayrollPayload; confirm stays behind canRunPayroll', () => {
    const page = read('src/pages/PayrollPage.jsx')
    assert.match(page, /buildRunPayrollPayload/)
    assert.match(page, /rpc\('run_payroll'/)
    assert.match(page, /disabled=\{!canRun \|\| saving \|\| gate\.blocked/)
    assert.match(page, /hakum-payroll-steps/)
    assert.match(page, /canRunPayroll\(profile\)/)
    const mine = read('src/pages/MyPayPage.jsx')
    assert.match(mine, /from\('payroll_run_lines'\)/)
    assert.match(mine, /\.eq\('staff_id', profile\.id\)/)
    assert.match(mine, /Navigate to=\{canAccessPayroll\(profile\) \? '\/operations\/payroll'/)
    assert.equal(canViewOwnPay({ role: ROLES.SUPER_ADMIN }), false)
    assert.equal(canAccessPayroll({ role: ROLES.SUPER_ADMIN }), true)
    const app = read('src/App.jsx')
    assert.match(app, /gate\('payroll'/)
    assert.match(app, /gate\('my-pay'/)
    assert.equal(opsRouteKeyFromPath('/operations/payroll'), 'payroll')
    assert.equal(opsRouteKeyFromPath('/operations/my-pay'), 'my-pay')
  })

  it('blocks confirm when ceramic assignee is missing', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [],
      attendance: [],
      ceramicExpenses: [
        { description: 'ceramic:sale-x:crew', total_minor: 1000, branch: 'bacoor', expense_kind: 'salary_carwash' },
      ],
    })
    assert.equal(payrollBlocksConfirm(preview).blocked, true)
  })
})

describe('payroll SQL / RPC contract', () => {
  it('RLS is authenticated-only; overlap and double-pay are named errors', () => {
    const sql = read('supabase/migrations/20260819100000_payroll_runs.sql')
    assert.match(sql, /revoke all on public\.payroll_runs from public, anon/)
    assert.match(sql, /grant select on public\.payroll_run_lines to authenticated/)
    assert.match(sql, /revoke all on function public\.run_payroll\(jsonb\) from public, anon/)
    assert.match(sql, /grant execute on function public\.run_payroll\(jsonb\) to authenticated/)
    assert.match(sql, /Overlapping payroll run already exists/)
    assert.match(sql, /sale already paid in another payroll run/)
    assert.match(sql, /finance_write/)
    assert.match(sql, /on public\.payroll_run_sales \(sale_id\)/)
  })
})

describe('one salary path — payroll, not duplicate posters', () => {
  it('Crew estimate does not insert wash-pool expenses; Payroll is the poster', () => {
    const crew = read('src/pages/OperationsPages.jsx')
    assert.doesNotMatch(crew, /\.from\('expenses'\)\.insert\(pending\)/)
    assert.match(crew, /\/operations\/payroll/)
    const payroll = read('src/pages/PayrollPage.jsx')
    assert.match(payroll, /toCompensationSettingsRow/)
    const settings = read('src/pages/SettingsHubPage.jsx')
    assert.doesNotMatch(settings, /toCompensationSettingsRow/)
    assert.match(settings, /to: '\/operations\/payroll'/)
  })

  it('POS keeps ceramic drafts as proof and does not clone Inventory as POS tabs', () => {
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /buildCeramicCompensationExpenses/)
    assert.match(pos, /const SHELL_TABS = \['checkout', 'pending', 'expenses', 'dashboard'\]/)
    assert.doesNotMatch(pos, /SHELL_TABS = \[[^\]]*'services'/)
    const products = read('src/pages/ProductsManagePage.jsx')
    assert.doesNotMatch(products, /\/operations\/pos\?tab=merch/)
    assert.match(products, /\/operations\/pos/)
  })

  it('Cash advances live on Payroll, not POS shell tabs', () => {
    const pos = read('src/pages/PosPage.jsx')
    assert.doesNotMatch(pos, /TabsTrigger value="cash-advance"/)
    assert.match(pos, /Cash advances · Payroll/)
    const payroll = read('src/pages/PayrollPage.jsx')
    assert.match(payroll, /PayrollCashAdvancesPanel/)
    assert.match(payroll, /canApproveCashAdvance/)
  })
})
