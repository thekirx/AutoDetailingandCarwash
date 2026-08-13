import { supabase } from '../lib/supabase'
import { getAccessTokenFresh } from '../lib/authToken'
import {
  aggregateDailySalesSummary,
  canCancelQueueStatus,
  canTransitionQueueStatus,
  crewRequiredForPayCategory,
  DEFAULT_TIMING_WARNINGS,
  getAdminOverrideTargets,
  getOpsBoardStatuses,
  isActiveQueueStatus,
  REDO_FROM_STATUSES,
  STATUS_LABELS,
  formatQueueActionError,
  getBranchScope,
  getBranchScopeFilter,
  getCrewAttendanceModel,
  MISSING_QUEUE_PROFILE_ERROR,
  NO_BRANCH_SCOPE,
  normalizePlate,
  normalizeVehicleType,
  parsePesoInputToMinor,
  requiresTeamLeadBranchSetup,
  resolveBranchFilter,
  validateCancellationReason,
  validateCrewUsername,
} from './queueLogic'
import { writeAudit } from '../lib/audit'
import { splitFloorBoardLanes, sumFloorLaneCounts } from '../lib/floorBoardLanes'
import { resolveServicePriceMinor } from '../lib/servicePricing'
import { createTtlCache } from '../lib/coalesceReload'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import { isDetailingPayCategory, isTicketOnTodayFloor } from '../lib/serviceKinds'
import { aggregateSalesFinancials } from '../lib/paymentMethods'
import { buildAdminRoster } from '../lib/floorBoardRoster'
import { averageCycleMinutes, failedQaCount, totalWaitMinutes } from '../lib/kpiPart8'
import {
  resolveQueueCustomerDisplayName,
  validateQueueTicketIdentity,
} from '../lib/queueCustomerName'
import { collectPaged } from '../lib/crmInsights'

const timingWarningsCache = createTtlCache(120_000)

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
  notes,
  visit_group_id,
  in_progress_at,
  final_checking_at,
  redo_at,
  redo_reason,
  service_pay_category
