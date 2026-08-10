import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function userClient(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or anon key')
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
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

/**
 * GET  /api/notification-settings — list settings (optionally by branch)
 * POST /api/notification-settings — upsert { service_id, branch_slug, channel, frequency_months, enabled }
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
    let query = db.from('notification_settings').select('id, service_id, branch_slug, channel, frequency_months, enabled, created_at, updated_at')
    if (branch) query = query.eq('branch_slug', branch)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { settings: data || [] })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const payload = {
      service_id: body.service_id || null,
      branch_slug: body.branch_slug || null,
      channel: ['push', 'sms', 'both'].includes(body.channel) ? body.channel : 'push',
      frequency_months: Math.min(24, Math.max(1, Number(body.frequency_months) || 6)),
      enabled: body.enabled !== false,
      created_by: staff.id,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('notification_settings')
      .upsert(payload, { onConflict: 'service_id, branch_slug' })
      .select('id, service_id, branch_slug, channel, frequency_months, enabled')
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
