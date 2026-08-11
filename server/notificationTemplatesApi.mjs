import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { SYSTEM_TEMPLATE_KEYS } from '../src/lib/notificationTemplates.js'
import { loadMergedTemplates } from './notificationTemplatesDb.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

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

function clampText(value, max) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, max)
}

/**
 * GET   /api/notification-templates  — merged catalog
 * PATCH /api/notification-templates  — upsert SA copy for one key
 */
export async function handleNotificationTemplatesRequest(req, res) {
  setCors(res, 'GET, PATCH, OPTIONS')
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
    return json(res, 200, { templates })
  }

  if (req.method === 'PATCH') {
    if (!WRITE_ROLES.has(staff.role)) {
      return json(res, 403, { error: 'Only Super Admin can edit templates.' })
    }
    const body = await readJsonBody(req)
    const key = String(body.key || '').trim()
    if (!SYSTEM_TEMPLATE_KEYS.includes(key)) {
      return json(res, 400, { error: 'Unknown template key.' })
    }
    const row = {
      key,
      title: body.title !== undefined ? clampText(body.title, 160) : undefined,
      body: body.body !== undefined ? clampText(body.body, 1000) : undefined,
      sms_body: body.sms_body !== undefined ? clampText(body.sms_body, 1000) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      updated_at: new Date().toISOString(),
      updated_by: staff.id,
    }
    const patch = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined))
    const { data, error } = await db
      .from('notification_templates')
      .upsert(patch, { onConflict: 'key' })
      .select('key, title, body, sms_body, enabled, updated_at')
      .single()
    if (error) return json(res, 400, { error: error.message })
    const templates = await loadMergedTemplates(db)
    return json(res, 200, { template: data, templates })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
