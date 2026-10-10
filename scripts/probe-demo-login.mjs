/**
 * READ-ONLY diagnostic: why does the ui-p0 e2e see "Invalid email or password"
 * for `admin` and sometimes `tl`, while `crew1` passes?
 *
 * scripts/e2e-ui-p0.mjs signs the personas in SEQUENCE, in one browser, clearing
 * localStorage/cookies between each. This separates two hypotheses that look
 * identical from the screenshot:
 *
 *   (a) the demo credentials are wrong / the account is disabled  -> every
 *       fresh sign-in for that persona fails, and nothing about the sequence
 *       matters;
 *   (b) the sequence itself breaks it  -> a fresh client signs in fine and
 *       only the second or third attempt in one client fails, which points at
 *       session handling or the auth rate limiter rather than the credential.
 *
 * Three earlier reproduction attempts for this failed, so this runs both orders
 * and reports the raw error from Supabase rather than the app's mapped message.
 *
 * It performs authentication only -- no data is read or written. It creates
 * ordinary expiring sessions and signs them out again.
 *
 *   node scripts/probe-demo-login.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

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
if (!URL_ || !ANON) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY not set')
  process.exit(1)
}

const pick = (id) => OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
const IDS = ['boss', 'asa', 'admin', 'tl', 'crew1']

function fresh() {
  return createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** @returns {Promise<{ ok: boolean, status?: number, code?: string, message: string }>} */
async function trySignIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    return {
      ok: false,
      status: error.status ?? null,
      code: error.code ?? null,
      message: error.message,
    }
  }
  const user = data?.user
  await client.auth.signOut()
  return {
    ok: true,
    status: 200,
    message: `signed in (${user?.email}), confirmed=${Boolean(user?.email_confirmed_at)}`,
  }
}

function line(label, r) {
  const mark = r.ok ? 'OK  ' : 'FAIL'
  const extra = r.ok ? '' : ` [status=${r.status} code=${r.code}]`
  console.log(`  ${mark} ${label}${extra} :: ${r.message}`)
}

console.log('--- A: each persona alone, fresh client, no prior session ---')
const alone = new Map()
for (const id of IDS) {
  const a = pick(id)
  if (!a) {
    console.log(`  ---- ${id}: not in OPS_DEMO_ACCOUNTS`)
    continue
  }
  const r = await trySignIn(fresh(), a.email, a.password)
  alone.set(id, r.ok)
  line(a.email, r)
  await new Promise((r2) => setTimeout(r2, 400))
}

console.log('\n--- B: the order e2e-ui-p0.mjs uses, one client, signOut between ---')
const shared = fresh()
for (const id of ['admin', 'tl', 'crew1']) {
  const a = pick(id)
  if (!a) continue
  const r = await trySignIn(shared, a.email, a.password)
  line(`shared: ${a.email}`, r)
  console.log(`       (fresh-client result for this persona was ${alone.get(id) ? 'OK' : 'FAIL'})`)
  await new Promise((r2) => setTimeout(r2, 400))
}

console.log('\n--- C: the same persona twice in a row, fresh client each time ---')
const admin = pick('admin')
for (let i = 1; i <= 3; i++) {
  const r = await trySignIn(fresh(), admin.email, admin.password)
  line(`attempt ${i} (fresh client)`, r)
  await new Promise((r2) => setTimeout(r2, 400))
}

const allOk = [...alone.values()].every(Boolean)
console.log('\nSUMMARY')
console.log(`  fresh-client results: ${JSON.stringify(Object.fromEntries(alone))}`)
if (!allOk) {
  console.log('  => at least one credential is wrong or the account is disabled. This is (a).')
  console.log('     The e2e ordering is not the cause; re-seed that persona.')
} else {
  console.log('  => every credential works alone. Any failure is (b): sequencing,')
  console.log('     session handling, or the auth rate limiter.')
}