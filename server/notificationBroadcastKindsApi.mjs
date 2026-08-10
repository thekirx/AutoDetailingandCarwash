import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const READ_ROLES = new Set(['BossMich', 'assistant_super_admin', 'marketing'])
const WRITE_ROLES = new Set(['BossMich', 'assistant_super_admin'])

const SELECT_COLS =
  'id, slug, label, description, default_title, default_body, display_order, is_active, created_at, updated_at'

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

function slugify(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

/**
 * GET    /api/notification-broadcast-kinds
 * POST   /api/notification-broadcast-kinds  — create (SA/ASA)
 * PATCH  /api/notification-broadcast-kinds  — update (SA/ASA)
 * DELETE /api/notification-broadcast-kinds?id=... — soft-delete (is_active=false)
 */
export async function handleNotificationBroadcastKindsRequest(req, res) {
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
    const url = new URL(req.url, 'http://localhost')
    const includeInactive = url.searchParams.get('all') === '1' && WRITE_ROLES.has(staff.role)
    let query = db.from('notification_broadcast_kinds').select(SELECT_COLS)
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
      .order('display_order', { ascending: true })
      .order('label', { ascending: true })
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { kinds: data || [] })
  }

  if (!WRITE_ROLES.has(staff.role)) return json(res, 403, { error: 'Only Super Admin can manage kinds.' })

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const label = String(body.label || '').trim()
    if (!label) return json(res, 400, { error: 'Label is required.' })
    const slug = slugify(body.slug || label)
    if (!/^[a-z][a-z0-9_]{1,47}$/.test(slug)) {
      return json(res, 400, { error: 'Slug must start with a letter (a-z, 0-9, underscore).' })
    }
    const row = {
      slug,
      label: label.slice(0, 64),
      description: body.description ? String(body.description).trim().slice(0, 200) : null,
      default_title: body.default_title ? String(body.default_title).trim().slice(0, 160) : null,
      default_body: body.default_body ? String(body.default_body).trim().slice(0, 1000) : null,
      display_order: Number.isFinite(Number(body.display_order)) ? Number(body.display_order) : 100,
      is_active: body.is_active !== false,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('notification_broadcast_kinds')
      .insert(row)
      .select(SELECT_COLS)
      .single()
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { kind: data })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const id = String(body.id || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })
    const patch = { updated_at: new Date().toISOString() }
    if (body.label != null) {
      const label = String(body.label).trim()
      if (!label) return json(res, 400, { error: 'Label cannot be empty.' })
      patch.label = label.slice(0, 64)
    }
    if (body.description !== undefined) {
      patch.description = body.description ? String(body.description).trim().slice(0, 200) : null
    }
    if (body.default_title !== undefined) {
      patch.default_title = body.default_title ? String(body.default_title).trim().slice(0, 160) : null
    }
    if (body.default_body !== undefined) {
      patch.default_body = body.default_body ? String(body.default_body).trim().slice(0, 1000) : null
    }
    if (body.display_order !== undefined && Number.isFinite(Number(body.display_order))) {
      patch.display_order = Number(body.display_order)
    }
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
    if (body.slug != null) {
      const slug = slugify(body.slug)
      if (!/^[a-z][a-z0-9_]{1,47}$/.test(slug)) {
        return json(res, 400, { error: 'Invalid slug.' })
      }
      patch.slug = slug
    }
    const { data, error } = await db
      .from('notification_broadcast_kinds')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message })
    if (!data) return json(res, 404, { error: 'Kind not found.' })
    return json(res, 200, { kind: data })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const id = String(url.searchParams.get('id') || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })
    const { data, error } = await db
      .from('notification_broadcast_kinds')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_COLS)
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message })
    if (!data) return json(res, 404, { error: 'Kind not found.' })
    return json(res, 200, { kind: data })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
