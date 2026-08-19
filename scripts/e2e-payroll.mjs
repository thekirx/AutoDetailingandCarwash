/**
 * Payroll frontend+backend contract against live Supabase.
 * node scripts/e2e-payroll.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  allowRoute,
  canAccessPayroll,
  canRunPayroll,
  canViewOwnPay,
  getOperationsNav,
  ROLES,
} from '../src/auth/permissions.js'
import { buildPayrollPreview, buildRunPayrollPayload } from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv(join(root, '.env'))
loadEnv(join(root, '.env.production'))

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anonKey && service, 'missing supabase env')

const results = []
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const page = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
const mine = readFileSync(join(root, 'src/pages/MyPayPage.jsx'), 'utf8')

assert(app.includes('path="payroll"') && app.includes('path="my-pay"'), 'payroll routes missing')
assert(page.includes("rpc('run_payroll'") && page.includes('buildRunPayrollPayload'), 'wizard RPC wiring missing')
assert(mine.includes("from('payroll_run_lines')"), 'My pay query missing')
results.push('static.frontend: ok')

const sa = { role: ROLES.SUPER_ADMIN }
assert(canAccessPayroll(sa) && canRunPayroll(sa) && !canViewOwnPay(sa))
assert(allowRoute(sa, 'payroll'))
assert(!allowRoute(sa, 'my-pay'))
assert(getOperationsNav(sa).some((i) => i.to === '/operations/payroll'))
assert(!getOperationsNav(sa).some((i) => i.to === '/operations/my-pay'))
assert(canViewOwnPay({ role: ROLES.STAFF, branch_slug: 'bacoor' }))
results.push('static.rbac: ok')

const preview = buildPayrollPreview({
  period: { start: '2026-08-19', end: '2026-08-19' },
  rules: { wash_pool_pct: 35 },
  sales: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      branch: 'bacoor',
      status: 'paid',
      total_minor: 100000,
      occurred_at: '2026-08-19T10:00:00+08:00',
    },
  ],
  attendance: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      full_name: 'Ty',
      branch_slug: 'bacoor',
      attendance_date: '2026-08-19',
      status: 'present',
    },
  ],
})
const payload = buildRunPayrollPayload({ preview, branch: 'bacoor', frequency: 'daily' })
assert(payload.sales[0].sale_id === '11111111-1111-1111-1111-111111111111')
assert(payload.lines[0].amount_minor === 35000)
results.push('static.payload: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

const { error: runErr } = await admin.from('payroll_runs').select('id, status, period_start').limit(1)
assert(!runErr, `payroll_runs: ${runErr?.message}`)
const { error: lineErr } = await admin.from('payroll_run_lines').select('id, staff_id, amount_minor').limit(1)
assert(!lineErr, `payroll_run_lines: ${lineErr?.message}`)
const { error: saleErr } = await admin.from('payroll_run_sales').select('run_id, sale_id').limit(1)
assert(!saleErr, `payroll_run_sales: ${saleErr?.message}`)
results.push('db.payroll_tables: ok')

const { data: settings, error: setErr } = await admin
  .from('compensation_settings')
  .select('id, payout_frequency, payout_weekday, wash_pool_pct')
  .eq('id', 1)
  .maybeSingle()
assert(!setErr, `compensation_settings: ${setErr?.message}`)
assert(settings && settings.payout_frequency, 'payout_frequency missing on compensation_settings')
results.push(`db.payout_frequency: ${settings.payout_frequency}`)

const { error: rpcMissing } = await admin.rpc('run_payroll', { payload: {} })
assert(
  rpcMissing && !/Could not find the function|PGRST202/i.test(rpcMissing.message || ''),
  `run_payroll missing: ${rpcMissing?.message || 'unexpected success'}`,
)
results.push(`rpc.run_payroll: reachable (${rpcMissing.message.slice(0, 80)})`)

const { data: anonRuns, error: anonSelErr } = await anon.from('payroll_runs').select('id').limit(1)
assert(!anonSelErr || /permission|RLS|denied|JWT/i.test(anonSelErr.message || ''), `anon payroll_runs unexpected: ${anonSelErr?.message}`)
assert(!(anonRuns && anonRuns.length), 'anon must not read payroll_runs')
results.push('rls.anon_payroll_runs: denied')

const { error: anonRpcErr } = await anon.rpc('run_payroll', { payload: {} })
assert(anonRpcErr, 'anon must not execute run_payroll')
results.push(`rls.anon_run_payroll: ${anonRpcErr.message.slice(0, 80)}`)

console.log(results.join('\n'))
console.log('e2e-payroll: PASS')
