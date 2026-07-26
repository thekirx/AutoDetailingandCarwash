/**
 * Part 5: finance category kinds + sales summary + quote helper smoke.
 * node scripts/e2e-part5-finance.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { canAccessFinance, canWriteFinance, ROLES } from '../src/auth/permissions.js'
import { sendFinanceQuote } from '../server/sendFinanceQuote.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing supabase env')
const results = []

assert(canWriteFinance({ role: ROLES.SUPER_ADMIN }) === true)
assert(canWriteFinance({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }) === false)
assert(canAccessFinance({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }) === true)
results.push('rbac.finance_write: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: cats, error: catErr } = await admin
  .from('expense_categories')
  .select('id, name, kind')
  .in('kind', ['payroll', 'marketing', 'general'])
assert(!catErr, `expense_categories: ${catErr?.message}`)
assert(cats?.some((c) => c.kind === 'payroll'), 'missing payroll kind')
assert(cats?.some((c) => c.kind === 'marketing'), 'missing marketing kind')
results.push('db.expense_categories.kind: ok')

const { data: sales, error: salesErr } = await admin
  .from('daily_sales_summary')
  .select('branch, sale_date, total_sales_minor')
  .limit(3)
assert(!salesErr, `daily_sales_summary: ${salesErr?.message}`)
results.push(`db.daily_sales_summary: ok (${sales?.length || 0} rows sample)`)

const { error: expErr } = await admin.from('expenses').select('id, total_minor, branch, status').limit(1)
assert(!expErr, `expenses: ${expErr?.message}`)
results.push('db.expenses: ok')

// Preview path: prefer E2E_BOSS_* env, else floor demo BossMich
const email = process.env.E2E_BOSS_EMAIL || 'bossmich@hakumautocare.com'
const password = process.env.E2E_BOSS_PASSWORD || 'HakumBoss2026!'
{
  const userClient = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: auth, error: authErr } = await userClient.auth.signInWithPassword({ email, password })
  assert(!authErr, `signIn: ${authErr?.message}`)
  const prevKey = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  const preview = await sendFinanceQuote({
    accessToken: auth.session.access_token,
    body: { to: 'quote-test@example.com', subject: 'Part5 smoke', title: 'Test', amount_label: '₱100.00', branch: 'bacoor' },
  })
  if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey
  assert(preview.ok && preview.preview, 'expected preview response without RESEND_API_KEY')
  results.push('api.quote_preview: ok')
  await userClient.auth.signOut()
}

console.log(results.join('\n'))
console.log('e2e-part5-finance: PASS')
