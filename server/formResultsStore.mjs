/**
 * Form Results Board store & Owner mutation controller + Detailing Bookings sync.
 * Extracted from `server/provisionStaff.mjs` to isolate planning/form results state,
 * Owner-only enforcement, and linked `public.bookings` synchronization.
 */
import { canViewPlanning, getBranchScopeList } from '../src/auth/permissions.js'
import { bookingStatusToSubmissionStatus, VALID_DETAILING_BOARD_STATUSES } from '../src/lib/formResults.js'
import { filterSubmissionsByBranchScope } from '../src/lib/opsForms.js'
import { notifyBookingStatus } from './notifyBooking.mjs'

const SUPER = 'BossMich'
const VALID_SUBMISSION_STATUSES = new Set(['new', 'in_review', 'resolved', 'archived'])
const TERMINAL_BOOKING_STATUSES = new Set(['completed', 'cancelled', 'no_show'])

export async function assertFormResultsCaller(admin, accessToken, { ownerOnly = false } = {}) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff, error } = await admin
    .from('staff_profiles')
    .select('id, role, full_name, branch_slug, is_active, permission_grants')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!staff) throw Object.assign(new Error('Forbidden'), { status: 403 })
  if (ownerOnly) {
    if (staff.role !== SUPER) {
      throw Object.assign(new Error('Only Owner may edit or delete form responses.'), { status: 403 })
    }
    return { user: userData.user, staff }
  }
  const { data: assigns } = await admin
    .from('staff_branch_assignments')
    .select('branch_slug')
    .eq('staff_id', staff.id)
  const hydratedStaff = {
    ...staff,
    branch_slugs: (assigns || []).map((row) => row.branch_slug).filter(Boolean),
  }
  if (!canViewPlanning(hydratedStaff)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  return { user: userData.user, staff: hydratedStaff }
}

export function parseOptionalIsoDate(value, label) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error(`Invalid ${label} date.`), { status: 400 })
  }
  return parsed.toISOString()
}

async function selectSubmissionWithOptionalBookingId(admin, id) {
  let res = await admin
    .from('ops_form_submissions')
    .select('id, form_id, booking_id, status, payload, ops_forms ( id, kind )')
    .eq('id', id)
    .maybeSingle()
  if (res.error && /booking_id/i.test(String(res.error.message || ''))) {
    res = await admin
      .from('ops_form_submissions')
      .select('id, form_id, status, payload, ops_forms ( id, kind )')
      .eq('id', id)
      .maybeSingle()
  }
  return res
}

function buildBookingSyncPatch({ booking, nextStatus, payloadPatch, nextCalendarAt, nextRespondentLabel }) {
  if (!booking) return null
  const bookingPatch = {}
  let statusChangedTo = null

  if (nextStatus && booking.status !== nextStatus) {
    if (nextStatus === 'for_payment') {
      throw Object.assign(
        new Error('Move Final checking to For payment from Detailing Schedule / POS payment handoff.'),
        { status: 400 },
      )
    }
    bookingPatch.status = nextStatus
    statusChangedTo = nextStatus
    if (nextStatus === 'completed') bookingPatch.completed_at = new Date().toISOString()
  }

  // Only sync contact / plate / schedule edits while booking is still active (never mutate completed/cancelled books)
  if (!TERMINAL_BOOKING_STATUSES.has(String(booking.status || ''))) {
    const editedName = String(
      payloadPatch?.customer_name || payloadPatch?.name || nextRespondentLabel || '',
    ).trim()
    if (editedName && editedName !== booking.customer_name) {
      bookingPatch.customer_name = editedName
    }
    const editedPhone = String(payloadPatch?.phone || payloadPatch?.customer_phone || payloadPatch?.mobile || '').trim()
    if (editedPhone && editedPhone !== booking.customer_phone) {
      bookingPatch.customer_phone = editedPhone
    }
    const editedPlate = String(payloadPatch?.plate || payloadPatch?.vehicle_plate || '').trim().toUpperCase()
    if (editedPlate && editedPlate !== booking.vehicle_plate) {
      bookingPatch.vehicle_plate = editedPlate
    }
    if (nextCalendarAt && nextCalendarAt !== booking.scheduled_start) {
      bookingPatch.scheduled_start = nextCalendarAt
    }
  }

  return Object.keys(bookingPatch).length ? { bookingPatch, statusChangedTo } : null
}

