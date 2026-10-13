/**
 * One-click demo sign-in for QA on the deployed site, locked behind a QA key.
 *
 * The browser sends an account id plus the QA key. Without the right key this
 * route is a 404, so the public site has no "become Super Admin" door. With it,
 * the server mints a one-time sign-in link for that fixed demo account (service
 * role, no email sent), redeems it, and returns only the session. No password is
 * read or sent, so rotating the demo passwords never breaks the chips.
 *
 * The key is 32 random bytes; only its SHA-256 is in this public repo, which is
 * not reversible. Rotate by setting DEMO_LOGIN_KEY_SHA256 on Vercel or changing
 * QA_KEY_SHA256. DEMO_LOGIN_ENABLED=false turns the route off entirely.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { json, readJsonBody, setCors } from './httpUtil.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const QA_KEY_SHA256 = '24e914e1f6c13f47568d7676f8be96c5ede6f5acb64d788a58c5732f68feaae7'

function demoLoginEnabled() {
  return process.env.DEMO_LOGIN_ENABLED !== 'false'
}

function qaKeyMatches(key) {
  if (typeof key !== 'string' || !key) return false
  const expected = Buffer.from(process.env.DEMO_LOGIN_KEY_SHA256 || QA_KEY_SHA256, 'hex')
  const actual = createHash('sha256').update(key).digest()
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function emailsById() {
  const map = new Map()
  for (const a of [...OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT]) map.set(a.id, a.email)
  return map
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * `localDev` is passed only by the `vite` dev server (vite.config.js), never by the
 * Vercel gateway. Even then the key is skipped only for requests from this machine,
 * because dev talks to the production Supabase and `--host` would expose it to the LAN.
 */
export async function handleDemoLoginRequest(req, res, { localDev = false } = {}) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  // 404 rather than 403: if this is off, the route should not advertise itself.
  if (!demoLoginEnabled()) return json(res, 404, { error: 'Not found' })

  const body = await readJsonBody(req).catch(() => ({}))
  const trustedLocal = localDev && LOOPBACK.has(req.socket?.remoteAddress)
  if (!trustedLocal && !qaKeyMatches(body?.key)) return json(res, 404, { error: 'Not found' })
  if (body?.check) return json(res, 200, { ok: true })

  const email = emailsById().get(String(body?.id || ''))
  if (!email) return json(res, 400, { error: 'Unknown demo account' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return json(res, 503, { error: 'Supabase is not configured' })

  const opts = { auth: { autoRefreshToken: false, persistSession: false } }
  const { data: link, error: linkError } = await createClient(url, service, opts).auth.admin.generateLink({ type: 'magiclink', email })
  if (linkError || !link?.properties?.hashed_token) return json(res, 502, { error: linkError?.message || 'Demo sign-in failed' })
  const { data, error } = await createClient(url, anon, opts).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (error || !data?.session) return json(res, 401, { error: error?.message || 'Demo sign-in failed' })

  return json(res, 200, {
    email: data.user?.email || email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  })
}