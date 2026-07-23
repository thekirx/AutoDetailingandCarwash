import { supabase } from '../lib/supabase'
import {
  ACTIVE_QUEUE_STATUSES,
  formatQueueActionError,
  getBranchScope,
  getCrewAttendanceModel,
  MISSING_QUEUE_PROFILE_ERROR,
  normalizePlate,
  normalizeVehicleType,
  parsePesoInputToMinor,
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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

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

export async function getCurrentProfile({ required = true } = {}) {
  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError) throw formatQueueActionError(userError)

  const user = userResult?.user
  if (!user) {
    if (!required) return null
    throw new Error('You must be logged in to perform this queue action.')
  }

  // staff_profiles is source of truth for ops users (ponytail: do not require dual customers row)
  const { data: staffProfile, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, phone, is_active')
    .eq('id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (staffError) {
    console.error('Unable to load staff profile', staffError)
    throw formatQueueActionError(staffError)
  }
  if (staffProfile) {
    return {
      id: staffProfile.id,
      full_name: staffProfile.full_name,
      email: user.email,
      phone: staffProfile.phone,
      role: staffProfile.role,
      branch_slug: staffProfile.branch_slug,
      source: 'staff_profiles',
    }
  }

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, role, is_archived')
    .eq('id', user.id)
    .eq('is_archived', false)
    .maybeSingle()

  if (error) {
    console.error('Unable to load current queue profile', error)
    throw formatQueueActionError(error)
  }
  if (!data && required) throw new Error(MISSING_QUEUE_PROFILE_ERROR)
  return data ? { ...data, branch_slug: null, source: 'customers' } : null
}

export async function fetchOperationsSnapshot(profile) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { queue: [], activeQueue: [], staffPool: [], availableStaff: [], busyStaff: [], events: [], handoffs: [] }
  }

  const branchScope = getBranchScope(profile)
  const queueQuery = scopedQuery(supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT), branchScope)
  const staffPoolQuery = scopedStaffQuery(
    supabase
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug, phone, is_active')
      .eq('role', 'staff')
      .eq('is_active', true),
    branchScope,
  )
  const attendanceQuery = branchScope
    ? supabase.from('staff_attendance').select('id, staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at').eq('attendance_date', getTodayDate()).eq('branch_slug', branchScope)
    : supabase.from('staff_attendance').select('id, staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at').eq('attendance_date', getTodayDate())
  const busyQuery = branchScope
    ? supabase.from('busy_staff_view').select('staff_id, full_name, branch_slug, booking_id, queue_number, booking_status, assigned_at').eq('branch_slug', branchScope)
    : supabase.from('busy_staff_view').select('staff_id, full_name, branch_slug, booking_id, queue_number, booking_status, assigned_at')
  const eventsQuery = scopedQuery(supabase.from('queue_events').select('id, booking_id, branch, old_status, new_status, notes, created_at'), branchScope)
  const handoffsQuery = scopedQuery(supabase.from('pos_handoffs').select('id, booking_id, branch, amount_minor, status, handed_off_at'), branchScope)

  const [queue, staffPool, attendance, busyStaff, events, handoffs] = await Promise.all([
    queueQuery.order('created_at', { ascending: false }),
    staffPoolQuery.order('full_name'),
    attendanceQuery,
    busyQuery.order('assigned_at', { ascending: false }),
    eventsQuery.order('created_at', { ascending: false }).limit(8),
    handoffsQuery.order('handed_off_at', { ascending: false }).limit(8),
  ])

  const attendanceRows = attendance.error ? [] : attendance.data || []
  if (attendance.error) console.warn('Staff attendance unavailable; apply staff attendance migration to enable daily attendance.', attendance.error)
  const error = queue.error || staffPool.error || busyStaff.error || events.error || handoffs.error
  if (error) throw error
  const crewModel = getCrewAttendanceModel({
    staffPool: staffPool.data || [],
    attendance: attendanceRows,
    busyStaff: busyStaff.data || [],
  })

  return {
    queue: queue.data || [],
    activeQueue: (queue.data || []).filter((ticket) => ACTIVE_QUEUE_STATUSES.includes(ticket.status)),
    staffPool: crewModel.staffPool,
    availableStaff: crewModel.availableStaff,
    busyStaff: crewModel.busyStaff,
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
  const attendanceQuery = branchScope
    ? supabase.from('staff_attendance').select('staff_id, branch_slug, attendance_date, status').eq('attendance_date', getTodayDate()).eq('branch_slug', branchScope).eq('status', 'present')
    : supabase.from('staff_attendance').select('staff_id, branch_slug, attendance_date, status').eq('attendance_date', getTodayDate()).eq('status', 'present')
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
  const attendanceResult = await attendanceQuery
  if (attendanceResult.error) {
    console.warn('Staff attendance unavailable for ticket staff picker', attendanceResult.error)
    return { ticket: ticketResult.data, assignments: assignmentsResult.data || [], staff: [] }
  }
  const presentIds = new Set((attendanceResult.data || []).map((row) => row.staff_id))
  return {
    ticket: ticketResult.data,
    assignments: assignmentsResult.data || [],
    staff: (staffResult.data || []).filter((member) => presentIds.has(member.id)),
  }
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

export async function addStaffMember(form, profile) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug = profile?.role === 'BossMich' ? form.branch_slug : getBranchScope(profile)
  if (!branchSlug) throw new Error('Your Team Lead account has no assigned branch. Please contact BossMich.')

  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({
      full_name: form.full_name.trim(),
      role: 'staff',
      branch_slug: branchSlug,
      phone: form.phone?.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Unable to add staff member', error)
    throw formatQueueActionError(error)
  }

  const { error: attendanceError } = await supabase
    .from('staff_attendance')
    .upsert({
      staff_id: data.id,
      branch_slug: branchSlug,
      attendance_date: getTodayDate(),
      status: form.present_today ? 'present' : 'absent',
      checked_in_at: form.present_today ? new Date().toISOString() : null,
      checked_out_at: form.present_today ? null : new Date().toISOString(),
      marked_by: currentProfile.id,
    }, { onConflict: 'staff_id,attendance_date' })

  if (attendanceError) {
    console.error('Unable to mark new staff attendance', attendanceError)
    throw formatQueueActionError(attendanceError)
  }

  return data
}

export async function setStaffAttendance(member, status, profile) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug = member.branch_slug || getBranchScope(profile)
  if (!branchSlug) throw new Error('Staff member has no assigned branch.')
  const present = status === 'present'

  const { error } = await supabase
    .from('staff_attendance')
    .upsert({
      staff_id: member.id || member.staff_id,
      branch_slug: branchSlug,
      attendance_date: getTodayDate(),
      status: present ? 'present' : 'absent',
      checked_in_at: present ? new Date().toISOString() : member.attendance?.checked_in_at || null,
      checked_out_at: present ? null : new Date().toISOString(),
      marked_by: currentProfile.id,
    }, { onConflict: 'staff_id,attendance_date' })

  if (error) {
    console.error('Unable to update staff attendance', error)
    throw formatQueueActionError(error)
  }
}

