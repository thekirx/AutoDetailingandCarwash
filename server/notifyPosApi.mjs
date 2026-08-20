/**
 * POST /api/notify-pos — SA/ASA/BA inbox after POS sale, expense, or cash-advance decision.
 * Body: { event, branch, amount_minor?, title?, status?, entity_id? }
 */
import { createClient } from '@supabase/supabase-js'
import { canAccessPos } from '../src/auth/permissions.js'
import { notifyPosEvent } from './notifyPos.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const EVENTS = new Set(['sale', 'expense', 'cash_advance'])

export async function handleNotifyPosRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-pos:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const db = admin()
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active, permission_grants, branch_slug')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!canAccessPos(staff)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const event = String(body.event || '').trim()
    if (!EVENTS.has(event)) return json(res, 400, { error: 'event required' })
    const branch = String(body.branch || staff?.branch_slug || '').trim()
    if (!branch) return json(res, 400, { error: 'branch required' })

    let notify = null
    try {
      notify = await notifyPosEvent({
        event,
        branch,
        amountMinor: Number(body.amount_minor) || 0,
        title: body.title || '',
        status: body.status || '',
        entityId: body.entity_id || '',
      })
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
