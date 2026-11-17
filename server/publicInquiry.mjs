import { buildTintLead, validateTintConfig } from '../src/lib/tintFinder.js'
import { bearer, json, readJsonBody, setCors, clientIp, rateLimit } from './httpUtil.mjs'
import { notifyStaffEvent } from './notifyOpsEvent.mjs'
import { submitPublicOpsFormAndSync } from './publicOpsForm.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const text = (value) => String(value ?? '').trim()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SITE_TYPES = ['commercial_lot', 'mall_retail', 'fuel_station', 'village_condo']

/* Mirrors the client guard: a filled honeypot or a form submitted faster than a
   person could type it is dropped. Client-side checks are advice, not a gate —
   this endpoint is the only way in now, so it re-checks. Accepts both the
   browser field names (company_website / form_opened_at) and test aliases. */
function guardError(body) {
  if (text(body.honeypot || body.company_website)) return 'Unable to submit right now.'
  const elapsed = Number(body.elapsedMs)
  if (Number.isFinite(elapsed)) {
    if (elapsed < 2000) return 'Please wait a moment and try again.'
    return null
  }
  const opened = Number(body.form_opened_at ?? body.openedAt ?? 0)
  if (!opened || Date.now() - opened < 2000) return 'Please wait a moment and try again.'
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
 * Public inquiry intake — partnership, complaint, tint finder, and smart ops forms.
 * Anon lost direct INSERT on these tables (API geofence migrations),
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
    const body = await readJsonBody(req)
    const kind = text(body.kind)

    if (kind === 'event_registration') {
      rateLimit({ key: `public-inquiry:${clientIp(req)}`, limit: 10, windowMs: 60_000 })
      return json(res, 410, { error: 'Event RSVP registration has been retired.' })
    }

    const build = builders[kind]
    if (!build && kind !== 'tint_finder' && kind !== 'ops_form') {
      rateLimit({ key: `public-inquiry:${clientIp(req)}`, limit: 10, windowMs: 60_000 })
      return json(res, 400, { error: 'Unknown inquiry type.' })
    }

    const token = bearer(req)
    let staffId = null
    let cachedDb = null
    const getDb = () => (cachedDb ||= admin())
    if (kind === 'ops_form' && text(body.source) === 'staff' && token) {
      const { data: userData } = await getDb().auth.getUser(token)
      if (userData?.user?.id) {
        const { data: staff } = await getDb()
          .from('staff_profiles')
          .select('id, is_active')
          .eq('id', userData.user.id)
          .eq('is_active', true)
          .maybeSingle()
        if (staff?.is_active) staffId = staff.id
      }
    }

    if (staffId) {
      rateLimit({ key: `public-inquiry-staff:${staffId}`, limit: 60, windowMs: 60_000 })
    } else {
      rateLimit({ key: `public-inquiry:${clientIp(req)}`, limit: 10, windowMs: 60_000 })
    }

    const blocked = staffId ? null : guardError(body)
    if (blocked) return json(res, 400, { error: blocked })

    if (kind === 'ops_form') {
      const result = await submitPublicOpsFormAndSync({
        db: getDb(),
        slug: body.slug,
        payload: body.payload,
        calendarAt: body.calendar_at || null,
        respondentLabel: body.respondent_label || null,
        source: staffId ? 'staff' : 'public',
        authToken: token,
      })
      if (result.error) return json(res, result.status || 400, { error: result.error })
      return json(res, 200, {
        ok: true,
        id: result.submission?.id || null,
        formKind: result.formKind,
        booking: result.booking,
      })
    }

    if (kind === 'tint_finder') {
      const db = getDb()
      const { data: settings, error: configError } = await db.from('tint_finder_settings').select('config').eq('id', 1).single()
      if (configError || validateTintConfig(settings?.config)) return json(res, 503, { error: 'Tint booking is temporarily unavailable. Please message the branch.' })
      const { row, error: invalid } = buildTintLead(body, settings.config)
      if (invalid) return json(res, 400, { error: invalid })
      const { data: branch, error: branchError } = await db.from('branches').select('slug').eq('slug', row.branch).eq('is_public', true).eq('is_active', true).eq('is_archived', false).eq('coming_soon', false).maybeSingle()
      if (branchError || !branch) return json(res, 400, { error: 'Choose an available branch.' })
      const { data: saved, error } = await db.from('tint_finder_leads').insert(row).select('id').single()
      if (error) return json(res, 500, { error: 'We could not send your request. Please try again.' })
      try {
        await notifyStaffEvent(db, 'inquiry', { id: saved.id, kind: 'tint_finder', name: row.name, branch: row.branch }, { roles: ['super_admin'], urls: ['/operations/settings/tint-finder'] })
      } catch { /* Saved to the Tint Finder staff inbox; push is best effort. */ }
      return json(res, 200, { ok: true })
    }

    const { table, row, error: invalid } = build(body)
    if (invalid) return json(res, 400, { error: invalid })

    const db = getDb()
    const { data: saved, error } = await db.from(table).insert(row).select('id').single()
    if (error) return json(res, 500, { error: 'We could not send that just now. Please try again.' })

    if (kind === 'partnership' || kind === 'complaint') {
      try {
        await notifyStaffEvent(db, 'inquiry', { id: saved.id, kind, name: row.name || row.customer_name, category: row.category, branch: row.branch, city: row.city })
      } catch {
        /* ponytail: submission is saved; staff alert is best-effort */
      }
    }

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
