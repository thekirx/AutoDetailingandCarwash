/**
 * Web Push send + prune (WEB_PUSH_AGENT_PLAYBOOK).
 * VAPID_* env only — never expose private key to the client.
 */
import webpush from 'web-push'
import { inNotifyScope, planStaffRecipients } from '../src/lib/notifyRouting.js'
import { safeNotificationPath } from './notificationTargetUrl.mjs'
import { loadNotificationConfig } from './notificationConfigApi.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

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
  if (!ids.length) return { sent: 0, failed: 0, pruned: 0, subscriptions: 0 }

  const db = admin()
  const { data: subs, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').in('user_id', ids)
  if (error) throw error

  const safeUrl = safeNotificationPath(url, '/')
  const payload = JSON.stringify({ title, body, url: safeUrl, tag, kind, icon: '/apple-touch-icon.png' })
  let sent = 0
  let failed = 0
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
        failed += 1
        const code = err.statusCode || err.status
        if (code === 404 || code === 410) prune.push(sub.endpoint)
      }
    }),
  )

  if (prune.length) {
    await db.from('push_subscriptions').delete().in('endpoint', prune)
  }

  return { sent, failed, pruned: prune.length, subscriptions: (subs || []).length }
}

/**
 * Deep delivery interface for customer & direct user notifications:
 * normalizes destination path, enforces optional customer preferences,
 * writes user_notifications inbox rows, and dispatches Web Push.
 */
export async function deliverUserNotifications(
  db,
  {
    userIds = [],
    kind = 'system',
    title,
    body,
    url = '/',
    tag = null,
    inbox = true,
    checkCustomerPrefs = false,
    sendPush = sendWebPushToUsers,
  },
) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))]
  if (!uniqueIds.length) {
    return { targets: 0, skipped: 0, inbox: { inserted: 0 }, push: { sent: 0, failed: 0, pruned: 0, subscriptions: 0 } }
  }

  let activeIds = uniqueIds
  let skipped = 0
  if (checkCustomerPrefs) {
    const { data: custRows } = await db
      .from('customers')
      .select('id, notify_push, is_disabled, is_archived')
      .in('id', uniqueIds)
    const blocked = new Set(
      (custRows || [])
        .filter((c) => c.is_disabled === true || c.is_archived === true || c.notify_push === false)
        .map((c) => c.id),
    )
    if (blocked.size) {
      activeIds = uniqueIds.filter((id) => !blocked.has(id))
      skipped = uniqueIds.length - activeIds.length
    }
  }

  if (!activeIds.length) {
    return { targets: 0, skipped, inbox: { inserted: 0 }, push: { sent: 0, failed: 0, pruned: 0, subscriptions: 0 } }
  }

  const safeUrl = safeNotificationPath(url, '/')
  let inboxRes = { inserted: 0 }
  if (inbox) {
    const { error } = await db
      .from('user_notifications')
      .insert(activeIds.map((user_id) => ({ user_id, kind, title, body, url: safeUrl, tag: tag || null })))
    inboxRes = error ? { error: error.message } : { inserted: activeIds.length }
  }

  let pushRes = { sent: 0, failed: 0, pruned: 0, subscriptions: 0 }
  const cfg = await loadNotificationConfig(db)
  if (cfg.push_notifications_enabled === false) {
    pushRes = { sent: 0, failed: 0, pruned: 0, subscriptions: 0, skipped: 'push_disabled_by_admin' }
  } else {
    try {
      pushRes = await sendPush({
        userIds: activeIds,
        title,
        body,
        url: safeUrl,
        tag: tag || undefined,
        kind,
      })
    } catch (err) {
      pushRes = { sent: 0, failed: activeIds.length, pruned: 0, subscriptions: 0, error: String(err.message || err) }
    }
  }

  return { targets: activeIds.length, skipped, inbox: inboxRes, push: pushRes }
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
export async function notifyRecipients(db, recipients, { kind, title, body, tag }, { inbox = true } = {}) {
  const result = { targets: recipients.length, inbox: { inserted: 0 }, push: { sent: 0, failed: 0, pruned: 0, subscriptions: 0 } }
  if (!recipients.length) return result
  if (inbox) {
    const { error } = await db
      .from('user_notifications')
      .insert(recipients.map((r) => ({ user_id: r.id, kind, title, body, url: safeNotificationPath(r.url, '/'), tag })))
    result.inbox = error ? { error: error.message } : { inserted: recipients.length }
  }
  const byUrl = new Map()
  for (const r of recipients) {
    const safeUrl = safeNotificationPath(r.url, '/')
    byUrl.set(safeUrl, [...(byUrl.get(safeUrl) || []), r.id])
  }
  const cfg = await loadNotificationConfig(db)
  if (cfg.push_notifications_enabled === false) {
    result.push = { sent: 0, failed: 0, pruned: 0, subscriptions: 0, skipped: 'push_disabled_by_admin' }
    return result
  }
  try {
    for (const [url, userIds] of byUrl) {
      const sent = await sendWebPushToUsers({ userIds, title, body, url, tag, kind })
      result.push.sent += sent.sent || 0
      result.push.failed += sent.failed || 0
      result.push.pruned += sent.pruned || 0
      result.push.subscriptions += sent.subscriptions || 0
    }
  } catch (err) {
    result.push = { error: String(err.message || err) }
  }
  return result
}

/** Service/admin manual targets ({ userId } or { roles, branchId }) against live staff_profiles/customers. */
export async function resolvePushTargets(targets = []) {
  const db = admin()
  const userIds = new Set()
  for (const t of targets) {
    if (t.userId) userIds.add(t.userId)
    if (t.roles?.length) {
      const staffRoles = t.roles.filter((r) => r !== 'customer')
      if (staffRoles.length) {
        const { data: staffRows } = await db
          .from('staff_profiles')
          .select('id, role, branch_slug, is_active, is_archived')
          .eq('is_active', true)
          .in('role', staffRoles)
        const rows = (staffRows || []).filter((r) => !r.is_archived)
        if (t.branchId && rows.length) {
          const { data: extra } = await db
            .from('staff_branch_assignments')
            .select('staff_id, branch_slug')
            .in('staff_id', rows.map((r) => r.id))
          for (const r of rows) {
            r.branch_slugs = (extra || []).filter((a) => a.staff_id === r.id).map((a) => a.branch_slug)
            if (inNotifyScope(r, t.branchId)) userIds.add(r.id)
          }
        } else {
          for (const r of rows) userIds.add(r.id)
        }
      }
      if (t.roles.includes('customer')) {
        for (let from = 0; from < 10000; from += 1000) {
          let q = db
            .from('customers')
            .select('id')
            .eq('is_disabled', false)
            .eq('is_archived', false)
            .neq('notify_push', false)
          if (typeof q.order === 'function') q = q.order('id', { ascending: true })
          const { data: custRows } =
            typeof q.range === 'function' ? await q.range(from, from + 999) : await q.limit(1000)
          const batch = custRows || []
          for (const c of batch) userIds.add(c.id)
          if (batch.length < 1000 || typeof q.range !== 'function') break
        }
      }
    }
  }
  return [...userIds]
}
