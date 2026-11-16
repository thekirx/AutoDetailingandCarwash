/**
 * Public / Staff smart ops form submission + Detailing Services -> Booking Placeholder sync.
 *
 * When a `detailing` ops form is submitted (`/f/detailing-inquiry` or Planning Forms),
 * the submission immediately creates a linked `public.bookings` row in `status: 'pending'`
 * ("Booking Placeholder" — the first lane of the Detailing Schedule pipeline) and notifies
 * staff / customer via `notifyBookingStatus`.
 */
import {
  extractCalendarAt,
  extractSubmissionBranch,
  filterFormBranchSlugs,
  normalizeFields,
  validatePayload,
} from '../src/lib/opsForms.js'
import { isBookingBoardService } from '../src/lib/serviceKinds.js'
import {
  computeServiceSizePricing,
  insertBookingPlaceholderAndNotify,
  resolveOptionalCustomerId,
} from './detailingBookingIntake.mjs'
import { notifyBookingStatus } from './notifyBooking.mjs'
import { notifyOpsFormComplaint } from './notifyOpsForm.mjs'

const SERVICE_HINTS = [
  {
    queryRe: /ppf|paint\s*protection|protection\s*film/i,
    matchSvc: (s) =>
      s.pay_category === 'ppf' ||
      /ppf|paint-protection|protection-film/i.test(`${s.slug || ''} ${s.name || ''}`),
  },
  {
    queryRe: /tint|window\s*film/i,
    matchSvc: (s) => /tint/i.test(`${s.slug || ''} ${s.name || ''}`),
  },
  {
    queryRe: /maintenance/i,
    matchSvc: (s) => /maintenance/i.test(`${s.slug || ''} ${s.name || ''}`),
  },
  {
    queryRe: /ceramic/i,
    matchSvc: (s) =>
      /ceramic/i.test(`${s.slug || ''} ${s.name || ''}`) &&
      !/tint|maintenance/i.test(`${s.slug || ''} ${s.name || ''}`),
  },
]

export function matchDetailingServiceRow(services = [], rawServiceLabel = '') {
  const active = (services || []).filter(
    (s) => s && s.is_active !== false && s.is_archived !== true && isBookingBoardService(s),
  )
  if (!active.length) return null

  const clean = String(rawServiceLabel || '').trim().toLowerCase()
  if (clean) {
    const exact = active.find(
      (s) => String(s.name || '').trim().toLowerCase() === clean || String(s.slug || '').trim().toLowerCase() === clean,
    )
    if (exact) return exact

    for (const hint of SERVICE_HINTS) {
      if (hint.queryRe.test(clean)) {
        const hit = active.find(hint.matchSvc)
        if (hit) return hit
      }
    }

    const fuzzy = active.find((s) => String(s.name || '').toLowerCase().includes(clean))
    if (fuzzy) return fuzzy
  }

  return active[0]
}

export function resolveDetailingBranchSlug(branches = [], rawBranch = '') {
  const openSlugs = filterFormBranchSlugs(branches)
  const clean = String(rawBranch || '').trim().toLowerCase()
  if (clean) {
    if (openSlugs.includes(clean)) return clean
    const openRows = (branches || []).filter((b) => openSlugs.includes(String(b?.slug || '').trim().toLowerCase()))
    // 1. Exact full or stripped display name match
    const exactName = openRows.find((b) => {
      const full = String(b?.name || '').trim().toLowerCase()
      const short = full.replace(/^hakum\s+auto\s+care\s+/i, '').trim()
      return full === clean || short === clean
    })
    if (exactName) return String(exactName.slug).trim().toLowerCase()
    // 2. Unambiguous single partial match
    const partialMatches = openRows.filter((b) => String(b?.name || '').trim().toLowerCase().includes(clean))
    if (partialMatches.length === 1) return String(partialMatches[0].slug).trim().toLowerCase()
    return null
  }
  return openSlugs[0] || null
}

