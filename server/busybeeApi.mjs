import { createClient } from '@supabase/supabase-js'
import { busybeeBalance, busybeeSendSms } from './busybee.mjs'
import { bearer, clientIp, json, rateLimit, readJsonBody, setCors } from './httpUtil.mjs'

export async function handleBusybeeRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    rateLimit({ key: `busybee:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
    if (req.method === 'GET' || req.method === 'POST') {
      const token = bearer(req)
      if (!token) return json(res, 401, { error: 'Unauthorized' })
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data: userData } = await db.auth.getUser(token)
      const { data: staff } = await db
        .from('staff_profiles')
        .select('role')
        .eq('id', userData?.user?.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!staff || !['admin', 'BossMich', 'assistant_super_admin', 'marketing'].includes(staff.role)) {
        return json(res, 403, { error: 'Forbidden' })
      }

      if (req.method === 'GET') {
        const balance = await busybeeBalance()
        return json(res, balance.ok ? 200 : 502, balance)
      }

      const body = await readJsonBody(req)
      const result = await busybeeSendSms({ phone: body.phone, message: body.message })
      return json(res, result.ok ? 200 : 502, result)
    }

    return json(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
