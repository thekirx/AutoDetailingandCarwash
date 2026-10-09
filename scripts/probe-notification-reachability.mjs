/**
 * READ-ONLY: can the person who received a notification actually open it?
 *
 * All 8 stored `user_notifications.url` values map to real routes, so the link
 * itself is sound. The failure mode is authorization: a notification pointing at
 * a route the recipient's role cannot open lands on the access-denied wall, and
 * a notification is by definition sent to someone who has not opened it yet.
 *
 *   node scripts/probe-notification-reachability.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowRoute } from '../src/auth/permissions.js'
import { resolvePostLoginPath } from '../src/auth/authRedirect.js'

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

/**
 * Route key that allowRoute() gates, for a stored url.
 *
 * `/operations` with no sub-path is NOT a route key — it is the layout whose
 * index element redirects to the role's landing (OpsIndexRedirect ->
 * resolvePostLoginPath). Mapping it to a literal 'index' key made allowRoute
 * answer false for every single role, which reported 11 blocked pairs that do
 * not exist. Follow the redirect instead, then gate the real destination.
 */
function routeKeyFor(url, profile) {
  const m = /^\/operations(?:\/([^/?#]+))?/.exec(url || '')
  if (!m) return null // customer portal or public route — no ops gate
  if (m[1]) return m[1]
  const landing = resolvePostLoginPath(profile, null) || ''
  const lm = /^\/operations\/([^/?#]+)/.exec(landing)
  return lm ? lm[1] : null
}

const notifications = readOrFail(
  'user_notifications',
  await db.from('user_notifications').select('id, user_id, url, title').limit(500),
) || []

const staff = readOrFail(
  'staff_profiles',
  await db.from('staff_profiles').select('id, full_name, role, is_active, branch_slug').limit(500),
) || []

const roleById = new Map(staff.map((s) => [s.id, s]))
console.log(`notifications: ${notifications.length}   staff: ${staff.length}\n`)

// Every distinct (role, route) pair actually delivered, with a count.
const pairs = new Map()
let unknownRecipient = 0
for (const n of notifications) {
  const s = roleById.get(n.user_id)
  if (!s) { unknownRecipient++; continue }
  const key = routeKeyFor(n.url, s)
  if (!key) continue
  const id = `${s.role} -> ${n.url}`
  const cur = pairs.get(id) || { count: 0, allowed: allowRoute(s, key), sample: null, landsOn: key }
  cur.count++
  if (!cur.sample) cur.sample = s
  pairs.set(id, cur)
}

const blocked = []
for (const [id, v] of [...pairs.entries()].sort((a, b) => b[1].count - a[1].count)) {
  const mark = v.allowed ? 'ok  ' : 'BLOCK'
  if (!v.allowed) blocked.push({ id, ...v })
  console.log(`${mark} ${String(v.count).padStart(4)}x  ${id.padEnd(46)} lands on ${String(v.landsOn).padEnd(14)} e.g. ${v.sample?.full_name || '?'} (${v.sample?.role})`)
}

console.log(`\nnotifications whose recipient is not in staff_profiles: ${unknownRecipient}`)
console.log(`delivered-but-blocked pairs: ${blocked.length}`)
if (blocked.length) {
  console.log('\nA click on these lands on the access-denied wall, not the thing the notification is about:')
  for (const b of blocked) console.log(`  ${b.id}  (${b.count}x)`)
}