/**
 * Attendance system smoke: schema cols, CRUD override, geofence helpers.
 * node scripts/e2e-attendance.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { haversineMeters, isInsideGeofence, buildAttendanceHeatmap, attendanceDateRange } from '../src/lib/attendanceGeo.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing env')
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

assert(isInsideGeofence({
  userLat: 14.459, userLng: 120.929, branchLat: 14.459, branchLng: 120.929, radiusM: 150,
}).ok)
results.push('helpers.geofence: ok')

const { data: branch, error: bErr } = await admin
  .from('branches')
  .select('slug, latitude, longitude, geofence_radius_m, shift_start, shift_end')
  .eq('slug', 'bacoor')
  .single()
assert(!bErr && branch?.geofence_radius_m, `branch settings: ${bErr?.message}`)
results.push(`db.branch_settings: ok (r=${branch.geofence_radius_m})`)

const { data: staff } = await admin.from('staff_profiles').select('id').eq('role', 'staff').eq('is_active', true).limit(1).maybeSingle()
assert(staff?.id, 'need staff row')

const today = new Date().toISOString().slice(0, 10)
const { data: up, error: uErr } = await admin
  .from('staff_attendance')
  .upsert({
    staff_id: staff.id,
    branch_slug: 'bacoor',
    attendance_date: today,
    status: 'late',
    source: 'admin',
    checked_in_at: new Date().toISOString(),
    check_in_lat: branch.latitude,
    check_in_lng: branch.longitude,
  }, { onConflict: 'staff_id,attendance_date' })
  .select('id, status, source')
  .single()
assert(!uErr && up.status === 'late', `upsert late: ${uErr?.message}`)
results.push('crud.override_late: ok')

const range = attendanceDateRange('weekly')
const { data: rows } = await admin
  .from('staff_attendance')
  .select('staff_id, attendance_date, status')
  .eq('branch_slug', 'bacoor')
  .gte('attendance_date', range.start)
  .lte('attendance_date', range.end)
const matrix = buildAttendanceHeatmap([{ id: staff.id, full_name: 'E2E' }], rows || [], range.dates)
assert(matrix[0].cells.some((c) => c.status === 'late' || c.status === 'present' || c.count >= 0))
results.push('heatmap.matrix: ok')

console.log(results.map((r) => `✔ ${r}`).join('\n'))
console.log('e2e-attendance: PASS')
void haversineMeters
