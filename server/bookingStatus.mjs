import { createClient } from '@supabase/supabase-js'
import { notifyBookingPhotosReady, notifyBookingStatus } from './notifyBooking.mjs'
import { canStaffUpdateBookingStatus } from './bookingStatusAccess.mjs'
import { canEnterPaymentHandoff, isPaymentHandoffStatus } from './queuePaymentHandoff.mjs'
import {
  assertDetailingCompletionOutcome,
  buildExperiencePlanCardPayload,
  EXPERIENCE_LIST_TITLE,
  shouldCreateExperiencePlanCard,
} from '../src/lib/detailingCompletion.js'
import { nextPlanCardPosition, nextPlanListPosition } from '../src/lib/plannerBoard.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function userClient(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or anon key')
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

const ALLOWED = new Set(['admin', 'BossMich', 'marketing', 'sales', 'team_lead', 'assistant_super_admin', 'operations_lead'])

async function ensureExperienceListId(db) {
  let { data: board } = await db.from('plan_boards').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!board?.id) {
    const { data: created, error } = await db.from('plan_boards').insert({ name: 'Hakum Planning' }).select('id').single()
    if (error) throw error
    board = created
  }
  const { data: lists } = await db.from('plan_lists').select('id, title, position').eq('board_id', board.id)
  const existing = (lists || []).find((l) => l.title === EXPERIENCE_LIST_TITLE)
  if (existing) return existing.id
  const { data: row, error: listErr } = await db
    .from('plan_lists')
    .insert({
      board_id: board.id,
      title: EXPERIENCE_LIST_TITLE,
      position: nextPlanListPosition(lists || []),
    })
    .select('id')
    .single()
  if (listErr) throw listErr
  return row.id
}

async function insertExperienceInvestigation(db, booking, outcome, createdBy) {
  const listId = await ensureExperienceListId(db)
  const { data: cards } = await db.from('plan_cards').select('position').eq('list_id', listId)
  const position = nextPlanCardPosition([{ id: listId, plan_cards: cards || [] }], listId)
  const payload = buildExperiencePlanCardPayload({
    booking,
    outcome,
    listId,
    position,
    createdBy,
  })
  const { data: card, error } = await db.from('plan_cards').insert(payload).select('id').single()
  if (error) throw error

  const { data: assignees } = await db
    .from('staff_profiles')
    .select('id')
    .in('role', ['operations_lead', 'BossMich', 'assistant_super_admin'])
    .eq('is_active', true)
    .limit(12)

  const ids = [...new Set((assignees || []).map((r) => r.id).filter(Boolean))]
  if (ids.length) {
    await db.from('plan_card_assignees').insert(
      ids.map((staff_id) => ({
        card_id: card.id,
        staff_id,
        assigned_by: createdBy || null,
        status: 'todo',
      })),
    )
  }
  return card
}

/**
 * Ops updates booking status + triggers BusyBee SMS / push.
 * Body: { booking_id, status, completion_outcome?, notify_photos?, branch?, cancellation_reason? }
 * for_payment always goes through send_queue_ticket_to_payment (creates pos_handoffs).
 */
