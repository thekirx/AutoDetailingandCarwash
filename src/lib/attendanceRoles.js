/** Attendance role allow-list — Super Admin configures via app_settings.attendance_roles */

export const ATTENDANCE_ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'admin', label: 'Admin' },
  { value: 'assistant_super_admin', label: 'Assistant Super Admin' },
  { value: 'BossMich', label: 'Super Admin' },
  { value: 'marketing', label: 'Marketing' },
]

export const DEFAULT_ATTENDANCE_ROLES = ATTENDANCE_ROLE_OPTIONS.map((o) => o.value)

const KNOWN = new Set(DEFAULT_ATTENDANCE_ROLES)

/**
 * Normalize stored/API input into a unique ordered list of known roles.
 * Accepts string[], or `{ roles: string[] }`, or null/empty → defaults.
 */
export function normalizeAttendanceRoles(input) {
  let list = input
  if (list && typeof list === 'object' && !Array.isArray(list)) {
    list = list.roles
  }
  if (!Array.isArray(list) || list.length === 0) {
    return [...DEFAULT_ATTENDANCE_ROLES]
  }
  const out = []
  const seen = new Set()
  for (const raw of list) {
    const role = String(raw || '').trim()
    if (!KNOWN.has(role) || seen.has(role)) continue
    seen.add(role)
    out.push(role)
  }
  return out.length ? out : [...DEFAULT_ATTENDANCE_ROLES]
}

/** Strict filter: only people whose role is in the configured allow-list. */
export function peopleInAttendanceRoles(people, roles) {
  const allowed = new Set(normalizeAttendanceRoles(roles))
  return (people || []).filter((p) => allowed.has(p?.role))
}

export function attendanceRoleLabel(role) {
  return ATTENDANCE_ROLE_OPTIONS.find((o) => o.value === role)?.label || role || '—'
}
