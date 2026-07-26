/**
 * Send finance quotation email via Resend REST (no SDK dep).
 * Env: RESEND_API_KEY, RESEND_FROM (optional, defaults to onboarding@resend.dev)
 */
import { createClient } from '@supabase/supabase-js'

const WRITE_ROLES = new Set(['BossMich', 'admin', 'assistant_super_admin'])

export async function sendFinanceQuote({ accessToken, body }) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service env')

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken)
  if (userErr || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff } = await admin
    .from('staff_profiles')
    .select('id, role, permission_grants, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff || !WRITE_ROLES.has(staff.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  if (staff.role === 'assistant_super_admin') {
    const grants = { finance_write: false, ...(staff.permission_grants || {}) }
    if (!grants.finance_write) throw Object.assign(new Error('finance_write grant required'), { status: 403 })
  }

  const to = String(body.to || '').trim()
  const subject = String(body.subject || 'Hakum Auto Care quotation').trim()
  const title = String(body.title || 'Quotation').trim()
  const amountLabel = String(body.amount_label || '').trim()
  const notes = String(body.notes || '').trim()
  const branch = String(body.branch || '').trim()

  if (!to || !to.includes('@')) throw Object.assign(new Error('Valid recipient email is required'), { status: 400 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // ponytail: allow local/dev without Resend — return preview payload
    return {
      ok: true,
      preview: true,
      message: 'RESEND_API_KEY not set — quote not sent (preview only)',
      to,
      subject,
      html: buildHtml({ title, amountLabel, notes, branch }),
    }
  }

  const from = process.env.RESEND_FROM || 'Hakum Auto Care <onboarding@resend.dev>'
  const html = buildHtml({ title, amountLabel, notes, branch })
  const idempotencyKey = `finance-quote/${staff.id}/${to}/${Buffer.from(subject + amountLabel).toString('base64url').slice(0, 24)}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(payload.message || payload.error || 'Resend send failed'), { status: 502 })
  }
  return { ok: true, id: payload.id, to, subject }
}

function buildHtml({ title, amountLabel, notes, branch }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#64748b;font-weight:700">Hakum Auto Care</p>
  <h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(title)}</h1>
  ${branch ? `<p style="margin:0 0 8px;color:#475569">Branch: <strong>${escapeHtml(branch)}</strong></p>` : ''}
  ${amountLabel ? `<p style="font-size:28px;font-weight:700;margin:16px 0">${escapeHtml(amountLabel)}</p>` : ''}
  ${notes ? `<p style="white-space:pre-wrap;line-height:1.5;color:#334155">${escapeHtml(notes)}</p>` : ''}
  <p style="margin-top:28px;font-size:12px;color:#94a3b8">This quotation was sent from Hakum operations finance. Not a tax invoice.</p>
</div>`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function handleFinanceQuoteRequest(req, res, helpers) {
  const { json, setCors } = await import('./httpUtil.mjs')
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const body = helpers?.getBody ? await helpers.getBody() : {}
    const token = helpers?.getAccessToken ? helpers.getAccessToken() : null
    const result = await sendFinanceQuote({ accessToken: token, body })
    return json(res, 200, result)
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
