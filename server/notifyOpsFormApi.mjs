/**
 * POST /api/notify-ops-form — best-effort complaint push after public/staff submit.
 * Public-safe: rate-limited; only notifies when form kind is complaint.
 * Body: { slug, payload?, submission_id?, form_name? }
 */
import { createClient } from '@supabase/supabase-js'
import { notifyOpsFormComplaint } from './notifyOpsForm.mjs'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handleNotifyOpsFormRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `notify-ops-form:${clientIp(req)}`, limit: 40, windowMs: 60_000 })
    const body = await readJsonBody(req)
    const slug = String(body.slug || '').trim().toLowerCase()
    if (!slug) return json(res, 400, { error: 'slug required' })

    const db = admin()
    const { data: form, error } = await db
      .from('ops_forms')
      .select('id, name, kind, slug')
      .eq('slug', slug)
      .maybeSingle()
    if (error) return json(res, 500, { error: error.message })
    if (!form) return json(res, 404, { error: 'Form not found' })
    if (form.kind !== 'complaint') {
      return json(res, 200, { ok: true, skipped: true, reason: 'not_complaint' })
    }

    // Optional auth — staff fill may send a bearer; public forms do not.
    const token = bearer(req)
    if (token) {
      await db.auth.getUser(token)
    }

    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}
    let notify = null
    try {
      notify = await notifyOpsFormComplaint({
        formName: body.form_name || form.name,
        payload,
        submissionId: body.submission_id || null,
        branch: body.branch || null,
      })
    } catch (err) {
      notify = { error: String(err.message || err) }
    }
    return json(res, 200, { ok: true, notify })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
