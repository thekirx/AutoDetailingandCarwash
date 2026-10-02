/**
 * Daily-ops events the client can't target itself: the server loads the record, checks the caller,
 * and derives recipients (assigned crew, payees, requester, SA/ASA finance) from the DB.
 */
import { canEditQueueOperations } from '../src/auth/permissions.js'
import { canEditDailySheet, canReviewDailySheet } from '../src/lib/dailySheet.js'
import { NOTIFY_EVENTS, branchLabel } from '../src/lib/notifyRouting.js'
import { hydrateBookingForNotify } from './notifyBooking.mjs'
import { notifyRecipients, resolveStaffRecipients } from './webPush.mjs'

export const OPS_EVENTS = ['crew_assigned', 'sheet_submitted', 'sheet_reviewed', 'cash_advance_submitted']

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
    case 'sheet_submitted': {
      const off = Number(c.overShortMinor) || 0
      return {
        kind: 'sheet_submitted',
        title: `Daily sheet to approve · ${c.branchName || 'branch'}`,
        body: `${c.submitter || 'Branch admin'} submitted ${c.businessDate || 'today'} · net ${pesos(c.netProfitMinor)}${off ? ` · drawer ${off > 0 ? 'over' : 'short'} ${pesos(Math.abs(off))}` : ''}. Approve or return in Finance.`,
        tag: `sheet-submitted-${c.sheetId}`,
      }
    }
    case 'sheet_reviewed':
      return {
        kind: 'sheet_reviewed',
        title: `Daily sheet ${c.approved ? 'approved' : 'returned'} · ${c.branchName || 'branch'}`,
        body: c.approved
          ? `${c.businessDate || 'Today'}: approved — release pay to the crew.`
          : `${c.businessDate || 'Today'}: ${c.note || 'please fix and submit again'}`,
        tag: `sheet-reviewed-${c.sheetId}`,
      }
    case 'cash_advance_submitted':
      return {
        kind: 'cash_advance_submitted',
        title: 'Cash advance request',
        body: `${c.employee || 'Employee'} · ${pesos(c.amountMinor)} @ ${c.branchName || 'branch'}. Release it on today's Daily Sheet.`,
        tag: `ca-req-${c.submissionId}`,
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

/** Server-side events (inquiry, review): rule from NOTIFY_EVENTS plus branch / ids / excludeId. */
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

  async sheet_submitted(db, id, actor) {
    if (!canEditDailySheet(actor)) return deny
    const { data: sheet } = await db.from('daily_sheets').select('id, branch, business_date, status, totals, submitted_by, submitted_at').eq('id', id).maybeSingle()
    if (!sheet) return gone
    if (sheet.submitted_by !== actor.id || sheet.status !== 'submitted' || !fresh(sheet.submitted_at)) return deny
    return {
      rule: { ...NOTIFY_EVENTS.sheet_submitted, urls: [`/operations/finance?tab=sheets&sheet=${id}`], branch: sheet.branch, excludeId: actor.id },
      ctx: {
        sheetId: id,
        branchName: await branchName(db, sheet.branch),
        businessDate: sheet.business_date,
        submitter: actor.full_name,
        netProfitMinor: sheet.totals?.netProfitMinor,
        overShortMinor: sheet.totals?.overShortMinor,
      },
    }
  },

  async sheet_reviewed(db, id, actor) {
    if (!canReviewDailySheet(actor)) return deny
    const { data: sheet } = await db.from('daily_sheets').select('id, branch, business_date, status, review_note, submitted_by, reviewed_by, reviewed_at').eq('id', id).maybeSingle()
    if (!sheet) return gone
    if (!['approved', 'returned'].includes(sheet.status) || sheet.reviewed_by !== actor.id || !fresh(sheet.reviewed_at)) return deny
    return {
      rule: { ...NOTIFY_EVENTS.sheet_reviewed, urls: [`/operations/pos?tab=sheet&date=${sheet.business_date}`], ids: [sheet.submitted_by], excludeId: actor.id },
      ctx: { sheetId: id, approved: sheet.status === 'approved', note: sheet.review_note, branchName: await branchName(db, sheet.branch), businessDate: sheet.business_date },
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
