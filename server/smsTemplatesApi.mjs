import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { analyzeBusybeeSms } from '../src/lib/notificationCopy.js'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

export const SMS_TEMPLATE_TYPES = new Set([
  'promo',
  'reminder',
  'loyalty',
  'birthday',
  'booking_confirm',
  'booking_remind',
])

const READ_ROLES = new Set([
  'BossMich',
  'assistant_super_admin',
  'marketing',
  'admin',
  'sales',
  'operations_lead',
  'team_lead',
])
const WRITE_ROLES = new Set(['BossMich', 'assistant_super_admin', 'marketing'])

async function loadStaff(db, token) {
  return resolveActiveStaff(db, token, { select: 'id, role, is_active' })
}

/**
 * Pure validation helper for reusable SMS campaign/quick-send templates.
 */
export function validateSmsTemplatePayload(body = {}, { partial = false } = {}) {
  const name = body.name !== undefined ? String(body.name || '').trim() : undefined
  const template_type =
    body.template_type !== undefined ? String(body.template_type || '').trim() : undefined
  const smsBody = body.body !== undefined ? String(body.body || '').trim() : undefined
  const allowMultiPart = Boolean(body.allow_multipart)

  if (!partial || name !== undefined) {
    if (!name) return { ok: false, error: 'Template name is required.' }
    if (name.length > 80) return { ok: false, error: 'Template name must be 80 characters or fewer.' }
  }
  if (!partial || template_type !== undefined) {
    if (!SMS_TEMPLATE_TYPES.has(template_type)) {
      return { ok: false, error: 'Invalid SMS template type.' }
    }
  }
  if (!partial || smsBody !== undefined) {
    if (!smsBody) return { ok: false, error: 'SMS body is required.' }
    const analysis = analyzeBusybeeSms(smsBody, { allowMultiPart })
    if (!analysis.ok) return { ok: false, error: analysis.error }
  }

  return {
    ok: true,
    patch: {
      ...(name !== undefined ? { name } : {}),
      ...(template_type !== undefined ? { template_type } : {}),
      ...(smsBody !== undefined ? { body: smsBody } : {}),
      ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
      ...(typeof body.allow_multipart === 'boolean' ? { allow_multipart: body.allow_multipart } : {}),
    },
  }
}

async function listSmsTemplates(db) {
  let { data, error } = await db
    .from('sms_templates')
    .select('id, name, template_type, body, is_active, allow_multipart, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error && /column .* does not exist/i.test(error.message || '')) {
    const legacy = await db
      .from('sms_templates')
      .select('id, name, template_type, body, is_active, created_at')
      .order('created_at', { ascending: false })
    data = legacy.data
    error = legacy.error
  }
  if (error) return { error: error.message }
  return { templates: data || [] }
}

/**
 * GET    /api/notifications?operation=sms-templates         — list templates
 * POST   /api/notifications?operation=sms-templates         — create template (BusyBee validated)
 * PATCH  /api/notifications?operation=sms-templates         — update template (BusyBee validated)
 * DELETE /api/notifications?operation=sms-templates&id=...  — delete template
 */
export async function handleSmsTemplatesRequest(req, res) {
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
    const out = await listSmsTemplates(db)
    if (out.error) return json(res, 400, { error: out.error })
    return json(res, 200, { templates: out.templates, can_edit: WRITE_ROLES.has(staff.role) })
  }

  if (!WRITE_ROLES.has(staff.role)) {
    return json(res, 403, { error: 'Only Super Admin, ASA, or Marketing can manage SMS templates.' })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const check = validateSmsTemplatePayload(body, { partial: false })
    if (!check.ok) return json(res, 400, { error: check.error })

    const row = { ...check.patch, is_active: body.is_active !== false }
    let { data, error } = await db
      .from('sms_templates')
      .insert(row)
      .select('id, name, template_type, body, is_active, allow_multipart, created_at, updated_at')
      .single()
    if (error && /column .* does not exist/i.test(error.message || '')) {
      const legacyRow = { name: row.name, template_type: row.template_type, body: row.body, is_active: row.is_active }
      const retry = await db
        .from('sms_templates')
        .insert(legacyRow)
        .select('id, name, template_type, body, is_active, created_at')
        .single()
      data = retry.data
      error = retry.error
    }
    if (error) return json(res, 400, { error: error.message })
    return json(res, 201, { template: data })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const id = String(body.id || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })
    const check = validateSmsTemplatePayload(body, { partial: true })
    if (!check.ok) return json(res, 400, { error: check.error })

    const patch = { ...check.patch, updated_at: new Date().toISOString() }
    let { data, error } = await db
      .from('sms_templates')
      .update(patch)
      .eq('id', id)
      .select('id, name, template_type, body, is_active, allow_multipart, created_at, updated_at')
      .maybeSingle()
    if (error && /column .* does not exist/i.test(error.message || '')) {
      const legacyPatch = { ...patch }
      delete legacyPatch.allow_multipart
      delete legacyPatch.updated_at
      const retry = await db
        .from('sms_templates')
        .update(legacyPatch)
        .eq('id', id)
        .select('id, name, template_type, body, is_active, created_at')
        .maybeSingle()
      data = retry.data
      error = retry.error
    }
    if (error) return json(res, 400, { error: error.message })
    if (!data) return json(res, 404, { error: 'Template not found.' })
    return json(res, 200, { template: data })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const id = String(url.searchParams.get('id') || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })
    const { data, error } = await db
      .from('sms_templates')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message })
    if (!data) return json(res, 404, { error: 'Template not found.' })
    return json(res, 200, { deleted: id })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
