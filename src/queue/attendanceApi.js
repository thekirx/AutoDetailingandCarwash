import { getBranchScope } from './queueLogic'
import { getCurrentProfile } from './queueApi'
import { supabase } from '../lib/supabase'
import {
  attendanceDateRange,
  isInsideGeofence,
  isLateVsShift,
  haversineMeters,
} from '../lib/attendanceGeo'
import { formatQueueActionError } from './queueLogic'

function getTodayDateSafe() {
  return new Date().toISOString().slice(0, 10)
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

export async function fetchAttendanceMatrix({ branchSlug, period, anchor }) {
  const range = attendanceDateRange(period, anchor)
  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('id, full_name, username, branch_slug, role, is_active')
    .eq('is_active', true)
    .eq('branch_slug', branchSlug)
    .in('role', ['staff', 'team_lead'])
    .order('full_name')
  if (staffErr) throw formatQueueActionError(staffErr)

  const { data: rows, error } = await supabase
    .from('staff_attendance')
    .select('id, staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at, source, notes, check_in_lat, check_in_lng')
    .eq('branch_slug', branchSlug)
    .gte('attendance_date', range.start)
    .lte('attendance_date', range.end)
  if (error) throw formatQueueActionError(error)

  return { staff: staff || [], attendance: rows || [], range }
}

/** Staff self time-in via browser geolocation + branch geofence. */
export async function geoTimeIn({ profile, coords }) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug = profile?.branch_slug || getBranchScope(profile)
  if (!branchSlug) throw new Error('No branch assigned — cannot time in.')

  const branch = await fetchBranchAttendanceSettings(branchSlug)
  if (branch?.latitude == null || branch?.longitude == null) {
    throw new Error('Branch has no map pin yet. Ask Super Admin to set location in Branches.')
  }

  const fence = isInsideGeofence({
    userLat: coords.latitude,
    userLng: coords.longitude,
    branchLat: branch.latitude,
    branchLng: branch.longitude,
    radiusM: branch.geofence_radius_m ?? 150,
  })
  if (!fence.ok) {
    throw new Error(`Outside geofence (${fence.distanceM}m away; allowed ${branch.geofence_radius_m || 150}m). Move closer to ${branch.name}.`)
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
  if (!branchSlug) throw new Error('No branch assigned.')
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
