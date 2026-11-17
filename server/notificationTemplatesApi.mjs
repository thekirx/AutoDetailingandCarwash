import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { validateNotificationCopy } from '../src/lib/notificationCopy.js'
import { SYSTEM_TEMPLATE_KEYS, templateByKey } from '../src/lib/notificationTemplates.js'
import { loadMergedTemplates } from './notificationTemplatesDb.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const READ_ROLES = new Set(['BossMich', 'assistant_super_admin', 'marketing'])
const WRITE_ROLES = new Set(['BossMich', 'assistant_super_admin'])

async function loadStaff(db, token) {
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  return staff
}

function trimNullable(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

/**
 * Pure validator for system notification template updates (shared by tests & API).
 */
export function validateSystemTemplatePatch(sys, body = {}) {
  const allowMultiPart = Boolean(body.allow_multipart)
  const title = body.title !== undefined ? trimNullable(body.title) : null
  const pushBody = body.body !== undefined ? trimNullable(body.body) : null
  const smsBody = body.sms_body !== undefined ? trimNullable(body.sms_body) : null
  if (allowMultiPart && sys.channel === 'push') {
    return { ok: false, error: 'Multi-part SMS option applies only to SMS-enabled templates.' }
  }
  const check = validateNotificationCopy({
    channel: sys.channel,
    title: title || '',
    body: pushBody || '',
    sms_body: smsBody || '',
    allowMultiPart,
  })
  if (!check.ok) return { ok: false, error: check.error }
  const row = {
    key: sys.key,
    updated_at: new Date().toISOString(),
  }
  if (body.title !== undefined) row.title = title
  if (body.body !== undefined) row.body = pushBody
  if (body.sms_body !== undefined) row.sms_body = smsBody
  if (typeof body.enabled === 'boolean') row.enabled = body.enabled
  if (typeof body.allow_multipart === 'boolean') row.allow_multipart = body.allow_multipart
  return { ok: true, row }
}

/**
 * GET    /api/notification-templates           — merged catalog with trigger links
 * PATCH  /api/notification-templates           — validate + upsert SA copy override
 * DELETE /api/notification-templates?key=...   — reset override row back to default
 */
export async function handleNotificationTemplatesRequest(req, res) {
  setCors(res, 'GET, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' })
  const db = admin()
  const staff = await loadStaff(db, token)
  if (!staff || !READ_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

  if (req.method === 'GET') {
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { templates, can_edit: WRITE_ROLES.has(staff.role) })
  }

  if (!WRITE_ROLES.has(staff.role)) {
    return json(res, 403, { error: 'Only Super Admin can edit templates.' })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const key = String(body.key || '').trim()
    const sys = SYSTEM_TEMPLATE_KEYS.includes(key) ? templateByKey(key) : null
    if (!sys) {
      return json(res, 400, { error: 'Unknown template key.' })
    }
    const check = validateSystemTemplatePatch(sys, body)
    if (!check.ok) {
      return json(res, 400, { error: check.error })
    }
    const patch = { ...check.row, updated_by: staff.id }
    let { data, error } = await db
      .from('notification_templates')
      .upsert(patch, { onConflict: 'key' })
      .select('key, title, body, sms_body, enabled, allow_multipart, updated_at')
      .single()
    if (error && /column .*allow_multipart.* does not exist/i.test(error.message || '')) {
      const legacy = { ...patch }
      delete legacy.allow_multipart
      const retry = await db
        .from('notification_templates')
        .upsert(legacy, { onConflict: 'key' })
        .select('key, title, body, sms_body, enabled, updated_at')
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { template: data, templates, can_edit: true })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const key = String(url.searchParams.get('key') || '').trim()
    if (!SYSTEM_TEMPLATE_KEYS.includes(key)) {
      return json(res, 400, { error: 'Unknown template key.' })
    }
    const { error } = await db.from('notification_templates').delete().eq('key', key)
    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { templates, can_edit: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
