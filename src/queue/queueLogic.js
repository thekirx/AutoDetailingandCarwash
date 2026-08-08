import {
  ROLES,
  QUEUE_EDITOR_ROLES as PERM_QUEUE_EDITOR_ROLES,
  QUEUE_VIEWER_ROLES as PERM_QUEUE_VIEWER_ROLES,
  canEditQueueOperations as permCanEditQueue,
  canOverrideQueueStatus,
  canSeeAllBranches,
  canSeeForPaymentLane,
  canViewQueueOperations as permCanViewQueue,
  canViewRedoLane,
  getBranchScopeList,
} from '../auth/permissions.js'
import {
  formatQueueNumberForKind as formatQueueNumber,
  serviceKindFromPayCategory,
} from '../lib/serviceKinds.js'

export { formatQueueNumber }
export { getBranchScopeList }

export const ACTIVE_QUEUE_STATUSES = ['waiting', 'in_progress', 'final_checking']
/** Ops board includes redo (owner-visible QC fail lane). Public queue stays on ACTIVE only. */
export const OPS_BOARD_STATUSES = [...ACTIVE_QUEUE_STATUSES, 'redo']
export const WORKFLOW_STATUSES = [...ACTIVE_QUEUE_STATUSES, 'for_payment', 'redo']
export const REDO_FROM_STATUSES = ['in_progress', 'final_checking', 'for_payment']
// Branch slugs are validated against public.branches at runtime — no static list.
export const VALID_VEHICLE_TYPES = ['sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other']
export const BOSS_MICH_ROLE = ROLES.SUPER_ADMIN
export const QUEUE_EDITOR_ROLES = PERM_QUEUE_EDITOR_ROLES
export const QUEUE_VIEWER_ROLES = PERM_QUEUE_VIEWER_ROLES
export const QUEUE_PERMISSION_ERROR = 'You do not have permission to edit queue operations. Only the assigned Team Lead or BossMich can perform this action.'
export const MISSING_QUEUE_COLUMNS_ERROR = 'Queue database columns are not fully migrated. Ask Super Admin to apply the latest Supabase migration, then reload the app.'
export const MISSING_QUEUE_PROFILE_ERROR = 'Your user profile is missing. Ask Super Admin to create or sync your profile before sending to payment.'
export const MISSING_STAFF_ATTENDANCE_ERROR = 'Staff attendance is not fully migrated yet. Ask Super Admin to apply the staff attendance Supabase migration.'
export const DEFAULT_TIMING_WARNINGS = { enabled: true, min_seconds_in_progress: 120 }

/** Sentinel for fail-closed branch filters (matches applyBranchScope empty-list behavior). */
export const NO_BRANCH_SCOPE = '__none__'

export const STATUS_LABELS = {
  waiting: 'Waiting',
  in_progress: 'In Progress',
  final_checking: 'For Final Checking',
  for_payment: 'For Payment',
  redo: 'Redo',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
}

export const DASHBOARD_DATE_PRESETS = [
  { key: 'today', label: 'Today', months: 0 },
  { key: '3mo', label: '3 months', months: 3 },
  { key: '6mo', label: '6 months', months: 6 },
  { key: 'custom', label: 'Custom', months: null },
]

export const VISIT_PROGRESS_STEPS = ['waiting', 'in_progress', 'final_checking', 'for_payment']

/** Customer-facing visit stepper — public status only, no internal ops data. */
export function buildVisitProgress(status) {
  const normalized = String(status || 'waiting').toLowerCase()
  const idx = VISIT_PROGRESS_STEPS.indexOf(normalized)
  const currentIndex = idx >= 0 ? idx : normalized === 'completed' ? VISIT_PROGRESS_STEPS.length : 0
  return {
    steps: VISIT_PROGRESS_STEPS.map((key) => ({ key, label: STATUS_LABELS[key] || key })),
    currentIndex,
    label: STATUS_LABELS[normalized] || normalized,
    isComplete: normalized === 'completed',
  }
}

const ACTIVE_SET = new Set(ACTIVE_QUEUE_STATUSES)

export function isActiveQueueStatus(status) {
  return ACTIVE_SET.has(status)
}

