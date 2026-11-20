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
 * GET    /api/notification-templates           — merged catalog (system + custom) with trigger links
 * POST   /api/notification-templates           — create a new custom notification template (SA / ASA)
 * PATCH  /api/notification-templates           — update system override or custom template
 * DELETE /api/notification-templates?key=...   — reset system override to default or delete custom template
 */
export async function handleNotificationTemplatesRequest(req, res) {
  setCors(res, 'GET, POST, PATCH, DELETE, OPTIONS')
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

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    let rawKey = String(body.key || '').trim().toLowerCase()
    if (!rawKey) {
      rawKey = `custom.${String(body.label || 'template').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${Date.now().toString(36)}`
    } else if (!rawKey.startsWith('custom.') && !SYSTEM_TEMPLATE_KEYS.includes(rawKey)) {
      rawKey = `custom.${rawKey}`
    }
    rawKey = rawKey.replace(/[^a-z0-9_.]/g, '_').slice(0, 63)
    if (!/^[a-z][a-z0-9_.]{2,63}$/.test(rawKey)) {
      return json(res, 400, { error: 'Invalid template key format. Must be 3-64 lowercase chars (a-z, 0-9, _, .).' })
    }

    const label = String(body.label || '').trim() || 'Custom notification'
    const channel = ['push', 'sms', 'both'].includes(body.channel) ? body.channel : 'both'
    const allowMultiPart = Boolean(body.allow_multipart)
    const title = trimNullable(body.title)
    const pushBody = trimNullable(body.body)
    const smsBody = trimNullable(body.sms_body)

    const check = validateNotificationCopy({
      channel,
      title: title || '',
      body: pushBody || '',
      sms_body: smsBody || '',
      allowMultiPart,
      requireTitle: channel !== 'sms',
      requireBody: channel !== 'sms',
    })
    if (!check.ok) return json(res, 400, { error: check.error })

    const { data: existing } = await db
      .from('notification_templates')
      .select('key')
      .eq('key', rawKey)
      .maybeSingle()
    if (existing) {
      return json(res, 400, { error: `Template key "${rawKey}" already exists.` })
    }

    const insertPayload = {
      key: rawKey,
      label,
      description: trimNullable(body.description) || 'Custom notification template',
      category: String(body.category || 'custom').trim(),
      channel,
      title,
      body: pushBody,
      sms_body: smsBody,
      enabled: body.enabled !== false,
      allow_multipart: allowMultiPart,
      is_custom: true,
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from('notification_templates')
      .insert(insertPayload)
      .select('key, title, body, sms_body, enabled, allow_multipart, updated_at, label, description, category, channel, is_custom')
      .single()

    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 201, { template: data, templates, can_edit: true })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const key = String(body.key || '').trim()
    const sys = SYSTEM_TEMPLATE_KEYS.includes(key) ? templateByKey(key) : null

    if (sys) {
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

    // Custom template update
    const { data: customRow, error: findErr } = await db
      .from('notification_templates')
      .select('*')
      .eq('key', key)
      .maybeSingle()
    if (findErr) return json(res, 400, { error: findErr.message })
    if (!customRow) return json(res, 404, { error: 'Template not found.' })

    const channel = ['push', 'sms', 'both'].includes(body.channel) ? body.channel : (customRow.channel || 'both')
    const allowMultiPart = typeof body.allow_multipart === 'boolean' ? body.allow_multipart : Boolean(customRow.allow_multipart)
    const title = body.title !== undefined ? trimNullable(body.title) : customRow.title
    const pushBody = body.body !== undefined ? trimNullable(body.body) : customRow.body
    const smsBody = body.sms_body !== undefined ? trimNullable(body.sms_body) : customRow.sms_body

    const check = validateNotificationCopy({
      channel,
      title: title || '',
      body: pushBody || '',
      sms_body: smsBody || '',
      allowMultiPart,
    })
    if (!check.ok) return json(res, 400, { error: check.error })

    const patch = {
      title,
      body: pushBody,
      sms_body: smsBody,
      channel,
      allow_multipart: allowMultiPart,
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    }
    if (body.label !== undefined) patch.label = String(body.label).trim()
    if (body.description !== undefined) patch.description = trimNullable(body.description)
    if (body.category !== undefined) patch.category = String(body.category).trim()
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled

    const { data, error } = await db
      .from('notification_templates')
      .update(patch)
      .eq('key', key)
      .select('key, title, body, sms_body, enabled, allow_multipart, updated_at, label, description, category, channel, is_custom')
      .single()
    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { template: data, templates, can_edit: true })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const key = String(url.searchParams.get('key') || '').trim()
    if (!key) return json(res, 400, { error: 'key required' })

    const { error } = await db.from('notification_templates').delete().eq('key', key)
    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { ok: true, templates, can_edit: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