export function computeDetailingScheduledStart(rawValue, nowMs = Date.now()) {
  const str = String(rawValue || '').trim()
  if (str) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parsed = new Date(`${str}T09:00:00+08:00`)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    } else {
      const parsed = new Date(str)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }
  // Default detailing lead placeholder: +2 days at 09:00 Asia/Manila
  const future = new Date(nowMs + 2 * 24 * 60 * 60 * 1000)
  const phDate = future.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  return new Date(`${phDate}T09:00:00+08:00`).toISOString()
}

async function linkSubmissionToBooking(db, submissionId, nextPayload, bookingId) {
  if (!submissionId || !bookingId) return
  const payloadWithLink = {
    ...(nextPayload && typeof nextPayload === 'object' ? nextPayload : {}),
    booking_id: bookingId,
    booking_status: 'pending',
  }
  const { error } = await db
    .from('ops_form_submissions')
    .update({ booking_id: bookingId, payload: payloadWithLink })
    .eq('id', submissionId)
  // Graceful fallback if ops_form_submissions.booking_id migration has not run yet
  if (error && /booking_id/i.test(String(error.message || ''))) {
    await db.from('ops_form_submissions').update({ payload: payloadWithLink }).eq('id', submissionId)
  }
}

export async function syncDetailingSubmissionToBooking({
  db,
  submission,
  payload = {},
  calendarAt = null,
  respondentLabel = null,
  authToken = null,
  notifyBooking = notifyBookingStatus,
}) {
  const [{ data: branchRows, error: branchErr }, { data: serviceRows, error: svcErr }, customerId] = await Promise.all([
    db.from('branches').select('slug, name, is_public, is_active, is_archived, coming_soon'),
    db
      .from('services')
      .select('id, name, slug, pay_category, price_minor, is_active, is_archived, parent_service_id, service_size_prices(size_slug, price_minor)')
      .eq('is_active', true)
      .eq('is_archived', false),
    resolveOptionalCustomerId(db, authToken),
  ])

  if (branchErr) throw Object.assign(new Error(branchErr.message), { status: 500 })
  if (svcErr) throw Object.assign(new Error(svcErr.message), { status: 500 })

  const requestedBranch = String(payload.branch || payload.preferred_branch || payload.branch_slug || '').trim()
  const branch = resolveDetailingBranchSlug(branchRows || [], requestedBranch)
  if (!branch) {
    throw Object.assign(new Error('Choose an available branch.'), { status: 400 })
  }

  const svc = matchDetailingServiceRow(
    serviceRows || [],
    payload.service || payload.detailing_service || payload.service_name || '',
  )
  if (!svc) {
    throw Object.assign(new Error('Detailing services are not configured yet.'), { status: 503 })
  }

  const customer_name =
    String(payload.customer_name || payload.name || payload.full_name || respondentLabel || 'Customer').trim() ||
    'Customer'
  const customer_phone = String(payload.phone || payload.customer_phone || payload.mobile || '').trim() || 'Pending'
  const vehicle_plate = String(payload.plate || payload.vehicle_plate || 'PENDING').trim().toUpperCase() || 'PENDING'
  const vehicle_make = String(payload.vehicle_make || payload.make || '').trim() || 'TBD'
  const vehicle_model = String(payload.vehicle_model || payload.model || payload.car_model || '').trim() || 'Pending'

  const { pricingSlug, priceMinor: priced } = computeServiceSizePricing({
    service: svc,
    vehicleType: payload.vehicle_type,
    vehicleMake: payload.vehicle_make,
    vehicleModel: payload.vehicle_model,
  })
  const scheduled_start = computeDetailingScheduledStart(
    payload.preferred_date || payload.schedule || payload.scheduled_start || calendarAt,
  )

  const insertRow = {
    customer_name,
    customer_phone,
    customer_id: customerId,
    vehicle_plate,
    vehicle_make,
    vehicle_model,
    vehicle_type: pricingSlug,
    service_id: svc.id,
    branch,
    scheduled_start,
    status: 'pending',
    is_archived: false,
    price_minor: priced,
    final_price_minor: priced,
  }

  const { booking, notify } = await insertBookingPlaceholderAndNotify({
    db,
    insertRow,
    customerId,
    notifyBooking,
  })

  await linkSubmissionToBooking(db, submission?.id, payload, booking.id)

  return { booking, notify }
}

