/**
 * Live E2E: VAPID + subscribe (all roles) + resolve fan-out + notify inbox/push path.
 * Fake browser endpoints (no real FCM delivery) — proves API/DB/role wiring.
 *
 * Usage: node scripts/e2e-push-notifications.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { handlePushSubscribeRequest } from '../server/pushApi.mjs'
import { notifyBookingStatus, buildOpsPushTargets } from '../server/notifyBooking.mjs'
import { resolvePushTargets, sendWebPushToUsers } from '../server/webPush.mjs'
import webpush from 'web-push'

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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) {
  console.error('Missing SUPABASE_URL / anon / service role')
  process.exit(1)
}

const ACCOUNTS = [
  { key: 'customer', email: 'demo.customer@hakumautocare.com', password: 'HakumCustomer2026!', expectRole: 'customer' },
  { key: 'admin', email: 'admin@hakumautocare.com', password: 'HakumAdmin2026!', expectRole: 'admin' },
  { key: 'boss', email: 'bossmich@hakumautocare.com', password: 'HakumBoss2026!', expectRole: 'BossMich' },
  { key: 'tl', email: 'teamlead@hakumautocare.com', password: 'HakumTL2026!', expectRole: 'team_lead' },
  { key: 'staff', email: 'staff1@hakumautocare.com', password: 'HakumStaff2026!', expectRole: 'staff' },
]

const stamp = Date.now()
const endpoints = []

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

function mockReq(method, body, headers = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'e2e-push', ...headers },
    body,
  }
}

function mockRes() {
  const out = { statusCode: 200, body: null }
  return {
    out,
    get statusCode() {
      return out.statusCode
    },
    set statusCode(v) {
      out.statusCode = v
    },
    setHeader() {},
    end(payload) {
      out.body = payload
    },
  }
}

async function subscribe(accessToken, userId) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-push-${stamp}-${userId.slice(0, 8)}`
  endpoints.push(endpoint)
  const body = {
    endpoint,
    keys: {
      p256dh: b64url(randomBytes(65)),
      auth: b64url(randomBytes(16)),
    },
    user_agent: 'e2e-push-script',
  }
  const req = mockReq('POST', body, { authorization: `Bearer ${accessToken}` })
  const res = mockRes()
  await handlePushSubscribeRequest(req, res)
  const json = JSON.parse(res.out.body || '{}')
  if (res.out.statusCode !== 200) throw new Error(`subscribe failed: ${JSON.stringify(json)}`)
  return endpoint
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

try {
  // 1) VAPID
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  assert(pub && priv, 'VAPID public/private missing')
  assert(process.env.VITE_VAPID_PUBLIC_KEY, 'VITE_VAPID_PUBLIC_KEY missing for client')
  assert(pub === process.env.VITE_VAPID_PUBLIC_KEY || !process.env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY === process.env.VITE_VAPID_PUBLIC_KEY, 'VAPID public mismatch client/server')
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ops@hakumautocare.com', pub, priv)
  results.push('vapid: ok')

  const users = {}

  // 2) Subscribe each role
  for (const acct of ACCOUNTS) {
    const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password })
    assert(!error && data.session, `login ${acct.key}: ${error?.message || 'no session'}`)
    const userId = data.user.id
    const token = data.session.access_token
    await subscribe(token, userId)

    const { data: row, error: rowErr } = await admin
      .from('push_subscriptions')
      .select('user_id, role, branch_slug, endpoint')
      .eq('user_id', userId)
      .like('endpoint', `%e2e-push-${stamp}%`)
      .maybeSingle()
    assert(!rowErr && row, `subscription row missing for ${acct.key}`)
    assert(row.role === acct.expectRole, `${acct.key} role expected ${acct.expectRole} got ${row.role}`)
    if (acct.expectRole !== 'customer' && acct.expectRole !== 'BossMich') {
      assert(row.branch_slug, `${acct.key} should have branch_slug`)
    }
    users[acct.key] = { id: userId, token, branch: row.branch_slug, role: row.role }
    results.push(`subscribe.${acct.key}: role=${row.role} branch=${row.branch_slug || '—'}`)
  }

  // 3) Fan-out resolve
  const branch = users.admin.branch || users.tl.branch || 'bacoor'
  const targets = buildOpsPushTargets({ branch })
  const resolved = await resolvePushTargets(targets)
  assert(resolved.includes(users.admin.id), 'admin in branch fan-out')
  assert(resolved.includes(users.tl.id), 'team_lead in branch fan-out')
  assert(resolved.includes(users.staff.id), 'staff in branch fan-out')
  assert(resolved.includes(users.boss.id), 'BossMich in global fan-out')
  assert(!resolved.includes(users.customer.id), 'customer must not be in ops fan-out')
  results.push(`resolve.ops: ${resolved.length} users`)

  // 4) sendWebPush (fake endpoints — expect 0 sent, may prune 410/404 or network fail)
  const send = await sendWebPushToUsers({
    userIds: [users.customer.id, users.admin.id],
    title: 'E2E probe',
    body: 'Synthetic push',
    url: '/account',
    tag: `e2e-${stamp}`,
    kind: 'e2e',
  })
  assert(typeof send.sent === 'number', 'send result')
  results.push(`sendWebPush: sent=${send.sent} pruned=${send.pruned} subs=${send.subscriptions}`)

  // 5) Full notify path (inbox + push attempt)
  const bookingId = crypto.randomUUID?.() || `${stamp}-booking`
  // use real uuid format
  const { randomUUID } = await import('node:crypto')
  const bid = randomUUID()
  const notify = await notifyBookingStatus(
    {
      id: bid,
      customer_id: users.customer.id,
      customer_phone: null, // skip SMS in this probe
      customer_name: 'Demo Customer',
      branch,
      vehicle_plate: 'E2EPUSH',
      status: 'waiting',
    },
    'waiting',
  )
  assert(notify.inbox?.inserted === 1 || notify.inbox?.id || !notify.inbox?.error, `customer inbox: ${JSON.stringify(notify.inbox)}`)
  assert(notify.ops?.targets >= 1, `ops targets expected, got ${JSON.stringify(notify.ops)}`)
  assert(notify.ops?.inbox?.inserted >= 1, `ops inbox: ${JSON.stringify(notify.ops)}`)
  assert(notify.push && !notify.push.error, `customer push: ${JSON.stringify(notify.push)}`)
  assert(notify.ops?.push && !notify.ops.push.error, `ops push: ${JSON.stringify(notify.ops.push)}`)

  const { count: custNotifs } = await admin
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', users.customer.id)
    .eq('tag', `booking-${bid}-waiting`)
  assert(custNotifs >= 1, 'customer notification row')

  const { count: adminNotifs } = await admin
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', users.admin.id)
    .eq('tag', `ops-booking-${bid}-waiting`)
  assert(adminNotifs >= 1, 'admin ops notification row')

  results.push(`notify.waiting: customer+ops inbox ok (branch=${branch})`)

  console.log(JSON.stringify({ ok: true, results }, null, 2))
} catch (err) {
  console.error('E2E FAILED:', err.message)
  console.error(JSON.stringify({ ok: false, results }, null, 2))
  process.exitCode = 1
} finally {
  if (endpoints.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', endpoints)
  }
  await admin.from('user_notifications').delete().like('body', '%E2EPUSH%')
  await admin.from('user_notifications').delete().eq('tag', `e2e-${stamp}`)
}
