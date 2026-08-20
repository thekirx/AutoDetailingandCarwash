import { createClient } from '@supabase/supabase-js'
import { json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const text = (value) => String(value ?? '').trim()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SITE_TYPES = ['commercial_lot', 'mall_retail', 'fuel_station', 'village_condo']

/* Mirrors the client guard: a filled honeypot or a form submitted faster than a
   person could type it is dropped. Client-side checks are advice, not a gate —
   this endpoint is the only way in now, so it re-checks. */
function guardError(body) {
  if (text(body.honeypot)) return 'Unable to submit right now.'
  const elapsed = Number(body.elapsedMs)
  if (!Number.isFinite(elapsed) || elapsed < 2000) return 'Please wait a moment and try again.'
  return null
}

/**
 * One row per public form. Each builder returns { table, row } or { error }.
 * Column sets are validated here rather than trusted from the client — the
 * service role bypasses RLS, so this function is the whole perimeter.
 */
const builders = {
  partnership(body) {
    const siteType = text(body.siteType)
    const name = text(body.name)
    const email = text(body.email).toLowerCase()
    const contactNumber = text(body.contactNumber)
    const city = text(body.city)
    const message = text(body.message)
    if (!name || !email || !contactNumber || !city || !message) {
      return { error: 'Name, email, contact number, site location, and message are required.' }
    }
    if (!EMAIL_PATTERN.test(email)) return { error: 'Enter a valid email address.' }
    return {
      table: 'partnership_inquiries',
      row: {
        site_type: SITE_TYPES.includes(siteType) ? siteType : SITE_TYPES[0],
        name,
        email,
        contact_number: contactNumber,
        city,
        message,
      },
    }
  },

  complaint(body) {
    const customerName = text(body.customerName)
    const branch = text(body.branch)
    const category = text(body.category)
    const description = text(body.description)
    if (!customerName || !category || !description) {
      return { error: 'Name, category, and description are required.' }
    }
    return {
      table: 'complaints',
      row: {
        customer_name: customerName,
        branch: branch || null,
        category,
        description,
        status: 'submitted',
      },
    }
  },
}

/**
 * Public inquiry intake — contact, partnership, and complaint forms.
 * Anon lost direct INSERT on these tables (migration public_inquiry_api_geofence),
 * so submissions come through here and are written with the service role.
 */
export async function handlePublicInquiryRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    rateLimit({ key: `public-inquiry:${clientIp(req)}`, limit: 10, windowMs: 60_000 })
    const body = await readJsonBody(req)

    const build = builders[text(body.kind)]
    if (!build) return json(res, 400, { error: 'Unknown inquiry type.' })

    const blocked = guardError(body)
    if (blocked) return json(res, 400, { error: blocked })

    const { table, row, error: invalid } = build(body)
    if (invalid) return json(res, 400, { error: invalid })

    const { error } = await admin().from(table).insert(row)
    if (error) return json(res, 500, { error: 'We could not send that just now. Please try again.' })

    return json(res, 200, { ok: true })
  } catch (err) {
    const status = err?.status === 429 ? 429 : 500
    const message =
      status === 429
        ? 'Too many messages from this connection. Please try again shortly.'
        : 'We could not send that just now. Please try again.'
    return json(res, status, { error: message })
  }
}
