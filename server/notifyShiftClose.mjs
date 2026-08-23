/**
 * Finance accepted end-of-shift → SA / ASA finance_write push (+ optional inbox).
 * Inbox may already exist from review_shift_close RPC; push is the missing half.
 */
import { createClient } from '@supabase/supabase-js'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function buildShiftCloseAcceptCopy({ branch = '', businessDate = '', closeId = '' } = {}) {
  const site = String(branch || 'branch').trim() || 'branch'
  const day = String(businessDate || '').slice(0, 10) || 'today'
  const id = String(closeId || Date.now())
  return {
    kind: 'payroll.pending_floor',
    title: `Floor pay ready · ${site}`,
    body: `End of shift accepted for ${site} · ${day}. Confirm floor payroll on Payroll (does not auto-pay).`,
    url: '/operations/payroll',
    tag: `shift_close:${id}`,
  }
}

/** SA + ASA with finance_write — same fan-out as money contract. */
export async function resolveFloorPayNotifyUserIds(db, { excludeUserId = null } = {}) {
  const ids = new Set()
  const { data: rows, error } = await db
    .from('staff_profiles')
    .select('id, role, permission_grants')
    .eq('is_active', true)
    .in('role', ['BossMich', 'assistant_super_admin'])
  if (error) throw error
  for (const row of rows || []) {
    if (excludeUserId && row.id === excludeUserId) continue
    if (row.role === 'BossMich') {
      ids.add(row.id)
      continue
    }
    const grants = row.permission_grants || {}
    if (grants.finance_write) ids.add(row.id)
  }
  return [...ids]
}

export async function notifyShiftCloseAccepted(input = {}) {
  const copy = buildShiftCloseAcceptCopy(input)
  const db = admin()
  const userIds = await resolveFloorPayNotifyUserIds(db, { excludeUserId: input.actorId || null })
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
  return { targets: userIds.length, push, copy }
}
