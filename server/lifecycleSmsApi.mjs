/**
 * /api/lifecycle-sms — customer lifecycle sends.
 * kind=welcome: customer self-service (first signup/login), dedupes to once ever.
 * kind=loyalty_claim: POS staff after a loyalty award line is paid out.
 */
import { adminDb, sendLifecycleSms } from './lifecycleSms.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

const POS_ROLES = new Set(['admin', 'BossMich', 'assistant_super_admin'])

function safeOrigin(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.origin
  } catch {
    return ''
  }
}

export async function handleLifecycleSmsRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `lifecycle-sms:${clientIp(req)}`, limit: 30, windowMs: 60_000 })
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })

    const db = adminDb()
    const { data: userData } = await db.auth.getUser(token)
    const user = userData?.user
    if (!user) return json(res, 401, { error: 'Unauthorized' })

    const body = await readJsonBody(req)
    const kind = String(body.kind || '').trim()

    if (kind === 'welcome') {
      // Self only: the signed-in customer gets their own download-the-app welcome.
      const result = await sendLifecycleSms(db, {
        kind: 'welcome_app',
        customerId: user.id,
        appUrl: safeOrigin(body.site_origin) || safeOrigin(req.headers?.origin),
      })
      return json(res, 200, { ok: true, result })
    }

    if (kind === 'loyalty_claim') {
      const { data: staff } = await db
        .from('staff_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!staff || !POS_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

      const customerId = String(body.customer_id || '').trim()
      if (!customerId) return json(res, 400, { error: 'customer_id required' })
      // Re-arm per claim: dedupe key includes the sale so future claims still thank.
      const saleId = String(body.sale_id || '').trim()
      const result = await sendLifecycleSms(db, {
        kind: 'loyalty_claim',
        eventType: saleId ? `loyalty_claim_${saleId}` : 'loyalty_claim',
        customerId,
      })
      return json(res, 200, { ok: true, result })
    }

    return json(res, 400, { error: 'Unknown kind' })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
