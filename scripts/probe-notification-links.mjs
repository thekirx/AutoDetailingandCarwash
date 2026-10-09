/**
 * READ-ONLY: do stored notification URLs actually deep-link where staff expect?
 *
 * `notificationHref` (src/lib/notificationUrl.js) returns the `/account`
 * customer portal as its fallback for ANY url it cannot resolve as a
 * same-origin absolute URL. A staff member clicking a notification that lands
 * on the customer portal is a silent mis-delivery, not an error, so nothing
 * else in the app would ever surface it.
 *
 *   node scripts/probe-notification-links.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notificationHref } from '../src/lib/notificationUrl.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

// The production origin the app is actually served from.
const PROD_ORIGIN = URL_.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
console.log('supabase project url:', PROD_ORIGIN)
console.log('(note: this is the API host, NOT necessarily the web origin — that is the point)\n')

for (const table of ['user_notifications', 'notifications']) {
  const res = await db.from(table).select('*', { count: 'exact', head: true })
  if (res.error) {
    console.log(`${table}: not in the schema cache (${res.error.message})`)
    continue
  }
  console.log(`${table}: ${res.count} rows`)
  // Select only `url`; guessing other columns is how a read silently breaks.
  const rows = readOrFail(`${table} read`, await db.from(table).select('url').limit(500)) || []

  const byUrl = new Map()
  for (const r of rows) {
    const u = r.url || ''
    byUrl.set(u, (byUrl.get(u) || 0) + 1)
  }
  console.log('  distinct url values:', byUrl.size)
  for (const [u, n] of [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    const shown = u === '' ? '(empty)' : u
    // Resolve with NO window, which is the SSR-ish path: origin is ''.
    const href = notificationHref(u, '/account')
    console.log(`   ${String(n).padStart(4)}x  ${shown.slice(0, 78)}`)
    console.log(`         -> ${href}`)
  }
  console.log()
}