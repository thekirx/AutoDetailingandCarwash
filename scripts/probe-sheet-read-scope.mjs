/**
 * READ-ONLY. check:sheet-ui phase 2 regressed after the security migrations:
 * the POS till renders 0 rows for bacoor / 2026-09-30 while the sheet still
 * exists (dbSheet=true) and phase 1 renders all 60 sheets for the Super Admin.
 *
 * Phase 1 signs in as Super Admin; phase 2 signs in as the Branch Admin. So
 * the split is the obvious suspect: 20261011090000_reconcile_live_admin_policies
 * may have narrowed a read policy the shop floor depends on, leaving the person
 * who files the sheet unable to open it at the till.
 *
 * That would be a Critical usability regression on the daily-operations path --
 * the BA closes the day at exactly that screen.
 *
 * SELECT only.
 *
 *   node scripts/probe-sheet-read-scope.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { demoPassword } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const branch = 'bacoor'
const date = '2026-09-30'

const svc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function signIn(email, password) {
  const c = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email} sign-in failed: ${error.message}`)
  return c
}

const q = (client) =>
  client.from('daily_sheets').select('id, branch, business_date, status').eq('branch', branch).eq('business_date', date)

console.log(`${branch} / ${date}\n`)

console.log('service role (ground truth)')
{
  // Also print the ids actually returned, so a run that silently returns fewer
  // rows than expected is visible rather than merely "OK".
  const { data, error } = await q(svc)
  console.log(`  error=${error?.message || 'none'} rows=${data?.length ?? 0}`)
  for (const s of data || []) console.log(`    id=${s.id} status=${s.status}`)
}

for (const [label, email, passwordEnv] of [
  ['Super Admin', 'bossmich@hakumautocare.com', 'VITE_DEMO_PASSWORD_BOSS'],
  ['Branch Admin', 'admin@hakumautocare.com', 'VITE_DEMO_PASSWORD_ADMIN'],
  ['ASA', 'assistant@hakumautocare.com', 'VITE_DEMO_PASSWORD_ASA'],
]) {
  // Read at call time, after .env is loaded. An empty password would produce a
  // sign-in error that reads like an auth defect, so stop before that happens.
  const password = demoPassword(passwordEnv)
  if (!password) throw new Error(`${passwordEnv} is unset in .env -- cannot probe ${label} read scope`)
  const c = await signIn(email, password)
  const { data, error } = await q(c)
  console.log(`\n${label} (${email})`)
  console.log(`  error=${error?.message || 'none'} rows=${data?.length ?? 0}`)

  // A missing sheet and a hidden one look identical from the UI. Separate them:
  // can this role read ANY sheet at its own branch?
  const anySheet = await c.from('daily_sheets').select('id', { count: 'exact', head: true })
  const anyLine = await c.from('daily_sheets').select('id, daily_sheet_lines(id)').limit(3)
  const lineHead = await c.from('daily_sheet_lines').select('id', { count: 'exact', head: true })
  console.log(`  readable sheets total=${anySheet.count ?? 'null'} (error=${anySheet.error?.message || 'none'})`)
  console.log(`  sheets with embedded lines=${JSON.stringify((anyLine.data || []).map((s) => s.daily_sheet_lines?.length ?? null))} (error=${anyLine.error?.message || 'none'})`)
  console.log(`  readable daily_sheet_lines total=${lineHead.count ?? 'null'} (error=${lineHead.error?.message || 'none'})`)

  const fin = await c.rpc('daily_sheet_server_totals', { p_sheet: (data || [])[0]?.id || '00000000-0000-0000-0000-000000000000' })
  console.log(`  daily_sheet_server_totals -> ${fin.error ? `DENIED: ${fin.error.message}` : 'ok'}`)

  await c.auth.signOut()
}