export async function submitPublicOpsFormAndSync({
  db,
  slug,
  payload,
  calendarAt = null,
  respondentLabel = null,
  source = 'public',
  authToken = null,
  notifyComplaint = notifyOpsFormComplaint,
  notifyBooking = notifyBookingStatus,
}) {
  const cleanSlug = String(slug || '').trim().toLowerCase()
  if (!cleanSlug) return { status: 400, error: 'Form slug is required.' }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 400, error: 'Form answers must be an object.' }
  }

  const { data: formRow, error: formErr } = await db
    .from('ops_forms')
    .select('id, name, kind, slug, fields, public_enabled, is_active, status')
    .eq('slug', cleanSlug)
    .maybeSingle()

  if (formErr) return { status: 500, error: 'Could not look up that form just now.' }
  if (!formRow) return { status: 404, error: 'This form is closed or not found.' }
  if (formRow.kind === 'event') {
    return { status: 410, error: 'Events RSVP has been retired.' }
  }
  if (source !== 'staff' && (!formRow.public_enabled || !formRow.is_active || formRow.status !== 'published')) {
    return { status: 404, error: 'This form is closed or not found.' }
  }

  const cleanLabel =
    String(
      respondentLabel ||
        payload.customer_name ||
        payload.name ||
        payload.full_name ||
        payload.employee_name ||
        '',
    ).trim() || null

  let submission = null
  if (source === 'staff') {
    const normalizedFields = normalizeFields(formRow.fields || [])
    const validationErrs = validatePayload(normalizedFields, payload)
    if (validationErrs[0]) return { status: 400, error: validationErrs[0] }
    const resolvedCal = calendarAt || extractCalendarAt(normalizedFields, payload) || null
    const { data: inserted, error: insertErr } = await db
      .from('ops_form_submissions')
      .insert({
        form_id: formRow.id,
        payload,
        due_at: resolvedCal,
        calendar_at: resolvedCal,
        respondent_label: cleanLabel,
        source: 'staff',
        status: 'new',
      })
      .select('id, calendar_at, form_id')
      .single()
    if (insertErr) return { status: 400, error: insertErr.message || 'Could not save form response.' }
    submission = inserted
  } else {
    const { data: rpcSubmission, error: rpcErr } = await db.rpc('submit_public_ops_form', {
      p_slug: cleanSlug,
      p_payload: payload,
      p_calendar_at: calendarAt || null,
      p_respondent_label: cleanLabel,
    })
    if (rpcErr) {
      return { status: 400, error: rpcErr.message || 'Could not save form response.' }
    }
    submission = rpcSubmission
  }

  let booking = null
  if (formRow.kind === 'detailing') {
    try {
      const synced = await syncDetailingSubmissionToBooking({
        db,
        submission,
        payload,
        calendarAt,
        respondentLabel: cleanLabel,
        authToken,
        notifyBooking,
      })
      booking = synced.booking
    } catch (syncErr) {
      if (submission?.id) {
        await db.from('ops_form_submissions').delete().eq('id', submission.id)
      }
      return {
        status: syncErr?.status || 400,
        error: syncErr?.message || 'Could not schedule detailing request.',
      }
    }
  } else if (formRow.kind === 'complaint') {
    try {
      await notifyComplaint({
        formName: formRow.name,
        formSlug: cleanSlug,
        payload,
        submissionId: submission?.id || null,
        branch: extractSubmissionBranch({ payload }),
      })
    } catch {
      /* complaint submission is saved; staff alert is best-effort */
    }
  }

  return {
    status: 200,
    formKind: formRow.kind,
    submission,
    booking: booking
      ? {
          id: booking.id,
          status: booking.status,
          branch: booking.branch,
          scheduled_start: booking.scheduled_start,
        }
      : null,
  }
}
