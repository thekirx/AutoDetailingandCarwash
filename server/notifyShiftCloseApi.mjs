/**
 * POST /api/notify-shift-close — web push after Finance accepts end of shift.
 * Body: { branch, business_date, close_id }
 */
import { createClient } from '@supabase/supabase-js'
import { canReviewShiftClose } from '../src/lib/shiftClose.js'
import { notifyShiftCloseAccepted } from './notifyShiftClose.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handleNotifyShiftCloseRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-shift-close:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
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
    if (!canReviewShiftClose(staff)) return json(res, 403, { error: 'Forbidden' })

    const body = await readJsonBody(req)
    const branch = String(body.branch || '').trim()
    const businessDate = String(body.business_date || '').slice(0, 10)
    const closeId = String(body.close_id || '').trim()
    if (!branch || !businessDate) {
      return json(res, 400, { error: 'branch and business_date required' })
    }

    let notify = null
    try {
      notify = await notifyShiftCloseAccepted({
        branch,
        businessDate,
        closeId,
        actorId: userData.user.id,
      })
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
