import { createClient } from '@supabase/supabase-js'
import { resolvePushTargets, sendWebPushToUsers } from './webPush.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Auth matrix (playbook §7):
 * - Anon / public: targets must NOT include userId (staff fan-out only)
 * - Authenticated staff (admin/BossMich): any targets
 * - Service: any (internal)
 */
export async function handleSendPushRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const body = await readJsonBody(req)
    const targets = Array.isArray(body.targets) ? body.targets : []
    const title = String(body.title || '').trim()
    const message = String(body.body || '').trim()
    if (!title || !message || !targets.length) {
      return json(res, 400, { error: 'title, body, and targets[] required' })
    }

    const hasUserTarget = targets.some((t) => t.userId)
    const token = bearer(req)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isService = token && serviceKey && token === serviceKey

    let staffOk = false
    if (token && !isService) {
      const db = admin()
      const { data: userData } = await db.auth.getUser(token)
      if (userData?.user) {
        const { data: staff } = await db
          .from('staff_profiles')
          .select('role, is_active')
          .eq('id', userData.user.id)
          .eq('is_active', true)
          .maybeSingle()
        staffOk = staff && ['admin', 'BossMich', 'marketing'].includes(staff.role)
      }
    }

    if (hasUserTarget && !isService && !staffOk) {
      return json(res, 403, { error: 'userId targets require staff or service auth' })
    }

    const userIds = await resolvePushTargets(targets)
    const result = await sendWebPushToUsers({
      userIds,
      title,
      body: message,
      url: body.url || '/',
      tag: body.tag,
      kind: body.kind || 'system',
    })

    // Inbox rows for explicit userIds
    const inboxIds = [...new Set(targets.map((t) => t.userId).filter(Boolean))]
    if (inboxIds.length) {
      const db = admin()
      await db.from('user_notifications').insert(
        inboxIds.map((user_id) => ({
          user_id,
          kind: body.kind || 'system',
          title,
          body: message,
          url: body.url || '/',
          tag: body.tag || null,
        })),
      )
    }

    return json(res, 200, { ok: true, ...result, userIds: userIds.length })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}

export async function handlePushSubscribeRequest(req, res) {
  setCors(res, 'POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Sign in required' })
    const db = admin()
    const { data: userData, error: userErr } = await db.auth.getUser(token)
    if (userErr || !userData?.user) return json(res, 401, { error: 'Unauthorized' })
    const userId = userData.user.id

    if (req.method === 'DELETE') {
      const body = await readJsonBody(req)
      const endpoint = body.endpoint
      if (!endpoint) return json(res, 400, { error: 'endpoint required' })
      await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId)
      return json(res, 200, { ok: true })
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
    const body = await readJsonBody(req)
    const endpoint = body.endpoint
    const p256dh = body.keys?.p256dh || body.p256dh
    const auth = body.keys?.auth || body.auth
    if (!endpoint || !p256dh || !auth) return json(res, 400, { error: 'endpoint and keys required' })

    let role = userData.user.user_metadata?.role || null
    let branch_slug = null
    const { data: staff } = await db.from('staff_profiles').select('role, branch_slug').eq('id', userId).maybeSingle()
    if (staff) {
      role = staff.role
      branch_slug = staff.branch_slug
    } else {
      const { data: cust } = await db.from('customers').select('role').eq('id', userId).maybeSingle()
      if (cust) role = cust.role
    }

    const row = {
      endpoint,
      user_id: userId,
      p256dh,
      auth,
      role,
      branch_slug,
      user_agent: String(body.user_agent || req.headers['user-agent'] || '').slice(0, 300),
      updated_at: new Date().toISOString(),
    }

    const { error } = await db.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { ok: true })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