export function isOpsBoardStatus(status) {
  return OPS_BOARD_STATUSES.includes(status)
}

/**
 * Board columns for this profile.
 * TL: active lanes only (never For Payment — legacy port rule).
 * Branch Admin / SA / ASA: + For Payment. SA / ASA: + Redo.
 */
export function getOpsBoardStatuses(profile) {
  const lanes = [...ACTIVE_QUEUE_STATUSES]
  if (canSeeForPaymentLane(profile)) lanes.push('for_payment')
  if (canViewRedoLane(profile)) lanes.push('redo')
  return lanes
}

/**
 * Allowed direct status updates via updateTicketStatus (not redo RPC / POS complete).
 * UI "final_checking" maps to send_queue_ticket_to_payment → booking becomes for_payment.
 */
export const QUEUE_STATUS_TRANSITIONS = {
  waiting: ['in_progress'],
  in_progress: ['final_checking'],
  final_checking: [],
  for_payment: [],
  redo: ['in_progress'],
  completed: [],
  cancelled: [],
}

export function canTransitionQueueStatus(fromStatus, toStatus) {
  const from = String(fromStatus || '')
  const to = String(toStatus || '')
  return (QUEUE_STATUS_TRANSITIONS[from] || []).includes(to)
}

/**
 * Admin override lane targets (mirrors admin_override_queue_status RPC):
 * any open ticket can be pulled back to waiting / in progress / final checking.
 * Leaving for_payment cancels its pending handoff server-side (never deleted).
 */
export const ADMIN_OVERRIDE_TARGET_STATUSES = ['waiting', 'in_progress', 'final_checking']
const ADMIN_OVERRIDE_FROM_STATUSES = new Set([...ACTIVE_QUEUE_STATUSES, 'for_payment', 'redo'])

export function getAdminOverrideTargets(status) {
  const s = String(status || '')
  if (!ADMIN_OVERRIDE_FROM_STATUSES.has(s)) return []
  return ADMIN_OVERRIDE_TARGET_STATUSES.filter((target) => target !== s)
}

/**
 * Which TL/editor ticket buttons are enabled for the current status.
 * @param {string} status
 * @param {{ canManageQueue?: boolean, canViewRedoLane?: boolean }} caps
 */
export function getQueueTicketActionFlags(status, { canManageQueue = false, canViewRedoLane: seeRedo = false } = {}) {
  const s = String(status || '')
  const edit = Boolean(canManageQueue)
  return {
    canStart: edit && (s === 'waiting' || (seeRedo && s === 'redo')),
    canFinalCheck: edit && s === 'in_progress',
    /** Stuck at final_checking (auto-handoff failed) or retry before POS. */
    canSendToPayment: edit && s === 'final_checking',
    canMarkRedo: edit && seeRedo && REDO_FROM_STATUSES.includes(s),
  }
}

/** Valid ?lane= values for Floor → Queue deep links (board statuses only). */
export function parseQueueLaneParam(value) {
  const lane = String(value || '').trim().toLowerCase()
  if (OPS_BOARD_STATUSES.includes(lane) || lane === 'for_payment') return lane
  if (lane === 'all' || lane === 'total') return null
  return null
}

/** Build /operations/queue href with optional lane + branch filters. */
export function operationsQueueHref({ lane, branch } = {}) {
  const params = new URLSearchParams()
  const parsedLane = parseQueueLaneParam(lane)
  if (parsedLane) params.set('lane', parsedLane)
  const branchSlug = String(branch || '').trim()
  if (branchSlug && branchSlug !== 'all') params.set('branch', branchSlug)
  const qs = params.toString()
  return qs ? `/operations/queue?${qs}` : '/operations/queue'
}

export function getQueueCounts(rows = [], { includeRedo = true, statuses = null } = {}) {
  const counts = { waiting: 0, in_progress: 0, final_checking: 0, for_payment: 0, redo: 0, total: 0 }
  const allowed = statuses || (includeRedo ? OPS_BOARD_STATUSES : ACTIVE_QUEUE_STATUSES)

  for (const row of rows) {
    if (!allowed.includes(row.status)) continue
    if (counts[row.status] == null) counts[row.status] = 0
    counts[row.status] += 1
    counts.total += 1
  }

  return counts
}

