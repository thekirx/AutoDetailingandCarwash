/**
 * Ops Lab activity → inbox + web push for SA / ASA / BA / Operations Lead.
 */
import { createClient } from '@supabase/supabase-js'
import { sendWebPushToUsers } from './webPush.mjs'
import { buildOpsLabNotifyCopy } from '../src/lib/opsRoadmap.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function resolveOpsLabNotifyUserIds(db, { excludeUserId = null } = {}) {
  const { data, error } = await db.rpc('resolve_ops_lab_notify_user_ids', {
    exclude_user: excludeUserId || null,
  })
  if (!error && Array.isArray(data)) return data.filter(Boolean)

  // Fallback if RPC not yet applied
  const { data: rows, error: listErr } = await db
    .from('staff_profiles')
    .select('id, role')
    .eq('is_active', true)
    .in('role', ['BossMich', 'assistant_super_admin', 'admin', 'operations_lead'])
  if (listErr) throw listErr
  return (rows || [])
    .map((r) => r.id)
    .filter((id) => id && id !== excludeUserId)
}

export async function notifyOpsLabActivity(input = {}) {
  const copy = buildOpsLabNotifyCopy(input)
  const db = admin()
  const userIds = await resolveOpsLabNotifyUserIds(db, { excludeUserId: input.actorId || null })
  let inbox = { inserted: 0 }
  if (userIds.length) {
    const rows = userIds.map((userId) => ({
      user_id: userId,
      kind: copy.kind,
      title: copy.title,
      body: copy.body,
      url: copy.url,
      tag: copy.tag,
    }))
    const { error } = await db.from('user_notifications').insert(rows)
    if (error) inbox = { error: String(error.message || error) }
    else inbox = { inserted: rows.length }
  }
  let push = { sent: 0 }
  if (userIds.length) {
    try {
      push = await sendWebPushToUsers({
        userIds,
        title: copy.title,
        body: copy.body,
        url: copy.url,
        tag: copy.tag,
        kind: copy.kind,
      })
    } catch (err) {
      push = { error: String(err.message || err) }
    }
  }
  return { targets: userIds.length, inbox, push, copy }
}
