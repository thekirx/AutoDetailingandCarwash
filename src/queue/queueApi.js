import { supabase } from '../lib/supabase'
import {
  ACTIVE_QUEUE_STATUSES,
  getBranchScope,
  normalizePlate,
  normalizeVehicleType,
  requiresTeamLeadBranchSetup,
} from './queueLogic'

export const QUEUE_BOARD_SELECT = `
  booking_id,
  branch,
  queue_number,
  queue_date,
  status,
  customer_id,
  vehicle_id,
  customer_name,
  customer_phone,
  customer_email,
  vehicle_plate,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  vehicle_type,
  service_id,
  service_name,
  base_price_minor,
  final_price_minor,
  assigned_staff_id,
  assigned_staff_name,
  scheduled_start,
  scheduled_end,
  estimated_start,
  estimated_end,
  actual_start,
  actual_end,
  created_at,
  notes
`

export function formatMoney(minor) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((minor || 0) / 100)
}

function scopedQuery(query, branchScope) {
  return branchScope ? query.eq('branch', branchScope) : query
}

function scopedStaffQuery(query, branchScope) {
  return branchScope ? query.eq('branch_slug', branchScope) : query
}

export async function fetchOperationsSnapshot(profile) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { queue: [], activeQueue: [], availableStaff: [], busyStaff: [], events: [], handoffs: [] }
  }

  const branchScope = getBranchScope(profile)
  const queueQuery = scopedQuery(supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT), branchScope)
  const busyQuery = branchScope
    ? supabase.from('busy_staff_view').select('staff_id, full_name, branch_slug, booking_id, queue_number, booking_status, assigned_at').eq('branch_slug', branchScope)
    : supabase.from('busy_staff_view').select('staff_id, full_name, branch_slug, booking_id, queue_number, booking_status, assigned_at')
  const eventsQuery = scopedQuery(supabase.from('queue_events').select('id, booking_id, branch, old_status, new_status, notes, created_at'), branchScope)
  const handoffsQuery = scopedQuery(supabase.from('pos_handoffs').select('id, booking_id, branch, amount_minor, status, handed_off_at'), branchScope)

  const [queue, availableStaff, busyStaff, events, handoffs] = await Promise.all([
    queueQuery.order('created_at', { ascending: false }),
    scopedStaffQuery(supabase.from('available_staff_view').select('staff_id, full_name, role, branch_slug, phone'), branchScope).order('full_name'),
    busyQuery.order('assigned_at', { ascending: false }),
    eventsQuery.order('created_at', { ascending: false }).limit(8),
    handoffsQuery.order('handed_off_at', { ascending: false }).limit(8),
  ])

  const error = queue.error || availableStaff.error || busyStaff.error || events.error || handoffs.error
  if (error) throw error

  return {
    queue: queue.data || [],
    activeQueue: (queue.data || []).filter((ticket) => ACTIVE_QUEUE_STATUSES.includes(ticket.status)),
    availableStaff: availableStaff.data || [],
    busyStaff: busyStaff.data || [],
    events: events.data || [],
    handoffs: handoffs.data || [],
  }
}

export async function fetchTicket(bookingId, profile) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { ticket: null, assignments: [], staff: [] }
  }

  const branchScope = getBranchScope(profile)
  const ticketQuery = supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT).eq('booking_id', bookingId)
  const staffQuery = supabase.from('staff_profiles').select('id, full_name, role, branch_slug, is_active').eq('role', 'staff').eq('is_active', true)
  const [ticketResult, assignmentsResult, staffResult] = await Promise.all([
    (branchScope ? ticketQuery.eq('branch', branchScope) : ticketQuery).maybeSingle(),
    supabase
      .from('queue_assignments')
      .select('id, booking_id, staff_id, assigned_by, task_name, task_notes, started_at, completed_at, released_at, status, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
    scopedStaffQuery(staffQuery, branchScope).order('full_name'),
  ])

  const error = ticketResult.error || assignmentsResult.error || staffResult.error
  if (error) throw error
  return { ticket: ticketResult.data, assignments: assignmentsResult.data || [], staff: staffResult.data || [] }
}

export async function fetchServices() {
  const services = await supabase.from('services').select('id, name, price_minor, duration_minutes').eq('is_active', true).eq('is_archived', false).order('display_order')
  const error = services.error
  if (error) throw error
  return services.data || []
}

export async function fetchBranches() {
  const { data, error } = await supabase.from('branches').select('slug, name').eq('is_active', true).order('name')
  if (error) throw error
  return data || []
}