/** Collapse multi-service visit_group into one board card. */
export function groupVisitTickets(rows = []) {
  const byKey = new Map()
  for (const row of rows) {
    const key = row.visit_group_id || row.booking_id
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        ...row,
        linked_booking_ids: [row.booking_id],
        service_names: [row.service_name].filter(Boolean),
        final_price_minor: Number(row.final_price_minor || 0),
      })
      continue
    }
    existing.linked_booking_ids.push(row.booking_id)
    if (row.service_name) existing.service_names.push(row.service_name)
    existing.final_price_minor += Number(row.final_price_minor || 0)
    existing.service_name = existing.service_names.join(' + ')
  }
  return [...byKey.values()]
}

export function resolveBranchFilter(profile, uiFilter = 'all') {
  const list = getBranchScopeList(profile)
  if (list === null) {
    if (!uiFilter || uiFilter === 'all') return null
    return uiFilter
  }
  // Fail-closed: scoped role with zero assignments must not widen to "all branches"
  if (!list.length) return NO_BRANCH_SCOPE
  if (uiFilter && uiFilter !== 'all' && list.includes(uiFilter)) return uiFilter
  if (list.length === 1) return list[0]
  return list
}

/** Branches the profile may pick in write forms (expense, booking, POS). */
export function filterBranchesForProfile(branches = [], profile) {
  const list = getBranchScopeList(profile)
  if (list === null) return branches || []
  if (!list.length) return []
  const allowed = new Set(list)
  return (branches || []).filter((b) => allowed.has(b.slug))
}

/**
 * Default branch for attendance / forms.
 * Never fall through to the first company-wide branch when the profile is scoped.
 */
export function pickDefaultBranchSlug(profile, branches = []) {
  const list = getBranchScopeList(profile)
  if (list === null) return branches[0]?.slug || profile?.branch_slug || ''
  if (list.length) return list[0]
  return profile?.branch_slug || ''
}

/** People directory: keep rows that touch the actor's branch scope (fail-closed when empty). */
export function filterPeopleForProfile(people = [], profile) {
  const list = getBranchScopeList(profile)
  if (list === null) return people || []
  if (!list.length) return []
  const allowed = new Set(list)
  return (people || []).filter((p) => {
    const slugs = Array.isArray(p.branch_slugs) && p.branch_slugs.length
      ? p.branch_slugs
      : p.branch_slug
        ? [p.branch_slug]
        : []
    return slugs.some((s) => allowed.has(s))
  })
}

/** Sum daily_sales_summary rows (already branch-scoped by the query). */
export function aggregateDailySalesSummary(rows = []) {
  let total_sales_minor = 0
  let cash_sales_minor = 0
  let online_sales_minor = 0
  let paid_count = 0
  for (const row of rows) {
    total_sales_minor += Number(row.total_sales_minor || 0)
    cash_sales_minor += Number(row.cash_sales_minor || 0)
    online_sales_minor += Number(row.online_sales_minor || 0)
    paid_count += Number(row.paid_count || 0)
  }
  return {
    total_sales_minor,
    cash_sales_minor,
    online_sales_minor,
    paid_count,
    average_ticket_minor: paid_count > 0 ? Math.round(total_sales_minor / paid_count) : 0,
  }
}

export function getDashboardDateRange(preset, customStart, customEnd, now = new Date()) {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const parseLocalDay = (value, endOfDay = false) => {
    const [y, m, d] = String(value).split('-').map(Number)
    if (!y || !m || !d) return null
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)
  }
  if (preset === 'custom' && customStart && customEnd) {
    const start = parseLocalDay(customStart)
    const endCustom = parseLocalDay(customEnd, true)
    if (start && endCustom) return { start, end: endCustom }
  }
  if (preset === 'today' || preset === 'day') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  if (preset === 'week') {
    const start = new Date(now)
    const day = start.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + mondayOffset)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { start, end }
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    return { start, end }
  }
  const months = preset === '6mo' ? 6 : 3
  const start = new Date(now)
  start.setMonth(start.getMonth() - months)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function isSuspiciousTiming(ticket, thresholds = DEFAULT_TIMING_WARNINGS) {
  if (!thresholds?.enabled) return false
  const minSec = Number(thresholds.min_seconds_in_progress)
  if (!Number.isFinite(minSec) || minSec <= 0) return false
  const start = ticket?.in_progress_at ? new Date(ticket.in_progress_at).getTime() : NaN
  const end = ticket?.final_checking_at ? new Date(ticket.final_checking_at).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false
  return (end - start) / 1000 < minSec
}

