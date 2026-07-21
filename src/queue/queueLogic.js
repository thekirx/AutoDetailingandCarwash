import {
  ROLES,
  QUEUE_EDITOR_ROLES as PERM_QUEUE_EDITOR_ROLES,
  QUEUE_VIEWER_ROLES as PERM_QUEUE_VIEWER_ROLES,
  canEditQueueOperations as permCanEditQueue,
  canViewQueueOperations as permCanViewQueue,
} from '../auth/permissions.js'

export const ACTIVE_QUEUE_STATUSES = ['waiting', 'in_progress', 'final_checking']
export const WORKFLOW_STATUSES = [...ACTIVE_QUEUE_STATUSES, 'for_payment']
// Branch slugs are validated against public.branches at runtime — no static list.
export const VALID_VEHICLE_TYPES = ['sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other']
export const BOSS_MICH_ROLE = ROLES.SUPER_ADMIN
export const QUEUE_EDITOR_ROLES = PERM_QUEUE_EDITOR_ROLES
export const QUEUE_VIEWER_ROLES = PERM_QUEUE_VIEWER_ROLES
export const QUEUE_PERMISSION_ERROR = 'You do not have permission to edit queue operations. Only the assigned Team Lead or BossMich can perform this action.'
export const MISSING_QUEUE_COLUMNS_ERROR = 'Queue database columns are not fully migrated. Ask Super Admin to apply the latest Supabase migration, then reload the app.'
export const MISSING_QUEUE_PROFILE_ERROR = 'Your user profile is missing. Ask Super Admin to create or sync your profile before sending to payment.'
export const MISSING_STAFF_ATTENDANCE_ERROR = 'Staff attendance is not fully migrated yet. Ask Super Admin to apply the staff attendance Supabase migration.'

export const STATUS_LABELS = {
  waiting: 'Waiting',
  in_progress: 'In Progress',
  final_checking: 'For Final Checking',
  for_payment: 'For Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
}

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

export function getQueueCounts(rows = []) {
  const counts = { waiting: 0, in_progress: 0, final_checking: 0, total: 0 }

  for (const row of rows) {
    if (!isActiveQueueStatus(row.status)) continue
    counts[row.status] += 1
    counts.total += 1
  }

  return counts
}

export function formatQueueNumber(queueNumber) {
  if (queueNumber === null || queueNumber === undefined || queueNumber === '') return 'Q---'
  return `Q-${String(queueNumber).padStart(3, '0')}`
}

export function buildPublicQueueModel(rows = [], branch) {
  const safeRows = rows
    .filter((row) => (!branch || row.branch === branch) && isActiveQueueStatus(row.status))
    .map((row) => ({
      queueNumber: formatQueueNumber(row.queue_number),
      status: row.status,
    }))

  const groups = Object.fromEntries(ACTIVE_QUEUE_STATUSES.map((status) => [status, []]))
  for (const row of safeRows) groups[row.status].push(row)

  return {
    counts: getQueueCounts(safeRows),
    groups,
  }
}

export function normalizeAssignmentStatus(status) {
  if (status === 'released' || status === 'cancelled') return status
  if (status === 'completed') return 'released'
  return 'active'
}

export function isStaffAssignmentBusy(assignment) {
  return normalizeAssignmentStatus(assignment?.status) === 'active' && isActiveQueueStatus(assignment?.booking_status)
}

export function normalizePlate(value = '') {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeVehicleType(value) {
  if (!value) return 'sedan'
  const normalized = value.trim().toLowerCase()

  if (normalized === 'suv') return 'suv'
  if (normalized === 'sedan') return 'sedan'
  if (normalized === 'van') return 'van'
  if (normalized === 'pickup' || normalized === 'pick-up') return 'pickup'
  if (normalized === 'motorcycle' || normalized === 'motorbike') return 'motorcycle'
  if (normalized === 'other') return 'other'

  return 'sedan'
}

export function hasValidTeamLeadBranch(profile) {
  if (profile?.role !== 'team_lead') return true
  return Boolean(profile.branch_slug)
}

export function requiresTeamLeadBranchSetup(profile) {
  return profile?.role === 'team_lead' && !hasValidTeamLeadBranch(profile)
}

export function getBranchScope(profile) {
  // Only Super Admin (BossMich) sees all branches. Admin is assigned to one branch.
  if (!profile || canOverrideQueueBranches(profile)) return null
  return profile.branch_slug || null
}

export function canEditQueueOperations(profile) {
  return permCanEditQueue(profile)
}

export function canViewQueueOperations(profile) {
  return permCanViewQueue(profile)
}

export function canOverrideQueueBranches(profile) {
  return profile?.role === BOSS_MICH_ROLE
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
