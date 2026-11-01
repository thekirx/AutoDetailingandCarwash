import { attendanceWeight, normalizeCompensationSettings } from './compensation.js'
import { getLocalCalendarDate } from './localCalendarDate.js'
import { getCrewAttendanceModel, isAssignableAttendanceStatus } from '../queue/queueLogic.js'

const ATTENDANCE_HEADCOUNT = Object.freeze([
  { role: 'staff', label: 'Crew' },
  { role: 'team_lead', label: 'Team Lead' },
  { role: 'admin', label: 'Admin' },
])

export const ADMINISTRATIVE_ROLES = Object.freeze([
  'admin',
  'assistant_super_admin',
  'super_admin',
  'marketing',
  'video_editor',
  'sales',
  'operations_lead',
  'team_lead',
])

export function isFloorCrew(memberOrRole) {
  const role = typeof memberOrRole === 'string' ? memberOrRole : memberOrRole?.role
  return role === 'staff' || role === 'detailer'
}

export function isAdministrativeCrew(memberOrRole) {
  return !isFloorCrew(memberOrRole)
}

/**
 * Format attendance headcount for Floor Insight dashboard and Attendance page.
 * Example output:
 *   crewLine: "Bacoor Branch Crew - 8 out of 10"
 *   adminLine: "Team Lead - 2 out of 2 Admin - 1 out of 2"
 */
export function formatAttendanceHeadcountStrings(branchName = '', roleHeadcount = []) {
  const crew = (roleHeadcount || []).find((r) => r.role === 'staff') || { onSite: 0, total: 0 }
  const tl = (roleHeadcount || []).find((r) => r.role === 'team_lead') || { onSite: 0, total: 0 }
  const admin = (roleHeadcount || []).find((r) => r.role === 'admin') || { onSite: 0, total: 0 }

  let rawBranch = String(branchName || '').trim()
  rawBranch = rawBranch.replace(/^Hakum\s+(Auto\s+Care\s+)?(- )?/i, '').trim()

  let branchLabel = ''
  if (!rawBranch || rawBranch.toLowerCase() === 'all' || rawBranch.toLowerCase() === 'all branches') {
    branchLabel = 'All Branches'
  } else if (/branch/i.test(rawBranch)) {
    branchLabel = rawBranch.charAt(0).toUpperCase() + rawBranch.slice(1)
  } else {
    const capitalized = rawBranch.charAt(0).toUpperCase() + rawBranch.slice(1)
    branchLabel = `${capitalized} Branch`
  }

  const crewLine = `${branchLabel} Crew - ${crew.onSite} out of ${crew.total}`
  const adminLine = `Team Lead - ${tl.onSite} out of ${tl.total} Admin - ${admin.onSite} out of ${admin.total}`

  return { crewLine, adminLine, fullText: `${crewLine}\n${adminLine}` }
}

/** On site (present or late) out of the roster, split the way the branch reads it. */
export function attendanceRoleHeadcount(staff = [], attendance = [], today = getLocalCalendarDate()) {
  const byStaff = new Map(
    (attendance || []).filter((row) => row.attendance_date === today).map((row) => [row.staff_id, row]),
  )
  return ATTENDANCE_HEADCOUNT.map(({ role, label }) => {
    const members = (staff || []).filter((member) => member?.role === role)
    const onSite = members.filter((member) => {
      const status = byStaff.get(member.id)?.status
      return status === 'present' || status === 'late'
    }).length
    return { role, label, onSite, total: members.length }
  })
}

/** Count today’s roster by attendance status. */
export function summarizeTodayAttendance(staff = [], attendance = [], today = getLocalCalendarDate()) {
  const byStaff = new Map(
    (attendance || []).filter((row) => row.attendance_date === today).map((row) => [row.staff_id, row]),
  )
  let present = 0
  let late = 0
  let absent = 0
  let empty = 0
  for (const member of staff || []) {
    const status = byStaff.get(member.id)?.status || null
    if (status === 'present') present += 1
    else if (status === 'late') late += 1
    else if (status === 'absent') absent += 1
    else empty += 1
  }
  return {
    present,
    late,
    absent,
    empty,
    total: (staff || []).length,
    onSite: present + late,
  }
}

/** Period totals for register header chips. */
export function summarizePeriodAttendance(attendance = [], dates = []) {
  const allowed = new Set(dates || [])
  let present = 0
  let late = 0
  let absent = 0
  for (const row of attendance || []) {
    if (!allowed.has(row.attendance_date)) continue
    if (row.status === 'present') present += 1
    else if (row.status === 'late') late += 1
    else if (row.status === 'absent') absent += 1
  }
  return { present, late, absent, recorded: present + late + absent }
}

/**
 * Wash-pool weight preview for a single day — same weights Payroll uses.
 * @returns {{ staffId, name, role, status, weight, weightLabel, assignable }[]}
 */
export function buildAttendancePayrollPreview(staff = [], attendance = [], rules = {}, today = getLocalCalendarDate()) {
  const normalized = normalizeCompensationSettings(rules)
  const byStaff = new Map(
    (attendance || []).filter((row) => row.attendance_date === today).map((row) => [row.staff_id, row]),
  )
  return (staff || [])
    .map((member) => {
      const status = byStaff.get(member.id)?.status || null
      const weight = attendanceWeight(status, normalized, member)
      const weightLabel = status ? `${Math.round(weight * 100)}%` : '—'
      return {
        staffId: member.id,
        name: member.full_name || member.username || 'Team member',
        role: member.role,
        status,
        weight,
        weightLabel,
        assignable: isAssignableAttendanceStatus(status),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Map crew floor model to register stat tiles. */
export function registerFloorStats(crewModel, staffCount = 0) {
  if (!crewModel) {
    return { onSite: 0, assignable: 0, onJobs: 0, blocked: staffCount, staffPool: 0 }
  }
  return {
    onSite: crewModel.presentCount || 0,
    assignable: crewModel.availableCount ?? (crewModel.availableStaff?.length || 0),
    onJobs: crewModel.onBayCount ?? (crewModel.busyStaff?.length || 0),
    blocked: crewModel.absentCount ?? (crewModel.absentStaff?.length || 0),
    staffPool: crewModel.staffPool?.length || staffCount,
  }
}

export { getCrewAttendanceModel, isAssignableAttendanceStatus }
