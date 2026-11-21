import { busybeeBalance } from './busybee.mjs'
import { bearer, clientIp, json, rateLimit, setCors } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient } from './supabaseAdmin.mjs'

export async function handleBusybeeRequest(req, res) {
  setCors(res, 'GET, OPTIONS')
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
      const db = adminClient()
      const staff = await resolveActiveStaff(db, token, { select: 'role' })
      if (!staff || !['admin', 'BossMich', 'assistant_super_admin', 'marketing'].includes(staff.role)) {
        return json(res, 403, { error: 'Forbidden' })
      }

      if (req.method === 'GET') {
        const balance = await busybeeBalance()
        return json(res, balance.ok ? 200 : 502, balance)
      }

      return json(res, 403, {
        error: 'Manual and promo SMS sending is disabled — BusyBee SMS is restricted to automated Detailing, Services & Packages booking status updates.',
      })
    }

    return json(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