export async function updateCrewStaffMember(memberId, { full_name, phone }) {
  const name = String(full_name || '').trim()
  if (!memberId) throw new Error('Staff id is required.')
  if (!name) throw new Error('Staff name is required.')
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({
      full_name: name,
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('role', 'staff')
    .select('id')
    .maybeSingle()
  if (error) throw formatQueueActionError(error)
  if (!data) throw new Error('Staff member not found or not editable.')
  return data
}

export async function deactivateCrewStaffMember(memberId) {
  if (!memberId) throw new Error('Staff id is required.')
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({
      is_active: false,
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('role', 'staff')
    .select('id')
    .maybeSingle()
  if (error) throw formatQueueActionError(error)
  if (!data) throw new Error('Staff member not found or not editable.')
  return data
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
  const phone = form.customer_phone?.trim()
  if (!phone) throw new Error('Phone number is required.')
  const first = form.customer_first_name?.trim() || ''
  const last = form.customer_last_name?.trim() || ''
  const fullName = form.customer_name?.trim() || `${first} ${last}`.trim()
  if (!fullName) throw new Error('Customer name is required.')

  // Provision auth account (set-password invite) via server — creates customers row + notifies
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('You must be signed in to create a queue ticket.')

  const response = await fetch('/api/provision-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      customer_id: form.customer_id || null,
      customer_phone: phone,
      customer_first_name: first,
      customer_last_name: last,
      customer_name: fullName,
      customer_email: form.customer_email?.trim() || null,
      vehicle_plate: form.vehicle_plate || null,
      site_origin: window.location.origin,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to create customer account.')
  return payload.customer_id
}

export async function createQueueTicket(form) {
  if (!form.branch) throw new Error('Your Team Lead account has no assigned branch. Please contact an admin.')
  const profile = await getCurrentProfile({ required: true })
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
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
        color: form.vehicle_color?.trim() || null,
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
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
        color: form.vehicle_color?.trim() || null,
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
      ? parsePesoInputToMinor(form.final_price)
      : service?.price_minor || 0
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_id: form.service_id,
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email?.trim() || null,
      customer_phone: form.customer_phone.trim(),
      vehicle_make: form.vehicle_make.trim(),
      vehicle_model: form.vehicle_model.trim(),
      vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
      vehicle_plate: form.vehicle_plate.trim().toUpperCase() || null,
      vehicle_type: vehicleType,
      scheduled_start: new Date().toISOString(),
      branch: form.branch,
      status: 'waiting',
      created_by: form.created_by,
      team_lead_id: profile.id,
      waiting_at: new Date().toISOString(),
      notes: form.notes?.trim() || null,
      final_price_minor: finalPriceMinor,
      price_minor: finalPriceMinor,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Unable to create queue ticket', error)
    throw formatQueueActionError(error)
  }
  // Best-effort SMS / push — never fail ticket create
  try {
    await notifyBookingClient(data.id, 'waiting')
  } catch {
    /* ignore */
  }
  return data
}

async function notifyBookingClient(bookingId, status) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token || !bookingId) return null
  const res = await fetch('/api/notify-booking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ booking_id: bookingId, status }),
  })
  return res.json().catch(() => ({}))
}

export async function updateTicketStatus(ticket, nextStatus) {
  const profile = await getCurrentProfile({ required: false })
  const now = new Date().toISOString()
  const patch = { status: nextStatus }
  if (nextStatus === 'waiting') patch.waiting_at = now
  if (nextStatus === 'in_progress') {
    patch.in_progress_at = now
    if (!ticket.actual_start) patch.actual_start = now
  }
  if (nextStatus === 'final_checking') {
    patch.final_checking_at = now
    if (profile?.id) patch.final_checked_by = profile.id
  }
  if (nextStatus === 'for_payment') patch.for_payment_at = now
  if (nextStatus === 'completed') patch.completed_at = now
  if (nextStatus === 'cancelled') patch.cancelled_at = now

  const { error } = await supabase.from('bookings').update(patch).eq('id', ticket.booking_id)
  if (error) {
    console.error('Unable to update queue ticket status', error)
    throw formatQueueActionError(error)
  }
  try {
    await notifyBookingClient(ticket.booking_id, nextStatus)
  } catch {
    /* ignore */
  }
}

export async function updateTicketPrice(ticket, amountMinor, reason, userId) {
  await getCurrentProfile({ required: true })
  const { error } = await supabase
    .from('bookings')
    .update({
      final_price_minor: Number(amountMinor),
      price_minor: Number(amountMinor),
      price_edit_reason: reason?.trim() || null,
      price_edited_by: userId,
    })
    .eq('id', ticket.booking_id)
  if (error) {
    console.error('Unable to update queue ticket price', error)
    throw formatQueueActionError(error)
  }
}

export async function assignStaff(ticket, staffIds, userId) {
  await getCurrentProfile({ required: true })
  const selected = new Set(staffIds)
  const { data: existing, error: existingError } = await supabase
    .from('queue_assignments')
    .select('id, staff_id, status')
    .eq('booking_id', ticket.booking_id)

  if (existingError) {
    console.error('Unable to load existing queue assignments', existingError)
    throw formatQueueActionError(existingError)
  }

  const activeExisting = existing || []
  const toRelease = activeExisting.filter((assignment) => assignment.status === 'active' && !selected.has(assignment.staff_id)).map((assignment) => assignment.id)
  if (toRelease.length) {
    const { error } = await supabase
      .from('queue_assignments')
      .update({ status: 'released', released_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .in('id', toRelease)
    if (error) {
      console.error('Unable to release queue assignments', error)
      throw formatQueueActionError(error)
    }
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
    if (error) {
      console.error('Unable to insert queue assignments', error)
      throw formatQueueActionError(error)
    }
  }

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ assigned_staff_id: staffIds[0] || null })
    .eq('id', ticket.booking_id)

  if (bookingError) {
    console.error('Unable to update assigned queue staff', bookingError)
    throw formatQueueActionError(bookingError)
  }
}

export async function sendTicketToPayment(bookingId) {
  await getCurrentProfile({ required: true })
  const { data, error } = await supabase.rpc('send_queue_ticket_to_payment', { input_booking_id: bookingId })
  if (error) {
    console.error('Unable to send queue ticket to payment', error)
    throw formatQueueActionError(error)
  }
  try {
    await notifyBookingClient(bookingId, 'for_payment')
  } catch {
    /* ignore */
  }
  return data
}
