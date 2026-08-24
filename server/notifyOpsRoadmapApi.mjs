/**
 * POST /api/notify-ops-lab — inbox + push when Ops Lab boards change.
 * Body: { event, board_id, board_title, board_kind }
 */
import { createClient } from '@supabase/supabase-js'
import { canAccessOpsRoadmap } from '../src/auth/permissions.js'
import { notifyOpsLabActivity } from './notifyOpsRoadmap.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handleNotifyOpsLabRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-ops-lab:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const db = admin()
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active, permission_grants, full_name')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!canAccessOpsRoadmap(staff)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const boardId = String(body.board_id || '').trim()
    const boardTitle = String(body.board_title || 'Ops Lab board').trim()
    const boardKind = String(body.board_kind || 'brainstorm').trim()
    const event = String(body.event || 'board_created').trim()
    if (!boardId) return json(res, 400, { error: 'board_id required' })

    let notify = null
    try {
      notify = await notifyOpsLabActivity({
        event,
        boardId,
        boardTitle,
        boardKind,
        itemTitle: String(body.item_title || '').trim(),
        fromStatus: String(body.from_status || '').trim(),
        toStatus: String(body.to_status || '').trim(),
        actorId: userData.user.id,
        actorName: staff.full_name || 'Teammate',
      })
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
