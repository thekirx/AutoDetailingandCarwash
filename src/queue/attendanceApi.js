import { canEditAttendanceRoles, canEditAttendanceSettings } from '../auth/permissions'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import { supabase } from '../lib/supabase'
import {
  attendanceDateRange,
  isInsideGeofence,
  isLateVsShift,
  haversineMeters,
  mergeAttendancePeople,
} from '../lib/attendanceGeo'
import {
  DEFAULT_ATTENDANCE_ROLES,
  normalizeAttendanceRoles,
  peopleInAttendanceRoles,
} from '../lib/attendanceRoles'
import { getCurrentProfile } from './queueApi'
import { formatQueueActionError, getBranchScope, NO_BRANCH_SCOPE } from './queueLogic'

const ATTENDANCE_ROLES_KEY = 'attendance_roles'

function getTodayDateSafe() {
  return getLocalCalendarDate()
}

/** Read Super Admin role allow-list (defaults if missing). */
export async function fetchAttendanceRoleSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', ATTENDANCE_ROLES_KEY)
    .maybeSingle()
  if (error) throw formatQueueActionError(error)
  return normalizeAttendanceRoles(data?.value)
}

/**
 * Super Admin only — upsert which roles appear on attendance.
 * @returns {Promise<string[]>}
 */
export async function updateAttendanceRoleSettings(roles, profile) {
  if (!canEditAttendanceRoles(profile)) {
    throw new Error('Only Super Admin can edit which roles appear on attendance.')
  }
  // Strict: do not silently expand empty selection to defaults on write
  const raw = Array.isArray(roles) ? roles : roles?.roles
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Select at least one role for attendance.')
  }
  const cleaned = []
  const seen = new Set()
  for (const r of raw) {
    const role = String(r || '').trim()
    if (!DEFAULT_ATTENDANCE_ROLES.includes(role) || seen.has(role)) continue
    seen.add(role)
    cleaned.push(role)
  }
  if (!cleaned.length) {
    throw new Error('Select at least one valid employee role.')
  }

  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: ATTENDANCE_ROLES_KEY,
        value: { roles: cleaned },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    .select('value')
    .single()
  if (error) throw formatQueueActionError(error)
  return normalizeAttendanceRoles(data?.value)
}

/** Reset allow-list to product defaults — Super Admin only. */
export async function resetAttendanceRoleSettings(profile) {
  return updateAttendanceRoleSettings([...DEFAULT_ATTENDANCE_ROLES], profile)
}

export async function fetchBranchAttendanceSettings(branchSlug) {
  const { data, error } = await supabase
    .from('branches')
    .select('slug, name, latitude, longitude, geofence_radius_m, shift_start, shift_end')
    .eq('slug', branchSlug)
    .maybeSingle()
  if (error) throw formatQueueActionError(error)
  return data
}

export async function updateBranchAttendanceSettings(branchSlug, patch) {
  const { data, error } = await supabase
    .from('branches')
    .update({
      geofence_radius_m: patch.geofence_radius_m,
      shift_start: patch.shift_start,
      shift_end: patch.shift_end,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', branchSlug)
    .select('slug, geofence_radius_m, shift_start, shift_end')
    .single()
  if (error) throw formatQueueActionError(error)
  return data
}

/**
 * Super Admin / ASA(branches): same geofence + shifts on every branch.
 * Branch map pins stay per-branch; only radius and hours are network policy.
 */
export async function applyNetworkAttendanceSettings(patch, profile) {
  if (!canEditAttendanceSettings(profile)) {
    throw new Error('Only Super Admin can set network geofence and shifts.')
  }
  const radius = Number(patch.geofence_radius_m)
  if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
    throw new Error('Geofence radius must be between 20 and 5000 meters.')
  }
  const shift_start = String(patch.shift_start || '').trim()
  const shift_end = String(patch.shift_end || '').trim()
  if (!shift_start || !shift_end) {
    throw new Error('Shift start and end are required.')
  }

  const { data, error } = await supabase
    .from('branches')
    .update({
      geofence_radius_m: radius,
      shift_start,
      shift_end,
      updated_at: new Date().toISOString(),
    })
    .not('slug', 'is', null)
    .select('slug')
  if (error) throw formatQueueActionError(error)
  return { updated: (data || []).length, geofence_radius_m: radius, shift_start, shift_end }
}

export async function fetchAttendanceMatrix({ branchSlug, period, anchor }) {
  const range = attendanceDateRange(period, anchor)
  const personSelect = 'id, full_name, username, branch_slug, role, is_active'
  const roles = await fetchAttendanceRoleSettings()

  const [{ data: primary, error: primaryErr }, { data: assigns, error: assignErr }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select(personSelect)
      .eq('is_active', true)
      .eq('branch_slug', branchSlug)
      .in('role', roles)
      .order('full_name'),
    supabase
      .from('staff_branch_assignments')
      .select('staff_id')
      .eq('branch_slug', branchSlug),
  ])
  if (primaryErr) throw formatQueueActionError(primaryErr)
  if (assignErr) throw formatQueueActionError(assignErr)

  const assignedIds = [...new Set((assigns || []).map((a) => a.staff_id).filter(Boolean))]
  let assignedPeople = []
  if (assignedIds.length) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select(personSelect)
      .eq('is_active', true)
      .in('id', assignedIds)
      .in('role', roles)
      .order('full_name')
    if (error) throw formatQueueActionError(error)
    assignedPeople = data || []
  }

  // Defense in depth: re-filter after merge if roles config raced
  const staff = peopleInAttendanceRoles(mergeAttendancePeople(primary || [], assignedPeople), roles)

  const { data: rows, error } = await supabase
    .from('staff_attendance')
    .select('id, staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at, source, notes, check_in_lat, check_in_lng')
    .eq('branch_slug', branchSlug)
    .gte('attendance_date', range.start)
    .lte('attendance_date', range.end)
  if (error) throw formatQueueActionError(error)

  return { staff, attendance: rows || [], range, roles }
}

