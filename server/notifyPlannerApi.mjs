/**
 * POST /api/notify-planner — inbox + push after a Planner assign.
 * Body: { card_id, user_ids, title? }
 */
import { canEditPlanning } from '../src/auth/permissions.js'
import { notifyPlannerAssignees } from './notifyPlanner.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

export async function handleNotifyPlannerRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-planner:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const db = admin()
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const staff = await resolveActiveStaff(db, null, {
      userId: userData.user.id,
      select: 'id, role, is_active, permission_grants',
    })
    if (!canEditPlanning(staff)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const cardId = String(body.card_id || '').trim()
    if (!cardId) return json(res, 400, { error: 'card_id required' })
    const userIds = (Array.isArray(body.user_ids) ? body.user_ids : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .slice(0, 80)

    const { data: card, error } = await db.from('plan_cards').select('id, title').eq('id', cardId).maybeSingle()
    if (error) return json(res, 500, { error: error.message })
    if (!card) return json(res, 404, { error: 'Task not found' })

    let notify = null
    try {
      notify = await notifyPlannerAssignees({
        cardId,
        userIds,
        title: body.title || card.title,
      })
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
