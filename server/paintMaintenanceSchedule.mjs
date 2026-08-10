/**
 * Deep module: one active paint-maintenance schedule per plate.
 * Ceramic / PPF enroll; Paint Maintenance resets the 6-month clock. No duplicate rows.
 */
import {
  PAINT_MAINTENANCE_PROGRAM,
  PAINT_MAINTENANCE_SLUG,
  addMonthsDateOnly,
  coatedAtDateOnly,
  normalizeMaintPlate,
  paintMaintenanceActionForSlug,
} from '../src/lib/paintMaintenance.js'

async function resolveFrequencyMonths(db, serviceId, branchSlug) {
  const { data: rows } = await db
    .from('notification_settings')
    .select('scope, service_id, branch_slug, frequency_months, enabled')
    .eq('enabled', true)

  const list = rows || []
  const match =
    list.find((s) => s.scope === 'per_service_branch' && s.service_id === serviceId && s.branch_slug === branchSlug) ||
    list.find((s) => s.scope === 'per_service' && s.service_id === serviceId) ||
    list.find((s) => s.scope === 'per_branch' && s.branch_slug === branchSlug) ||
    list.find((s) => s.scope === 'whole') ||
    null
  const months = Number(match?.frequency_months)
  return Number.isFinite(months) && months >= 1 ? months : 6
}

async function findActiveSchedule(db, plateNormalized) {
  const { data } = await db
    .from('vehicle_maintenance_schedules')
    .select('id, coated_at, service_slug')
    .eq('plate_normalized', plateNormalized)
    .eq('program_key', PAINT_MAINTENANCE_PROGRAM)
    .in('status', ['scheduled', 'notified'])
    .maybeSingle()
  return data || null
}

async function lookupVehicleId(db, customerId, plate) {
  if (!customerId || !plate) return null
  const norm = String(plate).toLowerCase().replace(/\s+/g, '')
  const { data } = await db
    .from('vehicles')
    .select('id')
    .eq('customer_id', customerId)
    .eq('normalized_plate_number', norm)
    .maybeSingle()
  return data?.id || null
}

/**
 * After Successful Release: enroll (Ceramic/PPF) or reset (Paint Maintenance).
 * Idempotent — never creates a second active schedule for the same plate + program.
 */
export async function applyPaintMaintenanceOnComplete(db, booking) {
  if (!booking?.id) return { skipped: true, reason: 'no_booking' }

  const { data: svc } = await db
    .from('services')
    .select('id, slug, pay_category, name')
    .eq('id', booking.service_id)
    .maybeSingle()
  if (!svc) return { skipped: true, reason: 'no_service' }

  const action = paintMaintenanceActionForSlug(svc.slug)
  if (!action) return { skipped: true, reason: 'not_paint_program' }

  const plateNormalized = normalizeMaintPlate(booking.vehicle_plate)
  if (!plateNormalized) return { skipped: true, reason: 'no_plate' }

  const frequencyMonths = await resolveFrequencyMonths(db, svc.id, booking.branch || null)
  const eventDate = coatedAtDateOnly(booking.completed_at || new Date())
  const nextDue = addMonthsDateOnly(eventDate, frequencyMonths)
  const vehicleId = await lookupVehicleId(db, booking.customer_id, booking.vehicle_plate)
  const existing = await findActiveSchedule(db, plateNormalized)

  const base = {
    vehicle_id: vehicleId,
    customer_id: booking.customer_id || null,
    booking_id: booking.id,
    service_slug: action === 'reset' ? PAINT_MAINTENANCE_SLUG : svc.slug,
    plate_number: booking.vehicle_plate || null,
    plate_normalized: plateNormalized,
    program_key: PAINT_MAINTENANCE_PROGRAM,
    customer_phone: booking.customer_phone || null,
    customer_name: booking.customer_name || null,
    last_maintenance_at: eventDate,
    next_due_at: nextDue,
    branch_slug: booking.branch || null,
    status: 'scheduled',
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await db
      .from('vehicle_maintenance_schedules')
      .update({
        ...base,
        // Keep original coated_at on reset; refresh on re-enroll.
        coated_at: action === 'reset' ? existing.coated_at || eventDate : eventDate,
      })
      .eq('id', existing.id)
    if (error) {
      console.warn('[paint-maint] update failed', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, action, mode: 'update', id: existing.id, next_due_at: nextDue }
  }

  const { data: inserted, error } = await db
    .from('vehicle_maintenance_schedules')
    .insert({ ...base, coated_at: eventDate })
    .select('id')
    .maybeSingle()

  if (error) {
    // Unique race: another worker inserted — fetch and update.
    if (String(error.message || '').includes('vehicle_maint_active_plate_program')) {
      const raced = await findActiveSchedule(db, plateNormalized)
      if (raced) {
        await db
          .from('vehicle_maintenance_schedules')
          .update({ ...base, coated_at: action === 'reset' ? raced.coated_at || eventDate : eventDate })
          .eq('id', raced.id)
        return { ok: true, action, mode: 'race_update', id: raced.id, next_due_at: nextDue }
      }
    }
    console.warn('[paint-maint] insert failed', error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true, action, mode: 'insert', id: inserted?.id, next_due_at: nextDue }
}
