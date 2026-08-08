import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns'

/** Earth-surface distance in meters (haversine). */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function isInsideGeofence({ userLat, userLng, branchLat, branchLng, radiusM }) {
  if (![userLat, userLng, branchLat, branchLng].every((n) => Number.isFinite(Number(n)))) return false
  const dist = haversineMeters(userLat, userLng, branchLat, branchLng)
  return { ok: dist <= Number(radiusM || 150), distanceM: Math.round(dist) }
}

/** @param {'daily'|'weekly'|'monthly'} period */
export function attendanceDateRange(period, anchor = new Date()) {
  const day = new Date(anchor)
  if (period === 'daily') {
    const key = format(day, 'yyyy-MM-dd')
    return { start: key, end: key, dates: [key] }
  }
  if (period === 'weekly') {
    const start = startOfWeek(day, { weekStartsOn: 1 })
    const end = endOfWeek(day, { weekStartsOn: 1 })
    const dates = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
    return { start: dates[0], end: dates[dates.length - 1], dates }
  }
  const start = startOfMonth(day)
  const end = endOfMonth(day)
  const dates = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
  return { start: dates[0], end: dates[dates.length - 1], dates }
}

/** Map status → heatmap intensity 0–4 */
export function attendanceStatusCount(status) {
  if (status === 'present') return 4
  if (status === 'late') return 2
  if (status === 'absent') return 1
  return 0
}

/**
 * Build staff × date matrix for heatmap.
 * @returns {{ staffId, name, role, cells: { date, status, count, row }[] }[]}
 */
export function buildAttendanceHeatmap(staffRows, attendanceRows, dates) {
  const byKey = new Map()
  for (const row of attendanceRows || []) {
    byKey.set(`${row.staff_id}|${row.attendance_date}`, row)
  }
  return (staffRows || []).map((s) => ({
    staffId: s.id,
    name: s.full_name || s.username || 'Team member',
    role: s.role || '',
    cells: dates.map((date) => {
      const row = byKey.get(`${s.id}|${date}`) || null
      const status = row?.status || null
      return {
        date,
        status,
        count: attendanceStatusCount(status),
        row,
      }
    }),
  }))
}

export function shiftTimeToLabel(t) {
  if (!t) return '—'
  return String(t).slice(0, 5)
}

/** Build ISO timestamp from local calendar date + HH:MM (admin override clock). */
export function combineLocalDateAndTime(dateYmd, hhmm) {
  if (!dateYmd || !hhmm) return null
  const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [y, mo, d] = String(dateYmd).split('-').map(Number)
  if (![y, mo, d].every(Number.isFinite)) return null
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2]), 0, 0).toISOString()
}

export function isoToLocalHhmm(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Compare HH:MM against now in local time for late detection */
export function isLateVsShift(shiftStart, now = new Date()) {
  if (!shiftStart) return false
  const [hh, mm] = String(shiftStart).slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hh)) return false
  const startMins = hh * 60 + (mm || 0)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return nowMins > startMins + 5
}

export function recentDays(n = 14, anchor = new Date()) {
  const end = new Date(anchor)
  const start = subDays(end, n - 1)
  return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
}

/** Flatten people × dates into table rows for search/filter UI. */
export function buildAttendanceTableRows(staff, attendance, dates) {
  const byKey = new Map()
  for (const row of attendance || []) {
    byKey.set(`${row.staff_id}|${row.attendance_date}`, row)
  }
  const out = []
  for (const s of staff || []) {
    for (const date of dates || []) {
      const row = byKey.get(`${s.id}|${date}`) || null
      out.push({
        key: `${s.id}|${date}`,
        staffId: s.id,
        name: s.full_name || s.username || 'Team member',
        username: s.username || '',
        role: s.role || '',
        date,
        status: row?.status || null,
        checked_in_at: row?.checked_in_at || null,
        checked_out_at: row?.checked_out_at || null,
        source: row?.source || null,
        row,
      })
    }
  }
  return out
}

/** Dedupe primary branch + assignment lists; floor roles first, then name. */
export function mergeAttendancePeople(primaryRows = [], assignedRows = []) {
  const byId = new Map()
  for (const row of [...primaryRows, ...assignedRows]) {
    if (!row?.id) continue
    byId.set(row.id, row)
  }
  const rank = {
    BossMich: 0,
    assistant_super_admin: 1,
    admin: 2,
    team_lead: 3,
    staff: 4,
    marketing: 5,
  }
  return [...byId.values()].sort((a, b) => {
    const ra = rank[a.role] ?? 9
    const rb = rank[b.role] ?? 9
    if (ra !== rb) return ra - rb
    return String(a.full_name || a.username || '').localeCompare(String(b.full_name || b.username || ''))
  })
}

export { format, addDays }

// ponytail: self-check for merge + table flatten (ceiling: tiny assert; upgrade → vitest)
// eslint-disable-next-line no-undef -- Node self-check only; absent in the browser bundle
if (typeof process !== 'undefined' && process.env?.ATTENDANCE_SELF_CHECK === '1') {
  const merged = mergeAttendancePeople(
    [{ id: 'a', full_name: 'Staff A', role: 'staff' }],
    [
      { id: 'a', full_name: 'Staff A', role: 'staff' },
      { id: 'b', full_name: 'TL B', role: 'team_lead' },
    ],
  )
  if (merged.length !== 2 || merged[0].role !== 'team_lead') {
    throw new Error('mergeAttendancePeople self-check failed')
  }
}