export function queueByBranchCounts(rows = []) {
  const out = {}
  for (const row of rows) {
    const key = row.branch || 'unknown'
    if (!out[key]) out[key] = { waiting: 0, in_progress: 0, final_checking: 0, for_payment: 0, redo: 0, total: 0 }
    if (out[key][row.status] != null) out[key][row.status] += 1
    if (isOpsBoardStatus(row.status)) out[key].total += 1
  }
  return out
}

export function validateCrewUsername(value) {
  const username = String(value || '').trim().toLowerCase()
  if (!username || username.length < 3) throw new Error('Username is required (min 3 characters).')
  if (!/^[a-z0-9._-]+$/.test(username)) throw new Error('Username may only use letters, numbers, dots, underscores, or hyphens.')
  return username
}

export function buildPublicQueueModel(rows = [], branch) {
  const safeRows = rows
    .filter((row) => (!branch || row.branch === branch) && isActiveQueueStatus(row.status))
    .map((row) => ({
      queueNumber: formatQueueNumber(row.queue_number, row.service_pay_category),
      status: row.status,
    }))

  const groups = Object.fromEntries(ACTIVE_QUEUE_STATUSES.map((status) => [status, []]))
  for (const row of safeRows) groups[row.status].push(row)

  return {
    counts: getQueueCounts(safeRows),
    groups,
  }
}

/** Shop TV kiosk model: plate + service kind/name (no phone / name). */
export function buildPublicFloorModel(rows = [], branch) {
  const safeRows = rows
    .filter((row) => (!branch || row.branch === branch) && isActiveQueueStatus(row.status))
    .map((row) => {
      const kind = serviceKindFromPayCategory(row.service_pay_category)
      return {
        queueNumber: formatQueueNumber(row.queue_number, row.service_pay_category),
        status: row.status,
        plate: String(row.vehicle_plate || '').trim().toUpperCase() || '-',
        serviceName: row.service_name || 'Service',
        kind,
        kindLabel: kind === 'detailing' ? 'Detailing' : kind === 'package' ? 'Package' : 'Service',
      }
    })

  const groups = Object.fromEntries(ACTIVE_QUEUE_STATUSES.map((status) => [status, []]))
  for (const row of safeRows) groups[row.status].push(row)

  return {
    counts: getQueueCounts(safeRows),
    groups,
    rows: safeRows,
  }
}

export function normalizeAssignmentStatus(status) {
  if (status === 'released' || status === 'cancelled') return status
  if (status === 'completed') return 'released'
  return 'active'
}

export function isStaffAssignmentBusy(assignment) {
  return normalizeAssignmentStatus(assignment?.status) === 'active' && isOpsBoardStatus(assignment?.booking_status)
}

export function normalizePlate(value = '') {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeVehicleType(value) {
  if (!value) return 'medium'
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'pick-up') return 'pickup'
  if (normalized === 'motorbike') return 'motorcycle'
  if (normalized === 'xl' || normalized === 'extra-large') return 'extra_large'
  // Allow vehicle_sizes.slug values (small/medium/large/extra_large + legacy body styles)
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(normalized)) return normalized.replace(/-/g, '_')
  return 'medium'
}

export function hasValidTeamLeadBranch(profile) {
  if (profile?.role !== 'team_lead') return true
  const list = getBranchScopeList(profile)
  if (Array.isArray(list) && list.length > 0) return true
  return Boolean(profile.branch_slug)
}