/** Staff self time-in via browser geolocation + branch geofence. */
export async function geoTimeIn({ profile, coords }) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug = profile?.branch_slug || getBranchScope(profile)
  if (!branchSlug || branchSlug === NO_BRANCH_SCOPE) {
    throw new Error('No branch assigned — cannot time in.')
  }

  const branch = await fetchBranchAttendanceSettings(branchSlug)
  if (branch?.latitude == null || branch?.longitude == null) {
    throw new Error('Branch has no map pin yet. Ask Super Admin to set location in Branches.')
  }

  const fence = isInsideGeofence({
    userLat: coords.latitude,
    userLng: coords.longitude,
    branchLat: branch.latitude,
    branchLng: branch.longitude,
    radiusM: branch.geofence_radius_m ?? 20,
  })
  if (!fence.ok) {
    throw new Error(`Outside geofence (${fence.distanceM}m away; allowed ${branch.geofence_radius_m || 20}m). Move closer to ${branch.name}.`)
  }

  const late = isLateVsShift(branch.shift_start)
  const status = late ? 'late' : 'present'
  const today = getTodayDateSafe()

  const { data, error } = await supabase
    .from('staff_attendance')
    .upsert(
      {
        staff_id: currentProfile.id,
        branch_slug: branchSlug,
        attendance_date: today,
        status,
        checked_in_at: new Date().toISOString(),
        checked_out_at: null,
        check_in_lat: coords.latitude,
        check_in_lng: coords.longitude,
        source: 'geo',
        marked_by: currentProfile.id,
        notes: late ? `Late vs shift ${String(branch.shift_start).slice(0, 5)}` : null,
      },
      { onConflict: 'staff_id,attendance_date' },
    )
    .select('id, status, checked_in_at')
    .single()
  if (error) throw formatQueueActionError(error)
  return { ...data, distanceM: fence.distanceM, branch }
}

export async function geoTimeOut({ profile, coords }) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug = profile?.branch_slug || getBranchScope(profile)
  if (!branchSlug || branchSlug === NO_BRANCH_SCOPE) throw new Error('No branch assigned.')
  const today = getTodayDateSafe()

  const patch = {
    checked_out_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (coords) {
    patch.check_out_lat = coords.latitude
    patch.check_out_lng = coords.longitude
  }

  const { data, error } = await supabase
    .from('staff_attendance')
    .update(patch)
    .eq('staff_id', currentProfile.id)
    .eq('attendance_date', today)
    .select('id, checked_out_at')
    .maybeSingle()
  if (error) throw formatQueueActionError(error)
  if (!data) throw new Error('No time-in record for today. Time in first.')
  return data
}

/** BossMich / ASA / Admin manual override for a staff×date cell (status + optional clock times). */
export async function adminOverrideAttendance({
  staffId,
  branchSlug,
  date,
  status,
  notes,
  profile,
  checkedInAt,
  checkedOutAt,
}) {
  const currentProfile = await getCurrentProfile({ required: true })
  const present = status === 'present' || status === 'late'
  const hasIn = checkedInAt !== undefined
  const hasOut = checkedOutAt !== undefined
  const { data, error } = await supabase
    .from('staff_attendance')
    .upsert(
      {
        staff_id: staffId,
        branch_slug: branchSlug,
        attendance_date: date,
        status,
        checked_in_at: hasIn ? checkedInAt || null : present ? new Date().toISOString() : null,
        checked_out_at: hasOut ? checkedOutAt || null : present ? null : new Date().toISOString(),
        source: 'admin',
        marked_by: currentProfile.id,
        notes: notes || `Override by ${profile?.full_name || currentProfile.id}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id,attendance_date' },
    )
    .select('id, status, checked_in_at, checked_out_at')
    .single()
  if (error) throw formatQueueActionError(error)
  return data
}

export function readBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.message || 'Location permission denied.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export { haversineMeters }
