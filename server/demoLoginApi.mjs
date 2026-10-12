/**
 * One-click demo sign-in, without shipping credentials.
 *
 * The chips have to work on the deployed site (owner decision 2026-10-12) and
 * they must not put a staff password in the client bundle. Those two facts rule
 * out the obvious implementation: the browser cannot hold the password, and it
 * cannot ask for it either, because the whole point is one click.
 *
 * So the browser sends an account ID and nothing else. The password is read from
 * the server's own environment, the server performs the sign-in, and only the
 * resulting session comes back. `VITE_`-prefixed names are safe HERE precisely
 * because this file runs on the server and is never part of the client bundle —
 * which is why the client-side `demoPassword()` had to stop reading
 * `import.meta.env` (a computed key there makes Vite inline the whole env).
 *
 * This endpoint is an open "become anyone" door while it is switched on. That is
 * the risk the owner accepted; what this handler removes is the *other* half of
 * BUG-088, the permanent public list of credentials that came with it.
 */
import { createClient } from '@supabase/supabase-js'
import { json, readJsonBody, setCors } from './httpUtil.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

/** Same rule as the client, evaluated server-side: dev, or an explicit opt-in. */
function demoLoginEnabled() {
  if (globalThis.process?.env?.DEMO_LOGIN_ENABLED === 'true') return true
  // Local `npm run dev` / `vite preview`, where nothing is exposed to anyone.
  return process.env.NODE_ENV !== 'production' && process.env.DEMO_LOGIN_ENABLED !== 'false'
}

function accountsById() {
  const map = new Map()
  for (const a of OPS_DEMO_ACCOUNTS) map.set(a.id, { email: a.email, passwordEnv: a.passwordEnv })
  map.set(CUSTOMER_DEMO_ACCOUNT.id, { email: CUSTOMER_DEMO_ACCOUNT.email, passwordEnv: CUSTOMER_DEMO_ACCOUNT.passwordEnv })
  return map
}

export async function handleDemoLoginRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  // 404 rather than 403: if this is off, the route should not advertise itself.
  if (!demoLoginEnabled()) return json(res, 404, { error: 'Not found' })

  const body = await readJsonBody(req)
  const account = accountsById().get(String(body?.id || ''))
  if (!account) return json(res, 400, { error: 'Unknown demo account' })

  const password = process.env[account.passwordEnv] || ''
  if (!password) {
    // Name the variable, never the value. This is the whole point of the module.
    return json(res, 503, { error: `Demo sign-in is not configured: set ${account.passwordEnv}` })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return json(res, 503, { error: 'Supabase is not configured' })

  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password })
  if (error || !data?.session) return json(res, 401, { error: error?.message || 'Demo sign-in failed' })

  return json(res, 200, {
    email: data.user?.email || account.email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  })
}