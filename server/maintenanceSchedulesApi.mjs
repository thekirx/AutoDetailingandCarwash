/**
 * Ops API for detailing paint-maintenance schedules on Bookings → Maintenance.
 * GET list · PATCH reschedule/cancel · POST send reminder
 */
import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { sendPaintMaintenanceReminder } from './paintMaintenanceNotify.mjs'
import {
  DETAILING_SCHEDULE_TYPES,
  PAINT_MAINTENANCE_PROGRAM,
  addMonthsDateOnly,
  coatedAtDateOnly,
  normalizeMaintPlate,
  sortMaintenanceSchedules,
} from '../src/lib/paintMaintenance.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const READ_ROLES = new Set([
  'BossMich',
  'assistant_super_admin',
  'admin',
  'team_lead',
  'sales',
  'marketing',
  'operations_lead',
])
const WRITE_ROLES = new Set(['BossMich', 'assistant_super_admin', 'admin', 'sales', 'operations_lead'])
const TYPE_ROLES = new Set(['BossMich', 'assistant_super_admin'])

const SELECT_COLS =
  'id, vehicle_id, customer_id, booking_id, service_slug, plate_number, plate_normalized, program_key, customer_phone, customer_name, coated_at, last_maintenance_at, next_due_at, branch_slug, status, last_notified_at, notes, created_at, updated_at'

async function loadStaff(db, token) {
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!staff) return null

  let branch_slugs = staff.branch_slug ? [staff.branch_slug] : []
  if (staff.role === 'admin') {
    const { data: assigns } = await db
      .from('staff_branch_assignments')
      .select('branch_slug')
      .eq('staff_id', staff.id)
    if (assigns?.length) branch_slugs = assigns.map((a) => a.branch_slug).filter(Boolean)
  }
  return { ...staff, branch_slugs }
}

function canSeeAllBranches(role) {
  return role === 'BossMich' || role === 'assistant_super_admin' || role === 'sales' || role === 'marketing' || role === 'operations_lead'
}

/**
 * GET  /api/maintenance-schedules?branch=&status=
 * PATCH body: { id, next_due_at? } | { id, status: 'cancelled'|'scheduled' } | { id, action: 'bump', months? }
 * POST body: { id, force? } — send reminder now
 * PUT body: { types: [{ slug, frequency_months, channel? }] } — SA/ASA type intervals
 */
