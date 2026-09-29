/**
 * Who gets each staff notification and where a tap lands.
 * urls are a preference list: each recipient gets the first one allowRoute lets them open.
 */
import { opsRouteKeyFromPath } from '../auth/authRedirect.js'
import { ROLES, allowRoute, hasGrant } from '../auth/permissions.js'

const R = ROLES
const EMPLOYEES = [R.STAFF, R.DETAILER, R.TEAM_LEAD, R.ADMIN, R.OPERATIONS_LEAD, R.SALES, R.MARKETING, R.VIDEO_EDITOR, R.ASSISTANT_SUPER_ADMIN]
const BOOKING_ROLES = [R.ADMIN, R.TEAM_LEAD, R.OPERATIONS_LEAD, R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.DETAILER]

/** Network-wide roles; everyone else only hears about their assigned branch. */
export const GLOBAL_NOTIFY_ROLES = [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.OPERATIONS_LEAD, R.MARKETING]

export const NOTIFY_EVENTS = {
  booking_new: { roles: BOOKING_ROLES, urls: ['/operations/bookings', '/operations/queue'] },
  booking_floor: { roles: BOOKING_ROLES, urls: ['/operations/queue', '/operations/bookings'] },
  booking_payment: { roles: BOOKING_ROLES, urls: ['/operations/pos', '/operations/queue', '/operations/bookings'] },
  crew_assigned: { roles: [R.STAFF, R.DETAILER, R.TEAM_LEAD, R.ADMIN], urls: ['/operations/my-tasks', '/operations/queue'] },
  shift_submitted: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], grant: 'finance_view', urls: ['/operations/finance?tab=shift-close'] },
  shift_accepted: { roles: [R.ADMIN, R.OPERATIONS_LEAD, R.TEAM_LEAD, R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/pos', '/operations/queue'] },
  shift_rejected: { roles: [R.ADMIN, R.OPERATIONS_LEAD, R.TEAM_LEAD, R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/pos', '/operations/queue'] },
  floor_pay_ready: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], grant: 'finance_write', urls: ['/operations/payroll'] },
  payroll_confirmed: { roles: EMPLOYEES, urls: ['/operations/my-pay'] },
  cash_advance_submitted: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], grant: 'finance_write', urls: ['/operations/payroll?tab=cash-advance'] },
  cash_advance_resolved: { roles: EMPLOYEES, urls: ['/operations/my-pay'] },
  inquiry: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/inquiries'] },
  review: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.OPERATIONS_LEAD, R.ADMIN], urls: ['/operations/reviews'] },
  complaint: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/planning?tab=forms'] },
  pos: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/pos'] },
  ops_lab: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN, R.OPERATIONS_LEAD], urls: ['/operations/roadmap'] },
  planner_task: {
    roles: [...EMPLOYEES, R.SUPER_ADMIN],
    urls: ['/operations/my-tasks', '/operations/planning', '/operations/bookings'],
  },
}

const PAYMENT = new Set(['for_payment'])
const FLOOR = new Set(['waiting', 'in_progress', 'final_checking', 'for_releasing', 'redo', 'completed'])

/** Booking status → ops notify event. */
export function bookingOpsEvent(status) {
  if (PAYMENT.has(status)) return 'booking_payment'
  if (FLOOR.has(status)) return 'booking_floor'
  return 'booking_new'
}

/** First url this profile may open, or null. Customer (/account) urls pass through. */
export function pickNotifyUrl(profile, urls = []) {
  for (const url of urls) {
    const path = String(url).split('?')[0]
    if (path.startsWith('/account')) return url
    const key = opsRouteKeyFromPath(path)
    if (key && allowRoute(profile, key)) return url
  }
  return null
}

/** "Hakum Auto Care Bacoor" → "Bacoor" for push / inbox / SMS text (keeps SMS short). */
export function branchLabel(name, slug) {
  return String(name || '').replace(/^Hakum(\s+Auto\s+Care)?\b\s*/i, '').trim() || slug || ''
}

export function inNotifyScope(profile, branch) {
  if (!branch || GLOBAL_NOTIFY_ROLES.includes(profile?.role)) return true
  const want = String(branch).toLowerCase()
  return [profile?.branch_slug, ...(profile?.branch_slugs || [])].some((b) => String(b || '').toLowerCase() === want)
}

/**
 * Pick recipients + their landing url from live staff rows.
 * `ids` = explicit people (assignees, submitter, payees): no role/branch filter, url still checked.
 * @returns {{ id: string, url: string }[]}
 */
export function planStaffRecipients(profiles, { roles = [], branch = null, urls = [], grant = null, ids = null, excludeId = null } = {}) {
  const wanted = ids ? new Set(ids.filter(Boolean)) : null
  const out = []
  for (const p of profiles || []) {
    if (!p?.id || p.id === excludeId || p.is_active === false || p.is_archived) continue
    if (wanted) {
      if (!wanted.has(p.id)) continue
    } else {
      if (!roles.includes(p.role) || !inNotifyScope(p, branch)) continue
      if (grant && p.role === R.ASSISTANT_SUPER_ADMIN && !hasGrant(p, grant)) continue
    }
    const url = pickNotifyUrl(p, urls)
    if (url) out.push({ id: p.id, url })
  }
  return out
}