export async function handleBookingStatusRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })

    const db = admin()
    const { data: userData, error: userErr } = await db.auth.getUser(token)
    if (userErr || !userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active, branch_slug, permission_grants')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

    let branch_slugs = staff.branch_slug ? [staff.branch_slug] : []
    if (staff.role === 'admin') {
      const { data: assigns } = await db
        .from('staff_branch_assignments')
        .select('branch_slug')
        .eq('staff_id', staff.id)
      if (assigns?.length) branch_slugs = assigns.map((a) => a.branch_slug).filter(Boolean)
    }

    const body = await readJsonBody(req)
    const bookingId = body.booking_id
    const status = String(body.status || '').trim()
    if (!bookingId || !status) return json(res, 400, { error: 'booking_id and status required' })

    const { data: existing, error: loadErr } = await db
      .from('bookings')
      .select('id, branch, status, customer_name, customer_phone, customer_id, vehicle_plate, service_id, services(name, slug, pay_category)')
      .eq('id', bookingId)
      .maybeSingle()
    if (loadErr) return json(res, 400, { error: loadErr.message })
    if (!existing) return json(res, 404, { error: 'Booking not found' })

    if (
      !canStaffUpdateBookingStatus(
        { ...staff, branch_slugs, permission_grants: staff.permission_grants },
        existing,
        { nextStatus: status },
      )
    ) {
      return json(res, 403, { error: 'Not allowed to update this booking' })
    }

    // for_payment must create a POS handoff — never bare-update status
    if (isPaymentHandoffStatus(status)) {
      if (!canEnterPaymentHandoff(existing.status)) {
        return json(res, 400, {
          error: 'Move the ticket to In Progress or Final Checking before sending to payment',
        })
      }

      if (existing.status === 'in_progress') {
        const now = new Date().toISOString()
        const { error: checkErr } = await db
          .from('bookings')
          .update({
            status: 'final_checking',
            final_checking_at: now,
            final_checked_by: staff.id,
            updated_at: now,
          })
          .eq('id', bookingId)
        if (checkErr) return json(res, 400, { error: checkErr.message })
      }

      const asUser = userClient(token)
      const { data: handoff, error: handoffErr } = await asUser.rpc('send_queue_ticket_to_payment', {
        input_booking_id: bookingId,
      })
      if (handoffErr) return json(res, 400, { error: handoffErr.message })

      const { data: booking, error: reloadErr } = await db
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()
      if (reloadErr) return json(res, 400, { error: reloadErr.message })

      let notify = null
      try {
        notify = await notifyBookingStatus(booking, 'for_payment')
      } catch (err) {
        notify = { error: String(err.message || err) }
      }

      return json(res, 200, {
        ok: true,
        booking: { id: booking.id, status: booking.status },
        handoff,
        notify,
      })
    }

    if (status === 'cancelled') {
      const reason = String(body.cancellation_reason || body.reason || '').trim()
      if (reason.length < 3) {
        return json(res, 400, { error: 'Cancel reason must be at least 3 characters.' })
      }
    }

    const outcomeGate = assertDetailingCompletionOutcome(existing, body.completion_outcome, {
      nextStatus: status,
    })
    if (!outcomeGate.ok) return json(res, 400, { error: outcomeGate.error })

    const now = new Date().toISOString()
    const patch = {
      status,
      updated_at: now,
      ...(status === 'cancelled'
        ? {
            cancelled_at: now,
            cancellation_reason: String(body.cancellation_reason || body.reason || '').trim(),
          }
        : {}),
      ...(status === 'waiting' ? { waiting_at: now } : {}),
      ...(status === 'completed'
        ? {
            completed_at: now,
            ...(outcomeGate.outcome ? { completion_outcome: outcomeGate.outcome } : {}),
          }
        : {}),
    }

    // Sales / SA / ASA may re-assign branch when moving to Assigned to Branch (confirmed).
    const nextBranch = body.branch != null ? String(body.branch).trim() : ''
    if (nextBranch && nextBranch !== existing.branch) {
      const canAssignBranch =
        staff.role === 'sales' ||
        staff.role === 'BossMich' ||
        staff.role === 'assistant_super_admin'
      if (!canAssignBranch) {
        return json(res, 403, { error: 'Only Sales or Super Admin can assign a branch.' })
      }
      const { data: branchRow } = await db
        .from('branches')
        .select('slug, is_active, coming_soon, is_archived')
        .eq('slug', nextBranch)
        .maybeSingle()
      if (!branchRow || branchRow.is_archived || branchRow.is_active === false) {
        return json(res, 400, { error: 'Branch is not available.' })
      }
      if (branchRow.coming_soon) {
        return json(res, 400, { error: 'This branch is coming soon.' })
      }
      patch.branch = nextBranch
    }

    const { data: booking, error } = await db
      .from('bookings')
      .update(patch)
      .eq('id', bookingId)
      .select('*, services(name, slug, pay_category)')
      .single()
    if (error) return json(res, 400, { error: error.message })

    let experienceCard = null
    if (status === 'completed' && shouldCreateExperiencePlanCard(outcomeGate.outcome)) {
      try {
        experienceCard = await insertExperienceInvestigation(db, booking, outcomeGate.outcome, staff.id)
      } catch (err) {
        experienceCard = { error: String(err.message || err) }
      }
    }

    let notify = null
    try {
      notify = await notifyBookingStatus(booking, status)
    } catch (err) {
      notify = { error: String(err.message || err) }
    }

    let photosNotify = null
    if (body.notify_photos) {
      try {
        photosNotify = await notifyBookingPhotosReady(booking)
      } catch (err) {
        photosNotify = { error: String(err.message || err) }
      }
    }

    return json(res, 200, {
      ok: true,
      booking: {
        id: booking.id,
        status: booking.status,
        branch: booking.branch,
        completion_outcome: booking.completion_outcome || null,
      },
      experienceCard,
      notify,
      photosNotify,
    })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
