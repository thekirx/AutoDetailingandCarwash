import { createClient } from '@supabase/supabase-js'
import { busybeeSendSms } from './busybee.mjs'
import { sendWebPushToUsers } from './webPush.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const ALLOWED = new Set(['BossMich', 'assistant_super_admin', 'marketing'])

async function loadStaff(db, token) {
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  return staff
}

/**
 * POST /api/notification-broadcast
 * { kind, channel, title, body, url, target_audience, branch_slug }
 * Sends push to matching customers' push_subscriptions and/or SMS to their phones.
 */
export async function handleNotificationBroadcastRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' })
  const db = admin()
  const staff = await loadStaff(db, token)
  if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

  const body = await readJsonBody(req)
  const title = String(body.title || '').trim()
  const message = String(body.body || '').trim()
  if (!title || !message) return json(res, 400, { error: 'title and body are required' })

  const channel = ['push', 'sms', 'both'].includes(body.channel) ? body.channel : 'push'
  const targetAudience = ['all', 'detailing', 'wash', 'branch'].includes(body.target_audience)
    ? body.target_audience
    : 'all'
  const branchSlug = body.branch_slug || null

  // Build customer filter
  let custQuery = db
    .from('customers')
    .select('id, phone, full_name')
    .eq('role', 'customer')
    .eq('is_archived', false)

  if (targetAudience === 'branch' && branchSlug) {
    // Customers with a booking at this branch
    const { data: bookingCusts } = await db
      .from('bookings')
      .select('customer_id')
      .eq('branch', branchSlug)
      .not('customer_id', 'is', null)
    const ids = (bookingCusts || []).map((b) => b.customer_id).filter(Boolean)
    if (!ids.length) return json(res, 200, { sent: 0, failed: 0 })
    custQuery = custQuery.in('id', ids)
  } else if (targetAudience === 'detailing' || targetAudience === 'wash') {
    const { data: svcRows } = await db
      .from('services')
      .select('id')
      .eq('pay_category', targetAudience)
    const svcIds = (svcRows || []).map((s) => s.id)
    if (!svcIds.length) return json(res, 200, { sent: 0, failed: 0 })
    const { data: bookingCusts } = await db
      .from('bookings')
      .select('customer_id')
      .in('service_id', svcIds)
      .not('customer_id', 'is', null)
    const ids = [...new Set((bookingCusts || []).map((b) => b.customer_id).filter(Boolean))]
    if (!ids.length) return json(res, 200, { sent: 0, failed: 0 })
    custQuery = custQuery.in('id', ids)
  }

  const { data: customers, error: custErr } = await custQuery.limit(5000)
  if (custErr) return json(res, 400, { error: custErr.message })

  let sent = 0
  let failed = 0

  if (channel === 'push' || channel === 'both') {
    const userIds = (customers || []).map((c) => c.id)
    if (userIds.length) {
      try {
        const result = await sendWebPushToUsers({
          userIds,
          title,
          body: message,
          url: body.url || '/account',
          tag: body.kind || 'promo',
          kind: body.kind || 'promo',
        })
        sent += result?.sent || 0
        failed += result?.failed || 0
      } catch (err) {
        failed += userIds.length
      }
    }
  }

  if (channel === 'sms' || channel === 'both') {
    for (const c of customers || []) {
      if (!c.phone) continue
      try {
        await busybeeSendSms({ phone: c.phone, message: `${title}\n${message}` })
        sent += 1
      } catch {
        failed += 1
      }
    }
  }

  const { error: logErr } = await db.from('notification_broadcasts').insert({
    kind: body.kind || 'promo',
    channel,
    title,
    body: message,
    url: body.url || null,
    target_audience: targetAudience,
    branch_slug: branchSlug,
    sent_count: sent,
    failed_count: failed,
    sent_by: staff.id,
  })
  if (logErr) console.error('[broadcast] log failed', logErr.message)

  return json(res, 200, { sent, failed })
}
