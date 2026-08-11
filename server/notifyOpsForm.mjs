/**
 * Ops form (complaint) push + inbox fan-out.
 * Targets: Super Admin + ASA (all) + Branch Admin for the complaint branch only.
 */
import { createClient } from '@supabase/supabase-js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function buildComplaintPushTargets(branch) {
  const targets = [{ roles: ['BossMich', 'assistant_super_admin'] }]
  if (branch) targets.push({ roles: ['admin'], branchId: branch })
  return targets
}

export function buildComplaintNotifyCopy({ formName, payload = {}, submissionId, template = null }) {
  const who = payload.customer_name || payload.name || 'Customer'
  const branch = String(payload.branch || payload.branch_slug || '').trim() || 'unspecified'
  const category = payload.category ? ` · ${payload.category}` : ''
  const vars = { name: who, branch: `${branch}${category}` }
  return {
    kind: 'ops_complaint',
    title: applyTemplateText(template?.title, vars, 'New complaint'),
    body: applyTemplateText(template?.body, vars, `${who} @ ${branch}${category}`),
    url: '/operations/planning?tab=forms',
    tag: submissionId ? `ops-complaint-${submissionId}` : `ops-complaint-${Date.now()}`,
    formName: formName || 'Customer Complaints',
  }
}

/**
 * Resolve staff user ids for complaint notify from staff_profiles (inbox even without push sub).
 */
export async function resolveComplaintNotifyUserIds(db, branch) {
  const ids = new Set()
  const { data: globals, error: gErr } = await db
    .from('staff_profiles')
    .select('id')
    .in('role', ['BossMich', 'assistant_super_admin'])
    .eq('is_active', true)
  if (gErr) throw gErr
  for (const row of globals || []) ids.add(row.id)

  if (branch) {
    const slug = String(branch).trim().toLowerCase()
    const { data: byPrimary, error: aErr } = await db
      .from('staff_profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .eq('branch_slug', slug)
    if (aErr) throw aErr
    for (const row of byPrimary || []) ids.add(row.id)

    // Multi-branch admins via staff_branch_access (when present)
    const { data: accessRows } = await db
      .from('staff_branch_assignments')
      .select('staff_id')
      .eq('branch_slug', slug)
    if (accessRows?.length) {
      const accessIds = accessRows.map((r) => r.staff_id).filter(Boolean)
      const { data: multiAdmins } = await db
        .from('staff_profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
        .in('id', accessIds)
      for (const row of multiAdmins || []) ids.add(row.id)
    }
  }
  return [...ids]
}

async function writeInbox(db, userIds, { kind, title, body, url, tag }) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return { inserted: 0 }
  const rows = ids.map((user_id) => ({ user_id, kind, title, body, url, tag }))
  const { error } = await db.from('user_notifications').insert(rows)
  return error ? { error: error.message } : { inserted: rows.length }
}

/**
 * After a complaint submission: inbox + web push to SA / ASA / branch admin.
 */
export async function notifyOpsFormComplaint({
  formName,
  payload = {},
  submissionId,
  branch = null,
} = {}) {
  const kindHint = payload
  const resolvedBranch =
    branch ||
    String(kindHint.branch || kindHint.branch_slug || '')
      .trim()
      .toLowerCase() ||
    null

  const db = admin()
  let templates = null
  try {
    templates = await loadTemplateMap(db)
  } catch {
    templates = null
  }
  if (templates && !templateEnabled(templates, 'ops.complaint')) {
    return { skipped: true, reason: 'disabled' }
  }
  const copy = buildComplaintNotifyCopy({
    formName,
    payload,
    submissionId,
    template: templates?.['ops.complaint'],
  })
  const result = { targets: 0, inbox: null, push: null, branch: resolvedBranch }

  try {
    const userIds = await resolveComplaintNotifyUserIds(db, resolvedBranch)
    result.targets = userIds.length
    result.inbox = await writeInbox(db, userIds, copy)
    if (userIds.length) {
      try {
        result.push = await sendWebPushToUsers({
          userIds,
          title: copy.title,
          body: copy.body,
          url: copy.url,
          tag: copy.tag,
          kind: copy.kind,
        })
      } catch (err) {
        result.push = { error: String(err.message || err) }
      }
    } else {
      result.push = { sent: 0, pruned: 0, subscriptions: 0 }
    }
  } catch (err) {
    return { error: String(err.message || err), ...result }
  }

  return result
}