`

function getTodayDate() {
  return getLocalCalendarDate()
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
  if (!branchScope) return query
  if (Array.isArray(branchScope)) return query.in('branch', branchScope)
  return query.eq('branch', branchScope)
}

function scopedStaffQuery(query, branchScope) {
  if (!branchScope) return query
  if (Array.isArray(branchScope)) return query.in('branch_slug', branchScope)
  return query.eq('branch_slug', branchScope)
}

async function collectScoped(buildQuery, pageSize = 1000) {
  return collectPaged(async (from, to) => {
    const { data, error } = await buildQuery().range(from, to)
    if (error) throw error
    return data || []
  }, pageSize)
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

export async function fetchOperationsSnapshot(profile, { branchFilter = 'all', family = 'wash' } = {}) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { queue: [], activeQueue: [], staffPool: [], availableStaff: [], busyStaff: [], events: [], handoffs: [], timingWarnings: DEFAULT_TIMING_WARNINGS }
  }

  const branchScope = resolveBranchFilter(profile, branchFilter)
  // Active floor only — keeps TL/ASA snapshot payloads small under concurrent load.
  // Lanes are role-aware: TL never fetches for_payment; console tier does.
  // Detailing family includes confirmed (Assigned to Branch from Bookings).
  const boardStatuses = getOpsBoardStatuses(profile, { family })
  const queueQuery = scopedQuery(
    supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT).in('status', boardStatuses),
    branchScope,
  )
  const staffPoolQuery = scopedStaffQuery(
    supabase
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug, phone, is_active, username, login_email')
      .eq('role', 'staff')
      .eq('is_active', true),
    branchScope,
  )
  let attendanceQuery = supabase
    .from('staff_attendance')
    .select('id, staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at')
    .eq('attendance_date', getTodayDate())
  attendanceQuery = scopedStaffQuery(attendanceQuery, branchScope)
  let busyQuery = supabase
    .from('busy_staff_view')
    .select('staff_id, full_name, branch_slug, booking_id, queue_number, booking_status, assigned_at')
  busyQuery = scopedStaffQuery(busyQuery, branchScope)
  const eventsQuery = scopedQuery(supabase.from('queue_events').select('id, booking_id, branch, old_status, new_status, notes, created_at'), branchScope)
  const handoffsQuery = scopedQuery(supabase.from('pos_handoffs').select('id, booking_id, branch, amount_minor, status, handed_off_at'), branchScope)

  const cachedTiming = timingWarningsCache.get()
  const settingsQuery = cachedTiming
    ? Promise.resolve({ data: { value: cachedTiming }, error: null })
    : supabase.from('app_settings').select('value').eq('key', 'queue_timing_warnings').maybeSingle()

  const [queue, staffPool, attendance, busyStaff, events, handoffs, settings] = await Promise.all([
    queueQuery.order('created_at', { ascending: false }).limit(250),
    staffPoolQuery.order('full_name'),
    attendanceQuery,
    busyQuery.order('assigned_at', { ascending: false }).limit(200),
    eventsQuery.order('created_at', { ascending: false }).limit(40),
    handoffsQuery.order('handed_off_at', { ascending: false }).limit(40),
    settingsQuery,
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

  const timingValue = settings.data?.value && typeof settings.data.value === 'object' ? settings.data.value : null
  if (timingValue && !cachedTiming) timingWarningsCache.set(timingValue)

  const timingWarnings = {
    ...DEFAULT_TIMING_WARNINGS,
    ...(timingValue || cachedTiming || {}),
  }

  const today = getTodayDate()
  const queueRows = queue.data || []
  // Same-day services/packages: waiting tickets from prior days drop off the floor.
  // Detailing (and started work) stay until finished.
  const activeQueue = queueRows.filter(
    (ticket) => boardStatuses.includes(ticket.status) && isTicketOnTodayFloor(ticket, today),
  )

  return {
    queue: queueRows,
    activeQueue,
    staffPool: crewModel.staffPool,
    availableStaff: crewModel.availableStaff,
    busyStaff: crewModel.busyStaff,
    absentStaff: crewModel.absentStaff || [],
    presentCount: crewModel.presentCount || 0,
    availableCount: crewModel.availableCount ?? (crewModel.availableStaff?.length || 0),
    absentCount: crewModel.absentCount ?? 0,
    onBayCount: crewModel.onBayCount ?? (crewModel.busyStaff?.length || 0),
    events: events.data || [],
    handoffs: handoffs.data || [],
    timingWarnings,
  }
}

/**
 * Team Lead Queue Manager day board: active floor lanes + same-day completed/cancelled
 * for status tiles, peso totals, and plate history (legacy QueueList port, cars only).
 */
export async function fetchTeamLeadDayBoard(profile, { branchFilter = 'all', day = null, family = 'wash' } = {}) {
  const snapshot = await fetchOperationsSnapshot(profile, { branchFilter, family })
  const dayKey = day || getTodayDate()
  if (requiresTeamLeadBranchSetup(profile)) {
    return { ...snapshot, dayTickets: [], completedTotalMinor: 0 }
  }

  const branchScope = resolveBranchFilter(profile, branchFilter)
  let dayTickets = []
  try {
    dayTickets = await collectScoped(() =>
      scopedQuery(
        supabase
          .from('operations_queue_board')
          .select(QUEUE_BOARD_SELECT)
          .in('status', ['completed', 'cancelled'])
          .eq('queue_date', dayKey)
          .order('created_at', { ascending: false }),
        branchScope,
      ),
    )
  } catch (error) {
    throw formatQueueActionError(error)
  }
  const completedTotalMinor = dayTickets
    .filter((row) => row.status === 'completed')
    .reduce((sum, row) => sum + Number(row.final_price_minor ?? row.base_price_minor ?? 0), 0)

  return {
    ...snapshot,
    dayTickets,
    completedTotalMinor,
  }
}

const EMPTY_SALES_SUMMARY = aggregateDailySalesSummary([])

/** Branch-scoped sales totals + recent paid rows for Floor board (TL/Admin viewers). */
export async function fetchBranchSalesBoard(profile, { branchFilter = 'all', startDate, endDate } = {}) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { summary: EMPTY_SALES_SUMMARY, daily: [], recentSales: [] }
  }

  const branchScope = resolveBranchFilter(profile, branchFilter)
  if (branchScope === NO_BRANCH_SCOPE) {
    return { summary: EMPTY_SALES_SUMMARY, daily: [], recentSales: [] }
  }

  const start = startDate || getLocalCalendarDate()
  const end = endDate || start
  const startIso = `${start}T00:00:00+08:00`
  const endIso = `${end}T23:59:59.999+08:00`

  let dailyQuery = supabase
    .from('daily_sales_summary')
    .select('branch, sale_date, paid_count, total_sales_minor, cash_sales_minor, online_sales_minor, average_ticket_minor')
    .gte('sale_date', start)
    .lte('sale_date', end)
  dailyQuery = scopedQuery(dailyQuery, branchScope)

  let recentQuery = supabase
    .from('sales')
    .select(
      'id, branch, total_minor, payment_method, status, occurred_at, booking_id, notes, customers(full_name, phone), bookings(customer_name, vehicle_plate, queue_number, services(name))',
    )
    .eq('status', 'paid')
    .gte('occurred_at', startIso)
    .lte('occurred_at', endIso)
    .order('occurred_at', { ascending: false })
    .limit(24)
  recentQuery = scopedQuery(recentQuery, branchScope)

  const [dailyRes, recentRes] = await Promise.all([dailyQuery, recentQuery])
  if (dailyRes.error) throw dailyRes.error
  if (recentRes.error) throw recentRes.error

  const daily = dailyRes.data || []
  return {
    summary: aggregateDailySalesSummary(daily),
    daily,
    recentSales: recentRes.data || [],
  }
}

const EMPTY_FINANCIALS = aggregateSalesFinancials([])

/** Super Admin / network floor: lanes + crew + financials + KPI for branch + date range. */
export async function fetchSuperAdminFloorBoard(profile, { branchFilter = 'all', startDate, endDate } = {}) {
  // Detailing family includes confirmed (Assigned to Branch); wash tickets still return and are split client-side.
  const snapshot = await fetchOperationsSnapshot(profile, { branchFilter, family: 'detailing' })
  const branchScope = resolveBranchFilter(profile, branchFilter)
  const start = startDate || getLocalCalendarDate()
  const end = endDate || start
  const startIso = `${start}T00:00:00+08:00`
  const endIso = `${end}T23:59:59.999+08:00`

  if (branchScope === NO_BRANCH_SCOPE) {
    const emptyByFamily = splitFloorBoardLanes({ activeQueue: [], periodJobs: [] })
    return {
      ...snapshot,
      laneCounts: sumFloorLaneCounts(emptyByFamily),
      laneCountsByFamily: emptyByFamily,
      periodJobs: [],
      financials: { ...EMPTY_FINANCIALS, cancel_loss_minor: 0 },
      kpi: { total_wait_minutes: 0, avg_service_minutes: null, failed_qa_count: 0, cancelled_count: 0 },
      recentSales: [],
      adminRoster: [],
    }
  }

  const periodSelect =
    'id, branch, status, queue_number, customer_name, vehicle_plate, vehicle_make, vehicle_model, service_id, final_price_minor, price_minor, waiting_at, in_progress_at, final_checking_at, for_payment_at, completed_at, cancelled_at, redo_at, created_at, notes, services(name, pay_category)'

  const salesSelect =
    'id, branch, total_minor, payment_method, status, occurred_at, booking_id, notes, customers(full_name, phone), bookings(customer_name, vehicle_plate, queue_number, services(name, pay_category))'

  let adminStaffQuery = supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, is_active')
    .eq('is_active', true)
    .in('role', ['marketing', 'video_editor', 'admin', 'assistant_super_admin', 'team_lead'])
  adminStaffQuery = scopedStaffQuery(adminStaffQuery, branchScope)

  const [completedRows, cancelledRows, redoRows, startedRows, salesRaw, adminStaffRes] = await Promise.all([
    collectScoped(() =>
      scopedQuery(
        supabase
          .from('bookings')
          .select(periodSelect)
          .eq('is_archived', false)
          .eq('status', 'completed')
          .gte('completed_at', startIso)
          .lte('completed_at', endIso)
          .order('completed_at', { ascending: false }),
        branchScope,
      ),
    ),
    collectScoped(() =>
      scopedQuery(
        supabase
          .from('bookings')
          .select(periodSelect)
          .eq('is_archived', false)
          .eq('status', 'cancelled')
          .gte('cancelled_at', startIso)
          .lte('cancelled_at', endIso)
          .order('cancelled_at', { ascending: false }),
        branchScope,
      ),
    ),
    collectScoped(() =>
      scopedQuery(
        supabase
          .from('bookings')
          .select(periodSelect)
          .eq('is_archived', false)
          .not('redo_at', 'is', null)
          .gte('redo_at', startIso)
          .lte('redo_at', endIso)
          .order('redo_at', { ascending: false }),
        branchScope,
      ),
    ),
    collectScoped(() =>
      scopedQuery(
        supabase
          .from('bookings')
          .select(periodSelect)
          .eq('is_archived', false)
          .not('in_progress_at', 'is', null)
          .gte('in_progress_at', startIso)
          .lte('in_progress_at', endIso),
        branchScope,
      ),
    ),
    collectScoped(() =>
      scopedQuery(
        supabase
          .from('sales')
          .select(salesSelect)
          .eq('status', 'paid')
          .gte('occurred_at', startIso)
          .lte('occurred_at', endIso)
          .order('occurred_at', { ascending: false }),
        branchScope,
      ),
    ),
    adminStaffQuery,
  ])
  if (adminStaffRes.error) console.warn('Admin roster unavailable', adminStaffRes.error)

  const toJob = (row) => ({
    booking_id: row.id,
    branch: row.branch,
    status: row.status,
    queue_number: row.queue_number,
    customer_name: row.customer_name,
    vehicle_plate: row.vehicle_plate,
    vehicle_make: row.vehicle_make,
    vehicle_model: row.vehicle_model,
    service_name: row.services?.name || null,
    service_pay_category: row.services?.pay_category || null,
    final_price_minor: row.final_price_minor ?? row.price_minor,
    waiting_at: row.waiting_at,
    in_progress_at: row.in_progress_at,
    final_checking_at: row.final_checking_at,
    for_payment_at: row.for_payment_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    redo_at: row.redo_at,
    created_at: row.created_at,
    notes: row.notes,
  })

  const completedJobs = (completedRows || []).map(toJob)
  const cancelledJobs = (cancelledRows || []).map(toJob)
  const redoJobs = (redoRows || []).map(toJob)
  const startedJobs = (startedRows || []).map(toJob)
  const salesRows = (salesRaw || []).map((row) => ({
    ...row,
    pay_category: row.bookings?.services?.pay_category || null,
    service_name: row.bookings?.services?.name || null,
  }))

  const financials = {
    ...aggregateSalesFinancials(salesRows),
    cancel_loss_minor: cancelledJobs.reduce(
      (sum, row) => sum + Number(row.final_price_minor || 0),
      0,
    ),
  }

  const cycleSample = [...completedJobs, ...startedJobs.filter((j) => j.for_payment_at || j.completed_at || j.final_checking_at)]
  const avg = averageCycleMinutes(cycleSample)
  const kpi = {
    total_wait_minutes: Math.round(totalWaitMinutes(startedJobs)),
    avg_service_minutes: avg == null ? null : Math.round(avg),
    failed_qa_count: failedQaCount(redoJobs),
    cancelled_count: cancelledJobs.length,
  }

  const periodJobs = [...completedJobs.slice(0, 40), ...cancelledJobs.slice(0, 20)]
  const laneCountsByFamily = splitFloorBoardLanes({
    activeQueue: snapshot.activeQueue || [],
    periodJobs,
  })

  return {
    ...snapshot,
    laneCounts: sumFloorLaneCounts(laneCountsByFamily),
    laneCountsByFamily,
    periodJobs,
    financials,
    kpi,
    recentSales: salesRows.slice(0, 40),
    adminRoster: buildAdminRoster(adminStaffRes.data || []),
  }
}

export async function fetchTicket(bookingId, profile) {
  if (requiresTeamLeadBranchSetup(profile)) {
    return { ticket: null, assignments: [], staff: [] }
  }

  const branchScope = getBranchScopeFilter(profile)
  let ticketQuery = supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT).eq('booking_id', bookingId)
  ticketQuery = scopedQuery(ticketQuery, branchScope)
  let attendanceQuery = supabase
    .from('staff_attendance')
    .select('staff_id, branch_slug, attendance_date, status')
    .eq('attendance_date', getTodayDate())
    .in('status', ['present', 'late'])
  attendanceQuery = scopedStaffQuery(attendanceQuery, branchScope)
  const staffQuery = supabase.from('staff_profiles').select('id, full_name, role, branch_slug, is_active').eq('role', 'staff').eq('is_active', true)
  let busyQuery = supabase
    .from('busy_staff_view')
    .select('staff_id, booking_id, booking_status')
  busyQuery = scopedStaffQuery(busyQuery, branchScope)
  const [ticketResult, assignmentsResult, staffResult, busyResult] = await Promise.all([
    ticketQuery.maybeSingle(),
    supabase
      .from('queue_assignments')
      .select('id, booking_id, staff_id, assigned_by, task_name, task_notes, started_at, completed_at, released_at, status, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
    scopedStaffQuery(staffQuery, branchScope).order('full_name'),
    busyQuery.limit(200),
  ])

  const error = ticketResult.error || assignmentsResult.error || staffResult.error
  if (error) throw error
  const attendanceResult = await attendanceQuery
  if (attendanceResult.error) {
    console.warn('Staff attendance unavailable for ticket staff picker', attendanceResult.error)
    return { ticket: ticketResult.data, assignments: assignmentsResult.data || [], staff: [] }
  }
  const presentIds = new Set((attendanceResult.data || []).map((row) => row.staff_id))
  const busyIds = new Set(
    (busyResult.error ? [] : busyResult.data || [])
      .filter((row) => row.booking_id !== bookingId && isActiveQueueStatus(row.booking_status))
      .map((row) => row.staff_id),
  )
  return {
    ticket: ticketResult.data,
    assignments: assignmentsResult.data || [],
    staff: (staffResult.data || [])
      .filter((member) => presentIds.has(member.id))
      .map((member) => ({
        ...member,
        is_present_today: true,
        is_busy_today: busyIds.has(member.id),
      })),
  }
}

export async function fetchServices() {
  const services = await supabase
    .from('services')
    .select('id, name, slug, price_minor, duration_minutes, pay_category, service_size_prices(size_slug, price_minor)')
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('display_order')
  const error = services.error
  if (error) throw error
  return (services.data || []).map((row) => ({
    ...row,
    size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
  }))
}

export async function fetchBranches() {
  const { data, error } = await supabase.from('branches').select('slug, name').eq('is_active', true).order('name')
  if (error) throw error
  return data || []
}

export async function addStaffMember(form, profile) {
  const currentProfile = await getCurrentProfile({ required: true })
  const branchSlug =
    profile?.role === 'BossMich' || profile?.role === 'assistant_super_admin'
      ? form.branch_slug
      : getBranchScope(profile)
  if (!branchSlug || branchSlug === NO_BRANCH_SCOPE) {
    throw new Error('Your account has no assigned branch. Please contact BossMich.')
  }
  const username = validateCrewUsername(form.username)
  const name = String(form.full_name || '').trim()
  const email = String(form.email || '').trim().toLowerCase()
  if (!name) throw new Error('Staff name is required.')
  if (!email || !email.includes('@')) throw new Error('Valid email is required.')

  const { provisionStaff } = await import('../lib/adminApi.js')
  const provisioned = await provisionStaff({
    email,
    full_name: name,
    phone: form.phone?.trim() || null,
    username,
    temporary_password: form.password?.trim() || form.temporary_password?.trim() || undefined,
    role: 'staff',
    branch_slug: branchSlug,
    branch_slugs: [branchSlug],
  })

  const staffId = provisioned.user_id
  const { error: attendanceError } = await supabase
    .from('staff_attendance')
    .upsert({
      staff_id: staffId,
      branch_slug: branchSlug,
      attendance_date: getTodayDate(),
      status: form.present_today ? 'present' : 'absent',
      checked_in_at: form.present_today ? new Date().toISOString() : null,
      checked_out_at: form.present_today ? null : new Date().toISOString(),
      marked_by: currentProfile.id,
      source: 'admin',
    }, { onConflict: 'staff_id,attendance_date' })

  if (attendanceError) {
    console.error('Unable to mark new staff attendance', attendanceError)
    throw formatQueueActionError(attendanceError)
  }

  return { id: staffId }
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

export async function updateCrewStaffMember(memberId, patch) {
  if (!memberId) throw new Error('Staff id is required.')
  const { updateStaffAccountFields } = await import('../lib/adminApi.js')
  const body = {
    id: memberId,
    full_name: patch.full_name,
    phone: patch.phone,
    username: patch.username,
  }
  if (patch.branch_slug) body.branch_slug = patch.branch_slug
  if (patch.email?.trim()) body.email = patch.email.trim()
  if (patch.password?.trim()) body.temporary_password = patch.password.trim()
  return updateStaffAccountFields(body)
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
  const row = data?.[0]
  if (!row) return null

  // Enrich with year/color from vehicles when available
  if (row.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('vehicle_year, color, vehicle_make, vehicle_model, vehicle_type')
      .eq('id', row.vehicle_id)
      .maybeSingle()
    if (vehicle) {
      return {
        ...row,
        vehicle_make: vehicle.vehicle_make || row.vehicle_make,
        vehicle_model: vehicle.vehicle_model || row.vehicle_model,
        vehicle_type: vehicle.vehicle_type || row.vehicle_type,
        vehicle_year: vehicle.vehicle_year != null ? String(vehicle.vehicle_year) : '',
        vehicle_color: vehicle.color || '',
      }
    }
  }
  return { ...row, vehicle_year: '', vehicle_color: '' }
}

/** POS loyalty attach — plate first, then name/phone. Limit 8 (ponytail: no trigram index yet). */
export async function searchPosCustomer(query, profile) {
  const raw = (query || '').trim()
  if (raw.length < 2) return []
  const safe = raw.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (safe.length < 2) return []

  const results = []
  const plateHit = await lookupPlate(safe, profile).catch(() => null)
  if (plateHit?.customer_id) {
    results.push({
      id: plateHit.customer_id,
      full_name: plateHit.customer_name || 'Customer',
      phone: plateHit.customer_phone || '',
      plate: plateHit.plate_number || plateHit.normalized_plate_number || '',
      source: 'plate',
    })
  }

  const pattern = `%${safe}%`
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('role', 'customer')
    .eq('is_archived', false)
    .or(`full_name.ilike."${pattern}",phone.ilike."${pattern}"`)
    .limit(8)
  if (error) throw error

  for (const row of data || []) {
    if (results.some((r) => r.id === row.id)) continue
    results.push({
      id: row.id,
      full_name: row.full_name || 'Customer',
      phone: row.phone || '',
      plate: '',
      source: 'name',
    })
  }
  return results
}

async function ensureCustomer(form, displayName) {
  const phone = form.customer_phone?.trim()
  if (!phone) throw new Error('Phone number is required.')
  const first = form.customer_first_name?.trim() || ''
  const last = form.customer_last_name?.trim() || ''
  const fullName =
    displayName ||
    resolveQueueCustomerDisplayName({
      customer_name: form.customer_name,
      customer_first_name: first,
      customer_last_name: last,
      vehicle_plate: form.vehicle_plate,
      customer_phone: phone,
    })

  // Provision auth account (set-password invite) via server — creates customers row + notifies
  const accessToken = await getAccessTokenFresh()
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
      allow_walk_in_name: true,
      site_origin: window.location.origin,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to create customer account.')
  return { customerId: payload.customer_id, displayName: payload.full_name || fullName }
}

export async function createQueueTicket(form) {
  if (!form.branch) throw new Error('Your Team Lead account has no assigned branch. Please contact an admin.')
  const identityError = validateQueueTicketIdentity(form)
  if (identityError) throw new Error(identityError)

  const profile = await getCurrentProfile({ required: true })
  const displayName = resolveQueueCustomerDisplayName(form)
  const { customerId, displayName: resolvedName } = await ensureCustomer(form, displayName)
  // Server may keep an existing CRM name when walk-in placeholder would overwrite it
  const customerName = resolvedName || displayName
  let vehicleId = form.vehicle_id || null
  const normalizedPlate = normalizePlate(form.vehicle_plate || '')
  const vehicleType = normalizeVehicleType(form.vehicle_type)

  if (vehicleId) {
    const { error: attachError } = await supabase
      .from('vehicles')
      .update({
        customer_id: customerId,
        vehicle_make: form.vehicle_make?.trim() || '',
        vehicle_model: form.vehicle_model?.trim() || '',
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
        vehicle_make: form.vehicle_make?.trim() || '',
        vehicle_model: form.vehicle_model?.trim() || '',
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

  if (!vehicleId) throw new Error('Plate number is required.')

  const serviceIds = Array.isArray(form.service_ids) && form.service_ids.length
    ? [...new Set(form.service_ids.filter(Boolean))]
    : form.service_id
      ? [form.service_id]
      : []
  if (!serviceIds.length) throw new Error('Select at least one service.')

  const visitGroupId = serviceIds.length > 1 ? crypto.randomUUID() : null
  const shared = {
    customer_id: customerId,
    vehicle_id: vehicleId,
    customer_name: customerName,
    customer_email: form.customer_email?.trim() || null,
    customer_phone: form.customer_phone.trim(),
    vehicle_make: form.vehicle_make?.trim() || '',
    vehicle_model: form.vehicle_model?.trim() || '',
    vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
    vehicle_plate: form.vehicle_plate.trim().toUpperCase(),
    vehicle_type: vehicleType,
    scheduled_start: new Date().toISOString(),
    branch: form.branch,
    status: 'waiting',
    created_by: form.created_by,
    team_lead_id: profile.id,
    waiting_at: new Date().toISOString(),
    notes: form.notes?.trim() || null,
    visit_group_id: visitGroupId,
  }

  let primaryId = null
  let sharedQueueNumber = null

  // If any line is detailing, pin one persistent number for the whole visit
  // (daily reset must not apply even when a same-day add-on is selected too).
  const visitHasDetailing = serviceIds.some((id) => {
    const svc = form.services?.find((item) => item.id === id)
    return isDetailingPayCategory(svc?.pay_category)
  })
  if (visitHasDetailing) {
    const { data: persistentNumber, error: persistentError } = await supabase.rpc(
      'assign_persistent_queue_number',
      { p_branch: form.branch },
    )
    if (persistentError) {
      console.error('Unable to assign detailing queue number', persistentError)
      throw formatQueueActionError(persistentError)
    }
    sharedQueueNumber = persistentNumber
  }

  for (let i = 0; i < serviceIds.length; i += 1) {
    const serviceId = serviceIds[i]
    const service = form.services.find((item) => item.id === serviceId)
    const sizedPrice = resolveServicePriceMinor(service, vehicleType)
    // Prefer per-line override map, then shared final_price for single or multi
    const override =
      form.line_prices?.[serviceId] ??
      (form.final_price ? parsePesoInputToMinor(form.final_price) : null)
    const linePrice =
      Number.isFinite(override) && override > 0
        ? override
        : sizedPrice || 0
    const row = {
      ...shared,
      service_id: serviceId,
      final_price_minor: linePrice,
      price_minor: linePrice,
    }
    if (sharedQueueNumber != null) row.queue_number = sharedQueueNumber

    const { data, error } = await supabase.from('bookings').insert(row).select('id, queue_number').single()
    if (error) {
      console.error('Unable to create queue ticket', error)
      throw formatQueueActionError(error)
    }
    if (i === 0) {
      primaryId = data.id
      sharedQueueNumber = data.queue_number
    }
  }

  try {
    await notifyBookingClient(primaryId, 'waiting')
  } catch {
    /* ignore */
  }
  return { id: primaryId, visit_group_id: visitGroupId }
}

async function notifyBookingClient(bookingId, status) {
  const token = await getAccessTokenFresh()
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

/** All open booking ids for the ticket's visit group (multi-service moves as one). */
async function getVisitLineIds(ticket) {
  if (Array.isArray(ticket?.linked_booking_ids) && ticket.linked_booking_ids.length) {
    return ticket.linked_booking_ids
  }
  if (!ticket?.visit_group_id) return [ticket.booking_id]
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('visit_group_id', ticket.visit_group_id)
    .eq('status', ticket.status)
    .eq('is_archived', false)
  if (error || !data?.length) return [ticket.booking_id]
  return data.map((row) => row.id)
}

export async function updateTicketStatus(ticket, nextStatus) {
  if (!canTransitionQueueStatus(ticket?.status, nextStatus)) {
    throw new Error(
      `Cannot move ticket from ${ticket?.status || 'unknown'} to ${nextStatus}. Refresh and try the next valid step.`,
    )
  }

  if (nextStatus === 'cancelled') {
    throw new Error('Use cancelQueueTicket with a cancellation reason.')
  }

  const profile = await getCurrentProfile({ required: false })
  const now = new Date().toISOString()
  const patch = { status: nextStatus }
  if (nextStatus === 'waiting') patch.waiting_at = now
  if (nextStatus === 'in_progress') {
    patch.in_progress_at = now
    if (!ticket.actual_start) patch.actual_start = now
    if (crewRequiredForPayCategory(ticket.service_pay_category || ticket.pay_category)) {
      const { data: activeCrew, error: crewError } = await supabase
        .from('queue_assignments')
        .select('id')
        .eq('booking_id', ticket.booking_id)
        .eq('status', 'active')
        .limit(1)
      if (crewError) throw formatQueueActionError(crewError)
      if (!activeCrew?.length) {
        throw new Error('Assign at least one present crew member before starting service.')
      }
    }
  }
  if (nextStatus === 'final_checking') {
    patch.final_checking_at = now
    if (profile?.id) patch.final_checked_by = profile.id
  }
  if (nextStatus === 'for_releasing') {
    // ponytail: reuse final_checking_at stamp; dedicated column not required for board
    patch.final_checking_at = ticket.final_checking_at || now
  }
  if (nextStatus === 'for_payment') patch.for_payment_at = now
  if (nextStatus === 'completed') patch.completed_at = now
  if (nextStatus === 'redo') {
    patch.redo_at = now
    if (profile?.id) patch.redo_by = profile.id
  }

  const lineIds = await getVisitLineIds(ticket)
  const { error } = await supabase.from('bookings').update(patch).in('id', lineIds)
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

/** Cancel open ticket/booking with required reason (TL may cancel; never hard-delete). */
export async function cancelQueueTicket(ticket, reason) {
  if (!canCancelQueueStatus(ticket?.status)) {
    throw new Error(`Cannot cancel a ticket in ${ticket?.status || 'unknown'} status.`)
  }
  const checked = validateCancellationReason(reason)
  if (!checked.ok) throw new Error(checked.error)

  await getCurrentProfile({ required: true })
  const now = new Date().toISOString()
  const lineIds = await getVisitLineIds(ticket)
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: checked.reason,
    })
    .in('id', lineIds)
  if (error) {
    console.error('Unable to cancel queue ticket', error)
    throw formatQueueActionError(error)
  }
}

/**
 * Branch Admin / SA / ASA override: pull a ticket (whole visit) back to an
 * earlier lane. Server RPC cancels pending handoffs when leaving for_payment.
 */
export async function adminOverrideTicketStatus(ticket, nextStatus, reason = '') {
  if (!getAdminOverrideTargets(ticket?.status).includes(nextStatus)) {
    throw new Error(`Cannot override from ${STATUS_LABELS[ticket?.status] || ticket?.status} to ${STATUS_LABELS[nextStatus] || nextStatus}.`)
  }
  await getCurrentProfile({ required: true })
  const note = String(reason || '').trim()
  const { data, error } = await supabase.rpc('admin_override_queue_status', {
    input_booking_id: ticket.booking_id,
    input_next_status: nextStatus,
    input_reason: note || null,
  })
  if (error) {
    console.error('Unable to override queue ticket status', error)
    throw formatQueueActionError(error)
  }
  await writeAudit({
    action: 'override',
    entityType: 'booking',
    entityId: ticket.booking_id,
    summary: `Admin override ${ticket.status} → ${nextStatus} for ${ticket.queue_number || ticket.booking_id}`,
    meta: {
      from: ticket.status,
      to: nextStatus,
      branch: ticket.branch,
      reason: note || null,
      visit_group_id: ticket.visit_group_id || null,
    },
  })
  try {
    await notifyBookingClient(ticket.booking_id, nextStatus)
  } catch {
    /* ignore */
  }
  return data
}

/** Every service line in this ticket's visit (single ticket = one line). */
export async function fetchVisitLines(ticket) {
  if (!ticket?.visit_group_id) {
    return [{
      booking_id: ticket?.booking_id,
      service_id: ticket?.service_id,
      service_name: ticket?.service_name,
      final_price_minor: ticket?.final_price_minor ?? ticket?.base_price_minor ?? 0,
      status: ticket?.status,
    }]
  }
  const { data, error } = await supabase
    .from('operations_queue_board')
    .select('booking_id, service_id, service_name, final_price_minor, base_price_minor, status, created_at')
    .eq('visit_group_id', ticket.visit_group_id)
    .order('created_at')
  if (error) throw formatQueueActionError(error)
  return data || []
}

/**
 * TL upsell: add a service line to an open ticket (waiting / in progress).
 * The new line joins the visit group at the same lane + queue number; the
 * payment RPC auto-sums every line into one handoff at final check.
 */
export async function addServiceToVisit(ticket, service, { priceMinor = null } = {}) {
  if (!['waiting', 'in_progress'].includes(ticket?.status)) {
    throw new Error('Services can only be added while the ticket is waiting or in progress.')
  }
  if (!service?.id) throw new Error('Pick a service to add.')

  const profile = await getCurrentProfile({ required: true })

  let visitGroupId = ticket.visit_group_id
  if (!visitGroupId) {
    visitGroupId = crypto.randomUUID()
    const { error: groupError } = await supabase
      .from('bookings')
      .update({ visit_group_id: visitGroupId })
      .eq('id', ticket.booking_id)
    if (groupError) throw formatQueueActionError(groupError)
  }

  const sizedPrice = resolveServicePriceMinor(service, ticket.vehicle_type)
  const linePrice = Number.isFinite(priceMinor) && priceMinor > 0 ? priceMinor : sizedPrice || service.price_minor || 0
  const now = new Date().toISOString()
  const row = {
    customer_id: ticket.customer_id,
    vehicle_id: ticket.vehicle_id,
    customer_name: ticket.customer_name,
    customer_email: ticket.customer_email || null,
    customer_phone: ticket.customer_phone || null,
    vehicle_make: ticket.vehicle_make || '',
    vehicle_model: ticket.vehicle_model || '',
    vehicle_year: ticket.vehicle_year || null,
    vehicle_plate: ticket.vehicle_plate,
    vehicle_type: ticket.vehicle_type,
    branch: ticket.branch,
    service_id: service.id,
    status: ticket.status,
    queue_number: ticket.queue_number,
    visit_group_id: visitGroupId,
    scheduled_start: now,
    waiting_at: now,
    in_progress_at: ticket.status === 'in_progress' ? now : null,
    actual_start: ticket.status === 'in_progress' ? now : null,
    final_price_minor: linePrice,
    price_minor: linePrice,
    team_lead_id: profile.id,
    created_by: profile.id,
  }

  const { data, error } = await supabase.from('bookings').insert(row).select('id').single()
  if (error) {
    console.error('Unable to add service to visit', error)
    throw formatQueueActionError(error)
  }
  await writeAudit({
    action: 'update',
    entityType: 'booking',
    entityId: ticket.booking_id,
    summary: `Added service ${service.name || service.id} to ticket ${ticket.queue_number || ticket.booking_id}`,
    meta: {
      added_booking_id: data.id,
      service_id: service.id,
      price_minor: linePrice,
      visit_group_id: visitGroupId,
      branch: ticket.branch,
    },
  })
  return { id: data.id, visit_group_id: visitGroupId }
}

export async function markTicketRedo(ticket, reason = '') {
  if (!REDO_FROM_STATUSES.includes(ticket.status)) {
    throw new Error('Redo is only available from in progress, final checking, or for payment.')
  }
  const profile = await getCurrentProfile({ required: true })
  const note = String(reason || '').trim()
  const now = new Date().toISOString()
  const lineIds = await getVisitLineIds(ticket)
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'redo',
      redo_at: now,
      redo_by: profile.id,
      redo_reason: note || null,
    })
    .in('id', lineIds)
  if (error) throw formatQueueActionError(error)
  await writeAudit({
    action: 'redo',
    entityType: 'booking',
    entityId: ticket.booking_id,
    summary: `Marked queue ticket ${ticket.queue_number || ticket.booking_id} as redo`,
    meta: {
      from: ticket.status,
      to: 'redo',
      branch: ticket.branch,
      reason: note || null,
      visit_group_id: ticket.visit_group_id || null,
    },
  })
  try {
    await notifyBookingClient(ticket.booking_id, 'redo')
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

/** Update car size (pricing tier) on the ticket + linked vehicle; recalc catalog price when not overridden. */
export async function updateTicketVehicleType(ticket, vehicleType, { servicesCatalog = [] } = {}) {
  await getCurrentProfile({ required: true })
  const type = normalizeVehicleType(vehicleType)
  if (!type) throw new Error('Pick a car size.')

  const lineIds = await getVisitLineIds(ticket)
  const patch = { vehicle_type: type }
  const svc =
    (servicesCatalog || []).find((row) => row.id === ticket.service_id) ||
    (servicesCatalog || []).find((row) => row.id === ticket.services?.id)
  if (svc) {
    const sized = resolveServicePriceMinor(svc, type)
    patch.base_price_minor = sized
    const currentFinal = Number(ticket.final_price_minor ?? 0)
    const currentBase = Number(ticket.base_price_minor ?? 0)
    // Keep manual overrides; otherwise follow size pricing.
    if (!currentFinal || currentFinal === currentBase) {
      patch.final_price_minor = sized
      patch.price_minor = sized
    }
  }

  const { error } = await supabase.from('bookings').update(patch).in('id', lineIds)
  if (error) {
    console.error('Unable to update ticket vehicle type', error)
    throw formatQueueActionError(error)
  }

  if (ticket.vehicle_id) {
    const { error: vehicleErr } = await supabase
      .from('vehicles')
      .update({ vehicle_type: type })
      .eq('id', ticket.vehicle_id)
    if (vehicleErr) {
      console.error('Unable to sync vehicle size on masterlist', vehicleErr)
      // ponytail: booking size is source of truth for pricing; masterlist sync is best-effort
    }
  }
}

export async function assignStaff(ticket, staffIds) {
  await getCurrentProfile({ required: true })
  const ids = (staffIds || []).filter(Boolean)
  if (!ids.length && crewRequiredForPayCategory(ticket?.service_pay_category || ticket?.pay_category)) {
    throw new Error('Pick at least one present crew member.')
  }
  const { error } = await supabase.rpc('sync_queue_assignments', {
    input_booking_id: ticket.booking_id,
    input_staff_ids: ids,
  })
  if (error) {
    console.error('Unable to sync queue assignments', error)
    throw formatQueueActionError(error)
  }
  // Legacy: assigning crew on waiting auto-promotes to in_progress.
  if (ids.length && ticket?.status === 'waiting') {
    await updateTicketStatus(ticket, 'in_progress')
  }
}

/** Present (+ late) staff for a branch — used by booking Start · assign crew. */
export async function fetchPresentAssignableStaff(profile, branchSlug) {
  if (requiresTeamLeadBranchSetup(profile)) return []
  const branchScope = branchSlug && branchSlug !== 'all' ? branchSlug : getBranchScopeFilter(profile)
  let attendanceQuery = supabase
    .from('staff_attendance')
    .select('staff_id, status')
    .eq('attendance_date', getTodayDate())
    .in('status', ['present', 'late'])
  attendanceQuery = scopedStaffQuery(attendanceQuery, branchScope)
  const staffQuery = supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, is_active')
    .eq('role', 'staff')
    .eq('is_active', true)
  let busyQuery = supabase.from('busy_staff_view').select('staff_id, booking_id, booking_status')
  busyQuery = scopedStaffQuery(busyQuery, branchScope)
  const [attendanceResult, staffResult, busyResult] = await Promise.all([
    attendanceQuery,
    scopedStaffQuery(staffQuery, branchScope).order('full_name'),
    busyQuery.limit(200),
  ])
  if (attendanceResult.error || staffResult.error) {
    throw attendanceResult.error || staffResult.error
  }
  const presentIds = new Set((attendanceResult.data || []).map((row) => row.staff_id))
  const busyIds = new Set(
    (busyResult.error ? [] : busyResult.data || [])
      .filter((row) => isActiveQueueStatus(row.booking_status))
      .map((row) => row.staff_id),
  )
  return (staffResult.data || [])
    .filter((member) => presentIds.has(member.id))
    .map((member) => ({
      ...member,
      is_busy_today: busyIds.has(member.id),
    }))
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

/** Staff My Tasks: acknowledge pending → active (RPC locks booking_id). */
export async function acknowledgeQueueAssignment(assignmentId) {
  const { data, error } = await supabase.rpc('acknowledge_queue_assignment', {
    p_assignment_id: assignmentId,
  })
  if (error) throw formatQueueActionError(error)
  return data
}

/** Staff My Tasks: complete active → released. */
export async function completeQueueAssignment(assignmentId) {
  const { data, error } = await supabase.rpc('complete_queue_assignment', {
    p_assignment_id: assignmentId,
  })
  if (error) throw formatQueueActionError(error)
  return data
}