export async function lookupPlate(plateNumber, profile) {
  const normalizedPlate = normalizePlate(plateNumber || '')
  if (normalizedPlate.length < 2) return null
  if (requiresTeamLeadBranchSetup(profile)) return null
  const { data, error } = await supabase
    .from('customer_vehicle_masterlist')
    .select('vehicle_id, customer_id, plate_number, normalized_plate_number, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_type, last_branch, total_visits')
    .eq('normalized_plate_number', normalizedPlate)
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

async function ensureCustomer(form) {
  if (form.customer_id) return form.customer_id
  const { data, error } = await supabase
    .from('customers')
    .insert({
      role: 'customer',
      full_name: form.customer_name.trim(),
      phone: form.customer_phone.trim(),
      email: null,
      is_archived: false,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function createQueueTicket(form) {
  if (!form.branch) throw new Error('Your Team Lead account has no assigned branch. Please contact an admin.')
  const customerId = await ensureCustomer(form)
  let vehicleId = form.vehicle_id || null
  const normalizedPlate = normalizePlate(form.vehicle_plate || '')
  const vehicleType = normalizeVehicleType(form.vehicle_type)

  if (vehicleId) {
    const { error: attachError } = await supabase
      .from('vehicles')
      .update({
        customer_id: customerId,
        vehicle_make: form.vehicle_make.trim(),
        vehicle_model: form.vehicle_model.trim(),
        vehicle_type: vehicleType,
        last_branch: form.branch,
      })
      .eq('id', vehicleId)
    if (attachError) throw attachError
  }

  if (!vehicleId && normalizedPlate) {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .upsert({
        customer_id: customerId,
        plate_number: form.vehicle_plate.trim().toUpperCase(),
        normalized_plate_number: normalizedPlate,
        vehicle_make: form.vehicle_make.trim(),
        vehicle_model: form.vehicle_model.trim(),
        vehicle_type: vehicleType,
        last_branch: form.branch,
      }, { onConflict: 'normalized_plate_number' })
      .select('id')
      .single()

    if (vehicleError) throw vehicleError
    vehicleId = vehicle.id
  }

  const service = form.services.find((item) => item.id === form.service_id)
  const finalPriceMinor = form.final_price_minor
    ? Number(form.final_price_minor)
    : form.final_price
      ? Math.round(Number(form.final_price) * 100)
      : service?.price_minor || 0
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_id: form.service_id,
      customer_name: form.customer_name.trim(),
      customer_email: null,
      customer_phone: form.customer_phone.trim(),
      vehicle_make: form.vehicle_make.trim(),
      vehicle_model: form.vehicle_model.trim(),
      vehicle_year: null,
      vehicle_plate: form.vehicle_plate.trim().toUpperCase() || null,
      vehicle_type: vehicleType,
      scheduled_start: new Date().toISOString(),
      branch: form.branch,
      status: 'waiting',
      created_by: form.created_by,
      notes: form.notes?.trim() || null,
      final_price_minor: finalPriceMinor,
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function updateTicketStatus(ticket, nextStatus) {
  const patch = { status: nextStatus }
  if (nextStatus === 'in_progress' && !ticket.actual_start) patch.actual_start = new Date().toISOString()
  const { error } = await supabase.from('bookings').update(patch).eq('id', ticket.booking_id)
  if (error) throw error
}

export async function updateTicketPrice(ticket, amountMinor, reason, userId) {
  const { error } = await supabase
    .from('bookings')
    .update({
      final_price_minor: Number(amountMinor),
      price_edit_reason: reason?.trim() || null,
      price_edited_by: userId,
    })
    .eq('id', ticket.booking_id)
  if (error) throw error
}

export async function assignStaff(ticket, staffIds, userId) {
  const selected = new Set(staffIds)
  const { data: existing, error: existingError } = await supabase
    .from('queue_assignments')
    .select('id, staff_id, status')
    .eq('booking_id', ticket.booking_id)

  if (existingError) throw existingError

  const activeExisting = existing || []
  const toRelease = activeExisting.filter((assignment) => assignment.status === 'active' && !selected.has(assignment.staff_id)).map((assignment) => assignment.id)
  if (toRelease.length) {
    const { error } = await supabase
      .from('queue_assignments')
      .update({ status: 'released', released_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .in('id', toRelease)
    if (error) throw error
  }

  const activeIds = new Set(activeExisting.filter((assignment) => assignment.status === 'active').map((assignment) => assignment.staff_id))
  const inserts = staffIds
    .filter((staffId) => !activeIds.has(staffId))
    .map((staffId) => ({
      booking_id: ticket.booking_id,
      staff_id: staffId,
      assigned_by: userId,
      task_name: ticket.service_name || 'Queue service',
      status: 'active',
      started_at: ticket.status === 'in_progress' ? new Date().toISOString() : null,
    }))

  if (inserts.length) {
    const { error } = await supabase.from('queue_assignments').insert(inserts)
    if (error) throw error
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ assigned_staff_id: staffIds[0] || null })
    .eq('id', ticket.booking_id)

  if (bookingError) throw bookingError
}

export async function sendTicketToPayment(bookingId) {
  const { data, error } = await supabase.rpc('send_queue_ticket_to_payment', { input_booking_id: bookingId })
  if (error) throw error
  return data
}
