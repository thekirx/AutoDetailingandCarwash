/**
 * Customer notify + CRM message path (inbox/push). SMS provider may fail; inbox must land.
 * Usage: node scripts/e2e-customer-notify-crm.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { handleSendPushRequest } from '../server/pushApi.mjs'
import { notifyBookingStatus } from '../server/notifyBooking.mjs'

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function mockReq(method, body, headers = {}) {
  return { method, headers: { 'content-type': 'application/json', ...headers }, body }
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

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

try {
  const customerClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: custAuth, error: custErr } = await customerClient.auth.signInWithPassword({
    email: 'demo.customer@hakumautocare.com',
    password: 'HakumCustomer2026!',
  })
  assert(!custErr && custAuth.user, `customer login: ${custErr?.message}`)
  const customerId = custAuth.user.id

  const mktClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: mktAuth, error: mktErr } = await mktClient.auth.signInWithPassword({
    email: 'marketing@hakumautocare.com',
    password: 'HakumMkt2026!',
  })
  assert(!mktErr && mktAuth.session, `marketing login: ${mktErr?.message}`)
  results.push('login.marketing+customer: ok')

  const tag = `crm-e2e-${randomUUID()}`
  const req = mockReq(
    'POST',
    {
      targets: [{ userId: customerId }],
      title: 'CRM E2E',
      body: 'Message from marketing desk',
      url: '/account',
      tag,
      kind: 'crm_message',
    },
    { authorization: `Bearer ${mktAuth.session.access_token}` },
  )
  const res = mockRes()
  await handleSendPushRequest(req, res)
  const json = JSON.parse(res.out.body || '{}')
  assert(res.out.statusCode === 200, `CRM send-push ${res.out.statusCode} ${JSON.stringify(json)}`)
  results.push(`crm.send-push: ok sent=${json.sent}`)

  const { data: notif } = await admin
    .from('user_notifications')
    .select('id, title, user_id')
    .eq('tag', tag)
    .maybeSingle()
  assert(notif?.user_id === customerId, 'CRM inbox row missing')
  results.push('crm.inbox: ok')

  for (const status of ['waiting', 'in_progress', 'final_checking', 'for_payment', 'completed']) {
    const bid = randomUUID()
    const out = await notifyBookingStatus(
      {
        id: bid,
        customer_id: customerId,
        customer_phone: null,
        customer_name: 'Demo Customer',
        branch: 'bacoor',
        vehicle_plate: 'E2ENOTIFY',
        status,
      },
      status,
    )
    assert(out.inbox?.inserted === 1 || !out.inbox?.error, `${status} inbox ${JSON.stringify(out.inbox)}`)
    assert(out.push && !out.push.error, `${status} push ${JSON.stringify(out.push)}`)
    results.push(`notify.${status}: inbox+push ok`)
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2))
} catch (err) {
  console.error('E2E FAILED:', err.message)
  console.error(JSON.stringify({ ok: false, results }, null, 2))
  process.exitCode = 1
} finally {
  await admin.from('user_notifications').delete().like('tag', 'crm-e2e-%')
  await admin.from('user_notifications').delete().like('body', '%E2ENOTIFY%')
  await admin.from('user_notifications').delete().eq('title', 'CRM E2E')
}
