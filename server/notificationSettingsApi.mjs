import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import {
  BUSYBEE_SMS_SINGLE_MAX,
  clampNotificationCopy,
  messageMaxForChannel,
  resolveNotificationScope,
} from '../src/lib/notificationCopy.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const ALLOWED = new Set(['BossMich', 'assistant_super_admin'])

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

const SELECT_COLS =
  'id, scope, service_id, branch_slug, channel, frequency_months, enabled, title, message, created_at, updated_at'

/**
 * GET  /api/notification-settings
 * POST /api/notification-settings — upsert scoped detailing reminder with custom copy
 * DELETE /api/notification-settings?id=...
 */
export async function handleNotificationSettingsRequest(req, res) {
  setCors(res, 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' })
  const db = admin()
  const staff = await loadStaff(db, token)
  if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const branch = url.searchParams.get('branch')
    let query = db.from('notification_settings').select(SELECT_COLS)
    if (branch) query = query.eq('branch_slug', branch)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { settings: data || [], limits: { sms: BUSYBEE_SMS_SINGLE_MAX } })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const scoped = resolveNotificationScope({
      scope: body.scope,
      service_id: body.service_id,
      branch_slug: body.branch_slug,
    })
    if (!scoped.ok) return json(res, 400, { error: scoped.error })

    // Detailing-only when a service is picked.
    if (scoped.service_id) {
      const { data: svc } = await db
        .from('services')
        .select('id, pay_category, slug')
        .eq('id', scoped.service_id)
        .maybeSingle()
      if (!svc) return json(res, 400, { error: 'Service not found.' })
      const cat = String(svc.pay_category || '').toLowerCase()
      const slug = String(svc.slug || '').toLowerCase()
      const detailingSlugs = new Set(['ceramic-coating', 'nano-ceramic-tint', 'paint-protection-film'])
      if (cat !== 'detailing' && !detailingSlugs.has(slug)) {
        return json(res, 400, { error: 'Reminders are limited to detailing services.' })
      }
    }

    const channel = ['push', 'sms', 'both'].includes(body.channel) ? body.channel : 'push'
    const copy = clampNotificationCopy({
      channel,
      title: body.title,
      message: body.message,
    })
    const mMax = messageMaxForChannel(channel)
    if (body.message && String(body.message).trim().length > mMax) {
      return json(res, 400, {
        error: `Message must be ${mMax} characters or fewer (BusyBee ${channel === 'push' ? 'push' : 'SMS'} limit).`,
      })
    }
    if (!copy.message) {
      return json(res, 400, { error: 'Write a custom reminder message.' })
    }

    const payload = {
      scope: scoped.scope,
      service_id: scoped.service_id,
      branch_slug: scoped.branch_slug,
      channel: copy.channel,
      title: copy.title,
      message: copy.message,
      frequency_months: Math.min(24, Math.max(1, Number(body.frequency_months) || 6)),
      enabled: body.enabled !== false,
      created_by: staff.id,
      updated_at: new Date().toISOString(),
    }

    // Upsert by unique scope index — delete conflicting row then insert keeps it simple.
    let del = db.from('notification_settings').delete().eq('scope', scoped.scope)
    if (scoped.service_id) del = del.eq('service_id', scoped.service_id)
    else del = del.is('service_id', null)
    if (scoped.branch_slug) del = del.eq('branch_slug', scoped.branch_slug)
    else del = del.is('branch_slug', null)
    await del

    const { data, error } = await db
      .from('notification_settings')
      .insert(payload)
      .select(SELECT_COLS)
      .single()
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { setting: data })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('id')
    if (!id) return json(res, 400, { error: 'id required' })
    const { error } = await db.from('notification_settings').delete().eq('id', id)
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { ok: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
