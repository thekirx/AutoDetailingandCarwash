/**
 * Daily-ops events the client can't target itself: the server loads the record, checks the caller,
 * and derives recipients (assigned crew, payees, requester, SA/ASA finance) from the DB.
 */
import { canAccessPos, canEditQueueOperations, canRunPayroll } from '../src/auth/permissions.js'
import { NOTIFY_EVENTS, branchLabel } from '../src/lib/notifyRouting.js'
import { hydrateBookingForNotify } from './notifyBooking.mjs'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'

export const OPS_EVENTS = ['crew_assigned', 'shift_submitted', 'payroll_confirmed', 'cash_advance_submitted', 'cash_advance_resolved']

/** Replayed calls for old records are ignored. */
const FRESH_MS = 10 * 60_000
const fresh = (iso) => Boolean(iso) && Date.now() - Date.parse(iso) < FRESH_MS
const pesos = (minor) => `₱${Math.round((Number(minor) || 0) / 100).toLocaleString('en-PH')}`

export function buildOpsEventCopy(event, c = {}) {
  switch (event) {
    case 'crew_assigned':
      return {
        kind: 'crew_assigned',
        title: 'New car assigned',
        body: `${c.queueNumber ? `Q${c.queueNumber} · ` : ''}${c.plate || 'Vehicle'} · ${c.service || 'service'} @ ${c.branchName || 'Hakum'}`,
        tag: `crew-${c.bookingId}`,
      }
    case 'shift_submitted':
      return {
        kind: 'shift_submitted',
        title: `End of shift to review · ${c.branchName || 'branch'}`,
        body: `${c.submitter || 'Branch admin'} submitted ${c.businessDate || 'today'}. Review and accept in Finance.`,
        tag: `shift-submitted-${c.closeId}`,
      }
    case 'shift_accepted':
      return {
        kind: 'shift_accepted',
        title: `End of shift accepted · ${c.branchName || 'branch'}`,
        body: `Finance accepted your close for ${c.businessDate || 'today'}.`,
        tag: `shift-accepted-${c.closeId}`,
      }
    case 'shift_rejected':
      return {
        kind: 'shift_rejected',
        title: `End of shift sent back · ${c.branchName || 'branch'}`,
        body: `Finance: ${c.note || 'please review and resubmit'} (${c.businessDate || 'today'}).`,
        tag: `shift-rejected-${c.closeId}`,
      }
    case 'payroll_confirmed':
      return {
        kind: 'payroll_confirmed',
        title: 'Pay posted',
        body: `${c.runKind === 'fixed' ? 'Salary' : 'Floor pay'} · ${c.periodStart || ''} to ${c.periodEnd || ''}. Tap to see your payslip.`,
        tag: `payroll-${c.runId}`,
      }
    case 'cash_advance_submitted':
      return {
        kind: 'cash_advance_submitted',
        title: 'Cash advance request',
        body: `${c.employee || 'Employee'} · ${pesos(c.amountMinor)} @ ${c.branchName || 'branch'}`,
        tag: `ca-req-${c.submissionId}`,
      }
    case 'cash_advance_resolved':
      return {
        kind: 'cash_advance_resolved',
        title: c.approved ? 'Cash advance approved' : 'Cash advance declined',
        body: `${pesos(c.amountMinor)} · ${c.approved ? 'Approved — it will be deducted from payroll.' : 'Declined by finance.'}`,
        tag: `ca-done-${c.submissionId}`,
      }
    case 'inquiry':
      return {
        kind: 'inquiry',
        title: c.kind === 'complaint' ? 'New customer complaint' : 'New partnership inquiry',
        body: c.kind === 'complaint'
          ? `${c.name || 'Customer'} · ${c.category || 'complaint'}${c.branch ? ` @ ${c.branch}` : ''}`
          : `${c.name || 'Someone'} · ${c.city || 'site'}`,
        tag: `inquiry-${c.id}`,
      }
    case 'review': {
      const note = String(c.comment || '').trim()
      return {
        kind: 'review',
        title: `New review · ${c.rating}★`,
        body: `${c.name || 'Customer'} @ ${c.branchName || 'Hakum'}${note ? ` — "${note.length > 80 ? `${note.slice(0, 80)}…` : note}"` : ''}`,
        tag: `review-${c.id}`,
      }
    }
    default:
      return null
  }
}

/** Server-side events (inquiry, review, shift_accepted): rule from NOTIFY_EVENTS plus branch / ids / excludeId. */
export async function notifyStaffEvent(db, event, ctx, extra = {}) {
  const copy = buildOpsEventCopy(event, ctx)
  const recipients = await resolveStaffRecipients(db, { ...NOTIFY_EVENTS[event], ...extra })
  return notifyRecipients(db, recipients, copy)
}