export async function handleMaintenanceSchedulesRequest(req, res) {
  setCors(res, 'GET, POST, PUT, PATCH, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const db = admin()
    const staff = await loadStaff(db, token)
    if (!staff || !READ_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost')
      const branch = url.searchParams.get('branch')
      const status = url.searchParams.get('status')
      let query = db
        .from('vehicle_maintenance_schedules')
        .select(SELECT_COLS)
        .eq('program_key', PAINT_MAINTENANCE_PROGRAM)
        .order('next_due_at', { ascending: true })
        .limit(300)

      if (status === 'active') query = query.in('status', ['scheduled', 'notified'])
      else if (status) query = query.eq('status', status)
      else query = query.in('status', ['scheduled', 'notified'])

      if (branch && branch !== 'all') query = query.eq('branch_slug', branch)
      else if (!canSeeAllBranches(staff.role) && staff.branch_slugs?.length) {
        query = query.in('branch_slug', staff.branch_slugs)
      }

      const { data, error } = await query
      if (error) return json(res, 400, { error: error.message })

      const { data: services } = await db
        .from('services')
        .select('id, slug, name')
        .in(
          'slug',
          DETAILING_SCHEDULE_TYPES.map((t) => t.slug),
        )

      const { data: settings } = await db
        .from('notification_settings')
        .select('id, scope, service_id, branch_slug, channel, frequency_months, enabled, title, message')
        .eq('enabled', true)

      return json(res, 200, {
        schedules: sortMaintenanceSchedules(data || []),
        types: DETAILING_SCHEDULE_TYPES,
        services: services || [],
        settings: settings || [],
        canWrite: WRITE_ROLES.has(staff.role),
        canEditTypes: TYPE_ROLES.has(staff.role),
      })
    }

    if (req.method === 'PUT') {
      if (!TYPE_ROLES.has(staff.role)) return json(res, 403, { error: 'Only Super Admin can set type intervals' })
      const body = await readJsonBody(req)
      const types = Array.isArray(body.types) ? body.types : []
      if (!types.length) return json(res, 400, { error: 'types required' })

      const { data: services } = await db.from('services').select('id, slug')
      const bySlug = new Map((services || []).map((s) => [String(s.slug || '').toLowerCase(), s]))
      const saved = []

      for (const row of types) {
        const slug = String(row.slug || '').toLowerCase()
        const meta = DETAILING_SCHEDULE_TYPES.find((t) => t.slug === slug)
        if (!meta) continue
        const svc = bySlug.get(slug)
        if (!svc?.id) continue
        const months = Math.min(24, Math.max(1, Number(row.frequency_months) || meta.defaultMonths))
        const channel = ['push', 'sms', 'both'].includes(row.channel) ? row.channel : 'both'

        await db.from('notification_settings').delete().eq('scope', 'per_service').eq('service_id', svc.id)
        const { data: inserted, error } = await db
          .from('notification_settings')
          .insert({
            scope: 'per_service',
            service_id: svc.id,
            branch_slug: null,
            channel,
            frequency_months: months,
            enabled: true,
            title: row.title || null,
            message: row.message || null,
            updated_at: new Date().toISOString(),
          })
          .select('id, scope, service_id, frequency_months, channel')
          .maybeSingle()
        if (error) return json(res, 400, { error: error.message })
        saved.push(inserted)
      }

      return json(res, 200, { ok: true, saved })
    }

    if (req.method === 'PATCH') {
      if (!WRITE_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })
      const body = await readJsonBody(req)
      const id = body.id
      if (!id) return json(res, 400, { error: 'id required' })

      const { data: existing, error: loadErr } = await db
        .from('vehicle_maintenance_schedules')
        .select(SELECT_COLS)
        .eq('id', id)
        .maybeSingle()
      if (loadErr) return json(res, 400, { error: loadErr.message })
      if (!existing) return json(res, 404, { error: 'Schedule not found' })

      if (
        !canSeeAllBranches(staff.role) &&
        existing.branch_slug &&
        staff.branch_slugs?.length &&
        !staff.branch_slugs.includes(existing.branch_slug)
      ) {
        return json(res, 403, { error: 'Outside your branch scope' })
      }

      const patch = { updated_at: new Date().toISOString() }

      if (body.action === 'bump') {
        const months = Math.min(24, Math.max(1, Number(body.months) || 6))
        const from = coatedAtDateOnly(existing.last_maintenance_at || existing.coated_at || new Date())
        patch.next_due_at = addMonthsDateOnly(from, months)
        patch.status = 'scheduled'
      } else if (body.status === 'cancelled') {
        patch.status = 'cancelled'
        if (body.notes) patch.notes = String(body.notes).slice(0, 500)
      } else if (body.status === 'scheduled') {
        patch.status = 'scheduled'
      }

      if (body.next_due_at) {
        const due = String(body.next_due_at).slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return json(res, 400, { error: 'next_due_at must be YYYY-MM-DD' })
        patch.next_due_at = due
        if (!body.status) patch.status = 'scheduled'
      }

      if (body.customer_phone != null) patch.customer_phone = String(body.customer_phone).trim() || null
      if (body.customer_name != null) patch.customer_name = String(body.customer_name).trim() || null
      if (body.plate_number != null) {
        patch.plate_number = String(body.plate_number).trim() || null
        patch.plate_normalized = normalizeMaintPlate(body.plate_number)
      }

      const { data: updated, error } = await db
        .from('vehicle_maintenance_schedules')
        .update(patch)
        .eq('id', id)
        .select(SELECT_COLS)
        .maybeSingle()
      if (error) return json(res, 400, { error: error.message })
      return json(res, 200, { ok: true, schedule: updated })
    }

    if (req.method === 'POST') {
      if (!WRITE_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })
      const body = await readJsonBody(req)
      const id = body.id
      if (!id) return json(res, 400, { error: 'id required' })

      const { data: row, error: loadErr } = await db
        .from('vehicle_maintenance_schedules')
        .select(SELECT_COLS)
        .eq('id', id)
        .maybeSingle()
      if (loadErr) return json(res, 400, { error: loadErr.message })
      if (!row) return json(res, 404, { error: 'Schedule not found' })

      const result = await sendPaintMaintenanceReminder({
        db,
        row,
        force: Boolean(body.force),
        markNotified: true,
      })
      if (!result.ok) return json(res, 400, { error: result.error || 'Send failed', detail: result })
      return json(res, 200, { ok: true, notify: result })
    }

    return json(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    console.error('[maintenance-schedules]', err)
    return json(res, 500, { error: String(err?.message || err) })
  }
}
