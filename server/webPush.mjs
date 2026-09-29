/**
 * Web Push send + prune (WEB_PUSH_AGENT_PLAYBOOK).
 * VAPID_* env only — never expose private key to the client.
 */
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { planStaffRecipients } from '../src/lib/notifyRouting.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@hakumautocare.com'
  if (!publicKey || !privateKey) throw new Error('VAPID keys not configured')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return { publicKey }
}

export async function sendWebPushToUsers({ userIds, title, body, url = '/', tag, kind = 'system' }) {
  ensureVapid()
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return { sent: 0, pruned: 0 }

  const db = admin()
  const { data: subs, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').in('user_id', ids)
  if (error) throw error

  const payload = JSON.stringify({ title, body, url, tag, kind, icon: '/apple-touch-icon.png' })
  let sent = 0
  const prune = []

  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        )
        sent += 1
      } catch (err) {
        const code = err.statusCode || err.status
        if (code === 404 || code === 410) prune.push(sub.endpoint)
      }
    }),
  )

  if (prune.length) {
    await db.from('push_subscriptions').delete().in('endpoint', prune)
  }

  return { sent, pruned: prune.length, subscriptions: (subs || []).length }
}

/** Live staff_profiles → [{ id, url }] per a NOTIFY_EVENTS rule (branch scope, grants, allowed landing url). */
export async function resolveStaffRecipients(db, rule = {}) {
  const ids = rule.ids ? rule.ids.filter(Boolean) : null
  if (ids && !ids.length) return []
  const q = db.from('staff_profiles').select('id, role, branch_slug, permission_grants, is_active, is_archived').eq('is_active', true)
  const { data, error } = await (ids ? q.in('id', ids) : q.in('role', rule.roles || []))
  if (error) throw error
  const rows = data || []
  if (rule.branch && !ids && rows.length) {
    const { data: extra } = await db.from('staff_branch_assignments').select('staff_id, branch_slug').in('staff_id', rows.map((r) => r.id))
    for (const r of rows) r.branch_slugs = (extra || []).filter((a) => a.staff_id === r.id).map((a) => a.branch_slug)
  }
  return planStaffRecipients(rows, rule)
}

/** Inbox row per recipient + one push batch per landing url. */
export async function notifyRecipients(db, recipients, { kind, title, body, tag }) {
  const result = { targets: recipients.length, inbox: { inserted: 0 }, push: { sent: 0, pruned: 0, subscriptions: 0 } }
  if (!recipients.length) return result
  const { error } = await db.from('user_notifications').insert(recipients.map((r) => ({ user_id: r.id, kind, title, body, url: r.url, tag })))
  result.inbox = error ? { error: error.message } : { inserted: recipients.length }
  const byUrl = new Map()
  for (const r of recipients) byUrl.set(r.url, [...(byUrl.get(r.url) || []), r.id])
  try {
    for (const [url, userIds] of byUrl) {
      const sent = await sendWebPushToUsers({ userIds, title, body, url, tag, kind })
      result.push.sent += sent.sent || 0
      result.push.pruned += sent.pruned || 0
      result.push.subscriptions += sent.subscriptions || 0
    }
  } catch (err) {
    result.push = { error: String(err.message || err) }
  }
  return result
}

/** Service/admin manual targets ({ userId } or { roles, branchId }) — /api/send-push only. */
export async function resolvePushTargets(targets = []) {
  const db = admin()
  const userIds = new Set()
  for (const t of targets) {
    if (t.userId) userIds.add(t.userId)
    if (t.roles?.length) {
      let q = db.from('push_subscriptions').select('user_id').in('role', t.roles)
      if (t.branchId) q = q.eq('branch_slug', t.branchId)
      const { data } = await q
      for (const row of data || []) userIds.add(row.user_id)
    }
  }
  return [...userIds]
}