export async function branchName(db, slug) {
  if (!slug) return null
  const { data } = await db.from('branches').select('name').eq('slug', slug).maybeSingle()
  return branchLabel(data?.name, slug)
}

const deny = { status: 403, error: 'Forbidden' }
const gone = { status: 404, error: 'Not found' }

/** Each loader: caller check + DB-derived { rule, ctx }. */
const LOADERS = {
  async crew_assigned(db, id, actor) {
    if (!canEditQueueOperations(actor)) return deny
    const { data: row } = await db.from('bookings').select('id, branch, vehicle_plate, service_id, queue_number').eq('id', id).maybeSingle()
    if (!row) return gone
    const since = new Date(Date.now() - FRESH_MS).toISOString()
    const { data: rows, error } = await db
      .from('queue_assignments')
      .select('staff_id, created_at')
      .eq('booking_id', id)
      .eq('status', 'active')
      .eq('assigned_by', actor.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (error) throw error
    const latest = (rows || []).filter((r) => r.created_at === rows[0].created_at)
    const b = await hydrateBookingForNotify(db, row)
    return {
      rule: { ...NOTIFY_EVENTS.crew_assigned, ids: latest.map((r) => r.staff_id), excludeId: actor.id },
      ctx: { bookingId: id, plate: b.vehicle_plate, service: b.service_name, branchName: b.branch_name, queueNumber: b.queue_number },
    }
  },

  async shift_submitted(db, id, actor) {
    if (!canAccessPos(actor)) return deny
    const { data: close } = await db.from('shift_close_reports').select('id, branch, business_date, status, submitted_by, submitted_at').eq('id', id).maybeSingle()
    if (!close) return gone
    if (close.submitted_by !== actor.id || close.status !== 'submitted' || !fresh(close.submitted_at)) return deny
    return {
      rule: { ...NOTIFY_EVENTS.shift_submitted, branch: close.branch, excludeId: actor.id },
      ctx: { closeId: id, branchName: await branchName(db, close.branch), businessDate: close.business_date, submitter: actor.full_name },
    }
  },

  async payroll_confirmed(db, id, actor) {
    if (!canRunPayroll(actor)) return deny
    const { data: run } = await db.from('payroll_runs').select('id, run_kind, period_start, period_end, status, confirmed_at').eq('id', id).maybeSingle()
    if (!run) return gone
    if (run.status !== 'confirmed' || !fresh(run.confirmed_at)) return deny
    const { data: lines, error } = await db.from('payroll_run_lines').select('staff_id').eq('run_id', id)
    if (error) throw error
    return {
      rule: { ...NOTIFY_EVENTS.payroll_confirmed, ids: [...new Set((lines || []).map((l) => l.staff_id))], excludeId: actor.id },
      ctx: { runId: id, runKind: run.run_kind, periodStart: run.period_start, periodEnd: run.period_end },
    }
  },

  async cash_advance_submitted(db, id, actor) {
    const { data: sub } = await db.from('ops_form_submissions').select('id, payload, status, created_by, created_at, ops_forms!inner(kind)').eq('id', id).maybeSingle()
    if (!sub || sub.ops_forms?.kind !== 'cash_advance') return gone
    if (sub.created_by !== actor.id || sub.status !== 'new' || !fresh(sub.created_at)) return deny
    const p = sub.payload || {}
    const branch = String(p.branch || actor.branch_slug || '').toLowerCase() || null
    return {
      rule: { ...NOTIFY_EVENTS.cash_advance_submitted, branch, excludeId: actor.id },
      ctx: { submissionId: id, employee: p.employee_name || actor.full_name, amountMinor: Math.round(Number(p.amount || 0) * 100), branchName: await branchName(db, branch) },
    }
  },

  async cash_advance_resolved(db, id, actor) {
    if (!canRunPayroll(actor)) return deny
    const { data: sub } = await db.from('ops_form_submissions').select('id, payload, status, created_by, ops_forms!inner(kind)').eq('id', id).maybeSingle()
    if (!sub || sub.ops_forms?.kind !== 'cash_advance') return gone
    if (!['resolved', 'archived'].includes(sub.status)) return deny
    const p = sub.payload || {}
    return {
      rule: { ...NOTIFY_EVENTS.cash_advance_resolved, ids: [p.staff_id || sub.created_by], excludeId: actor.id },
      ctx: { submissionId: id, approved: sub.status === 'resolved', amountMinor: Math.round(Number(p.amount || 0) * 100) },
    }
  },
}

export async function notifyOpsEvent(db, { event, id, actor }) {
  const load = LOADERS[event]
  if (!load) return { status: 400, error: 'Unknown event' }
  const found = await load(db, id, actor)
  if (found.error) return found
  const copy = buildOpsEventCopy(event, found.ctx)
  const recipients = await resolveStaffRecipients(db, found.rule)
  return { ...(await notifyRecipients(db, recipients, copy)), copy }
}
