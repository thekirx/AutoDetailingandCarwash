/**
 * POST /api/notify-ops-event — crew assigned, end of shift submitted, payroll posted, cash advance request / decision.
 * Body: { event, id } — recipients come from the record, never from the client.
 */
import { createClient } from '@supabase/supabase-js'
import { OPS_EVENTS, notifyOpsEvent } from './notifyOpsEvent.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const UUID = /^[0-9a-f-]{36}$/i

export async function handleNotifyOpsEventRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-ops-event:${clientIp(req)}`, limit: 60, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const db = admin()
    const { data: userData } = await db.auth.getUser(token)
    if (!userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: actor } = await db
      .from('staff_profiles')
      .select('id, role, full_name, is_active, permission_grants, branch_slug')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!actor) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const event = String(body.event || '').trim()
    const id = String(body.id || '').trim()
    if (!OPS_EVENTS.includes(event) || !UUID.test(id)) return json(res, 400, { error: 'event and id required' })

    const notify = await notifyOpsEvent(db, { event, id, actor })
    if (notify.error) return json(res, notify.status || 500, { error: notify.error })
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
