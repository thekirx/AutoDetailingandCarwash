/**
 * Ops form (complaint) push + inbox fan-out.
 * Targets: Super Admin + ASA (all) + Branch Admin for the complaint branch only (none when unbranched).
 */
import { createClient } from '@supabase/supabase-js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { GLOBAL_NOTIFY_ROLES, NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
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
  try {
    const rule = NOTIFY_EVENTS.complaint
    const roles = resolvedBranch ? rule.roles : rule.roles.filter((r) => GLOBAL_NOTIFY_ROLES.includes(r))
    const recipients = await resolveStaffRecipients(db, { ...rule, roles, branch: resolvedBranch })
    return { ...(await notifyRecipients(db, recipients, copy)), branch: resolvedBranch }
  } catch (err) {
    return { error: String(err.message || err), targets: 0, branch: resolvedBranch }
  }
}
