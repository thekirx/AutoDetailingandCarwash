/**
 * Web Push send + prune (WEB_PUSH_AGENT_PLAYBOOK).
 * VAPID_* env only — never expose private key to the client.
 */
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

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