export function requiresTeamLeadBranchSetup(profile) {
  return profile?.role === 'team_lead' && !hasValidTeamLeadBranch(profile)
}

export function getBranchScope(profile) {
  // null = all branches. Single slug when one assigned; array when Admin multi-branch (callers use resolveBranchFilter).
  if (!profile || canSeeAllBranches(profile)) return null
  const list = getBranchScopeList(profile)
  if (Array.isArray(list) && list.length === 1) return list[0]
  if (Array.isArray(list) && list.length > 1) return list[0] // legacy single-slug callers
  if (Array.isArray(list) && list.length === 0) return NO_BRANCH_SCOPE
  return profile.branch_slug || NO_BRANCH_SCOPE
}

export function getBranchScopeFilter(profile) {
  if (!profile || canSeeAllBranches(profile)) return null
  const list = getBranchScopeList(profile)
  if (Array.isArray(list) && list.length) return list.length === 1 ? list[0] : list
  return profile.branch_slug || NO_BRANCH_SCOPE
}

export function canEditQueueOperations(profile) {
  return permCanEditQueue(profile)
}

export function canViewQueueOperations(profile) {
  return permCanViewQueue(profile)
}

export { canOverrideQueueStatus, canSeeForPaymentLane, canViewRedoLane }

export function canOverrideQueueBranches(profile) {
  return canSeeAllBranches(profile)
}

export function parsePesoInputToMinor(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized) throw new Error('Price is required.')

  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Price must be a positive number.')
  }

  return Math.round(amount * 100)
}

export function formatQueueActionError(error) {
  const message = error?.message || String(error || '')

  if (
    message.includes('staff_attendance')
    || message.includes('staff_profiles_id_fkey')
    || message.includes('bookings_assigned_staff_id_fkey')
    || (message.includes('is_archived') && message.includes('staff_profiles'))
    || (message.includes('row-level security') && message.includes('staff_profiles'))
    || message.includes('null value in column "id"')
    || (message.includes('schema cache') && message.includes('attendance'))
  ) {
    return new Error(MISSING_STAFF_ATTENDANCE_ERROR)
  }

  if (message.includes('schema cache') && message.includes('bookings')) {
    return new Error(MISSING_QUEUE_COLUMNS_ERROR)
  }

  if (message.includes('transactions_recorded_by_fkey') || message.includes('Your account profile is not fully set up')) {
    return new Error(MISSING_QUEUE_PROFILE_ERROR)
  }

  return error instanceof Error ? error : new Error(message || 'Queue action failed. Please try again.')
}

export function getCrewAttendanceModel({ staffPool = [], attendance = [], busyStaff = [] } = {}) {
  const activeStaff = staffPool
    .filter((member) => member.role === 'staff' && member.is_active !== false && member.is_archived !== true)
    .sort((left, right) => String(left.full_name || '').localeCompare(String(right.full_name || '')))
  const attendanceByStaffId = new Map(attendance.map((row) => [row.staff_id, row]))
  const presentIds = new Set(
    attendance
      .filter((row) => row.status === 'present')
      .map((row) => row.staff_id),
  )
  const activeBusy = busyStaff.filter((row) => presentIds.has(row.staff_id) && isActiveQueueStatus(row.booking_status))
  const busyIds = new Set(activeBusy.map((row) => row.staff_id))

  return {
    staffPool: activeStaff.map((member) => ({
      ...member,
      attendance: attendanceByStaffId.get(member.id) || null,
      is_present_today: presentIds.has(member.id),
      is_busy_today: busyIds.has(member.id),
    })),
    availableStaff: activeStaff
      .filter((member) => presentIds.has(member.id) && !busyIds.has(member.id))
      .map((member) => ({
        staff_id: member.id,
        full_name: member.full_name,
        role: member.role,
        branch_slug: member.branch_slug,
        phone: member.phone,
      })),
    busyStaff: activeBusy,
    presentCount: presentIds.size,
  }
}

export function getPlateLookupStatus(plateNumber, hasMatch) {
  if (!plateNumber?.trim()) return ''
  return hasMatch
    ? 'Existing customer found'
    : 'No record found. This will be added as a new customer/vehicle record.'
}
