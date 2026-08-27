import { attendanceWeight, normalizeCompensationSettings } from './compensation.js'
import { getLocalCalendarDate } from './localCalendarDate.js'
import { getCrewAttendanceModel, isAssignableAttendanceStatus } from '../queue/queueLogic.js'

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
