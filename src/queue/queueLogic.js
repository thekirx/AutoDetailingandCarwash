export const ACTIVE_QUEUE_STATUSES = ['waiting', 'in_progress', 'final_checking']
export const WORKFLOW_STATUSES = [...ACTIVE_QUEUE_STATUSES, 'for_payment']
export const VALID_BRANCH_SLUGS = ['bacoor', 'batangas']
export const VALID_VEHICLE_TYPES = ['sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other']

export const STATUS_LABELS = {
  waiting: 'Waiting',
  in_progress: 'In Progress',
  final_checking: 'For Final Checking',
  for_payment: 'For Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
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
  return VALID_BRANCH_SLUGS.includes(profile.branch_slug)
}

export function requiresTeamLeadBranchSetup(profile) {
  return profile?.role === 'team_lead' && !hasValidTeamLeadBranch(profile)
}

export function getBranchScope(profile) {
  if (!profile || profile.role === 'admin') return null
  return VALID_BRANCH_SLUGS.includes(profile.branch_slug) ? profile.branch_slug : null
}

export function getPlateLookupStatus(plateNumber, hasMatch) {
  if (!plateNumber?.trim()) return ''
  return hasMatch
    ? 'Existing customer found'
    : 'No record found. This will be added as a new customer/vehicle record.'
}