export async function handleFormResultsAction({
  admin,
  accessToken,
  action,
  body,
  notifyBooking = notifyBookingStatus,
}) {
  if (action === 'list-form-results') {
    const { staff } = await assertFormResultsCaller(admin, accessToken, { ownerOnly: false })
    const scopeList = getBranchScopeList(staff)
    const [formsRes, eventsRes] = await Promise.all([
      admin
        .from('ops_forms')
        .select('id, name, kind, fields, is_active, slug, description, status, public_enabled, event_id, settings, created_at, updated_at')
        .neq('status', 'archived')
        .neq('kind', 'event')
        .order('created_at', { ascending: true }),
      admin
        .from('events')
        .select('id, title, slug, branch, starts_at, ends_at, is_published, form_id')
        .order('starts_at', { ascending: false })
        .limit(250),
    ])

    let subsRes = await admin
      .from('ops_form_submissions')
      .select('id, form_id, booking_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at, ops_forms ( id, name, kind, slug, event_id )')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (subsRes.error && /booking_id/i.test(String(subsRes.error.message || ''))) {
      subsRes = await admin
        .from('ops_form_submissions')
        .select('id, form_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at, ops_forms ( id, name, kind, slug, event_id )')
        .order('created_at', { ascending: false })
        .limit(1000)
    }

    for (const r of [formsRes, subsRes, eventsRes]) {
      if (r.error) throw Object.assign(new Error(r.error.message), { status: 400 })
    }

    const activeSubs = (subsRes.data || []).filter((row) => row?.ops_forms?.kind !== 'event')
    const scopedSubs = filterSubmissionsByBranchScope(activeSubs, { branchFilter: 'all', scopeList })
    const bookingIds = [
      ...new Set(
        scopedSubs
          .filter((row) => row?.ops_forms?.kind === 'detailing')
          .map((row) => row.booking_id || row.payload?.booking_id)
          .filter(Boolean),
      ),
    ]

    const bookingsById = new Map()
    if (bookingIds.length) {
      const { data: bookingRows, error: bErr } = await admin
        .from('bookings')
        .select('id, status, branch, scheduled_start, vehicle_plate, service_id, price_minor, final_price_minor, is_archived, services ( name )')
        .in('id', bookingIds)
      if (bErr) throw Object.assign(new Error(bErr.message), { status: 400 })
      for (const b of bookingRows || []) bookingsById.set(b.id, b)
    }

    const enrichedSubs = scopedSubs.map((row) => {
      const bookingId = row.booking_id || row.payload?.booking_id || null
      const linkedBooking = bookingId ? bookingsById.get(bookingId) || null : null
      return {
        ...row,
        booking_id: bookingId,
        booking_status:
          row?.ops_forms?.kind === 'detailing'
            ? linkedBooking?.status || row.payload?.booking_status || 'pending'
            : null,
        linked_booking: linkedBooking,
      }
    })

    return {
      forms: formsRes.data || [],
      events: eventsRes.data || [],
      submissions: enrichedSubs,
    }
  }

  if (action === 'update-form-submission') {
    await assertFormResultsCaller(admin, accessToken, { ownerOnly: true })
    const id = String(body?.id || '').trim()
    if (!id) throw Object.assign(new Error('Submission id is required.'), { status: 400 })

    const existingRes = await selectSubmissionWithOptionalBookingId(admin, id)
    if (existingRes.error) throw Object.assign(new Error(existingRes.error.message), { status: 400 })
    const existing = existingRes.data
    if (!existing) throw Object.assign(new Error('Submission not found.'), { status: 404 })

    const isDetailing = existing.ops_forms?.kind === 'detailing'
    const currentPayload = existing.payload && typeof existing.payload === 'object' ? existing.payload : {}
    const linkedBookingId = existing.booking_id || currentPayload.booking_id || null

    const patch = {}
    if (body.payload !== undefined) {
      if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
        throw Object.assign(new Error('Submission answers must be an object.'), { status: 400 })
      }
      patch.payload = { ...body.payload }
    }
    if (body.respondent_label !== undefined) {
      patch.respondent_label = String(body.respondent_label || '').trim() || null
    }
    if (body.calendar_at !== undefined) {
      patch.calendar_at = parseOptionalIsoDate(body.calendar_at, 'calendar')
    }
    if (body.due_at !== undefined) {
      patch.due_at = parseOptionalIsoDate(body.due_at, 'due')
    }

    let nextDetailingStatus = null
    if (body.status !== undefined) {
      const nextStatus = String(body.status || '').trim()
      if (isDetailing) {
        if (!VALID_DETAILING_BOARD_STATUSES.includes(nextStatus)) {
          throw Object.assign(new Error('Invalid detailing status.'), { status: 400 })
        }
        nextDetailingStatus = nextStatus
        patch.status = bookingStatusToSubmissionStatus(nextStatus)
        patch.payload = {
          ...currentPayload,
          ...(patch.payload || {}),
          booking_status: nextStatus,
          ...(linkedBookingId ? { booking_id: linkedBookingId } : {}),
        }
      } else {
        if (!VALID_SUBMISSION_STATUSES.has(nextStatus)) {
          throw Object.assign(new Error('Invalid submission status.'), { status: 400 })
        }
        patch.status = nextStatus
      }
    } else if (isDetailing && patch.payload && linkedBookingId) {
      patch.payload = {
        ...patch.payload,
        booking_id: linkedBookingId,
        booking_status: currentPayload.booking_status || 'pending',
      }
    }

    if (isDetailing && linkedBookingId) {
      const { data: booking, error: bLoadErr } = await admin
        .from('bookings')
        .select('*')
        .eq('id', linkedBookingId)
        .maybeSingle()
      if (bLoadErr) throw Object.assign(new Error(bLoadErr.message), { status: 400 })

      const syncPlan = buildBookingSyncPatch({
        booking,
        nextStatus: nextDetailingStatus,
        payloadPatch: patch.payload,
        nextCalendarAt: patch.calendar_at,
        nextRespondentLabel: patch.respondent_label,
      })
      if (syncPlan) {
        const { data: updatedBooking, error: bUpdErr } = await admin
          .from('bookings')
          .update(syncPlan.bookingPatch)
          .eq('id', linkedBookingId)
          .select('*')
          .single()
        if (bUpdErr) throw Object.assign(new Error(bUpdErr.message), { status: 400 })
        if (syncPlan.statusChangedTo) {
          try {
            await notifyBooking(updatedBooking, syncPlan.statusChangedTo)
          } catch {
            /* booking update succeeded; notification is best-effort */
          }
        }
      }
    }

    if (!Object.keys(patch).length) {
      throw Object.assign(new Error('Nothing to update.'), { status: 400 })
    }

    const { data, error } = await admin
      .from('ops_form_submissions')
      .update(patch)
      .eq('id', id)
      .select('id, form_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at')
      .maybeSingle()
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    if (!data) throw Object.assign(new Error('Submission not found.'), { status: 404 })
    return { data }
  }

  if (action === 'delete-form-submission') {
    await assertFormResultsCaller(admin, accessToken, { ownerOnly: true })
    const id = String(body?.id || '').trim()
    if (!id) throw Object.assign(new Error('Submission id is required.'), { status: 400 })

    // If a detailing submission created an untouched Booking Placeholder ('pending'),
    // soft-cancel & archive that placeholder instead of hard-deleting bookings or leaving an orphan.
    const existingRes = await selectSubmissionWithOptionalBookingId(admin, id)
    if (!existingRes.error && existingRes.data?.ops_forms?.kind === 'detailing') {
      const sub = existingRes.data
      const linkedBookingId = sub.booking_id || sub.payload?.booking_id || null
      if (linkedBookingId) {
        const { data: booking } = await admin
          .from('bookings')
          .select('id, status, is_archived')
          .eq('id', linkedBookingId)
          .maybeSingle()
        if (booking && booking.status === 'pending' && booking.is_archived !== true) {
          await admin
            .from('bookings')
            .update({ status: 'cancelled', is_archived: true })
            .eq('id', linkedBookingId)
        }
      }
    }

    const { error } = await admin.from('ops_form_submissions').delete().eq('id', id)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return { ok: true }
  }

  if (action === 'update-event-registration' || action === 'delete-event-registration') {
    throw Object.assign(new Error('Event RSVP registration has been retired.'), { status: 410 })
  }

  return null
}
