import { busybeeBalance, busybeeSendSms } from '../server/busybee.mjs'
import { json, readJsonBody, setCors, bearer } from '../server/httpUtil.mjs'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  setCors(res, 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    if (req.method === 'GET') {
      const bal = await busybeeBalance()
      return json(res, bal.ok ? 200 : 502, bal)
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

    // Staff-only live send (marketing/admin)
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
    if (!staff || !['admin', 'BossMich', 'marketing'].includes(staff.role)) {
      return json(res, 403, { error: 'Forbidden' })
    }

    const body = await readJsonBody(req)
    const result = await busybeeSendSms({ phone: body.phone, message: body.message })
    return json(res, result.ok ? 200 : 502, result)
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
