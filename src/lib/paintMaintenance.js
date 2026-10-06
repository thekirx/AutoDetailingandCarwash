/**
 * Paint maintenance program — Ceramic Coating + PPF share one 6-month reminder cycle per plate.
 * Dedup key: plate_normalized + program_key (active rows only).
 */
import { normalizePricingSize, resolveServicePriceMinor } from './servicePricing.js'

export const PAINT_MAINTENANCE_PROGRAM = 'paint_maintenance'
export const PAINT_MAINTENANCE_SLUG = 'paint-maintenance'
export const PAINT_MAINTENANCE_SERVICE_ID = '44444444-4444-4444-8444-444444444444'

/** Install jobs that enroll a vehicle into the paint-maintenance reminder program. */
export const PAINT_MAINTENANCE_ENROLL_SLUGS = Object.freeze([
  'ceramic-coating',
  'paint-protection-film',
])

/**
 * Detailing types ops can tune on the Bookings → Maintenance tab.
 * Ceramic/PPF enroll; Paint Maintenance resets the clock after a return visit.
 */
export const DETAILING_SCHEDULE_TYPES = Object.freeze([
  {
    slug: 'ceramic-coating',
    label: 'Ceramic Coating',
    shortLabel: 'Ceramic',
    role: 'enroll',
    defaultMonths: 6,
  },
  {
    slug: 'paint-protection-film',
    label: 'Paint Protection Film',
    shortLabel: 'PPF',
    role: 'enroll',
    defaultMonths: 6,
  },
  {
    slug: PAINT_MAINTENANCE_SLUG,
    label: 'Paint Maintenance',
    shortLabel: 'Maint.',
    role: 'reset',
    defaultMonths: 6,
  },
])

export function isPaintMaintenanceEnrollSlug(slug) {
  return PAINT_MAINTENANCE_ENROLL_SLUGS.includes(String(slug || '').toLowerCase())
}

export function isPaintMaintenanceSlug(slug) {
  return String(slug || '').toLowerCase() === PAINT_MAINTENANCE_SLUG
}

/** Normalize plate for dedupe (uppercase, strip spaces/dashes). */
export function normalizeMaintPlate(plate) {
  return String(plate || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/**
 * Add months in Manila calendar terms (date-only).
 * @param {string|Date} from
 * @param {number} months
 */
export function addMonthsDateOnly(from, months = 6) {
  const d = from instanceof Date ? new Date(from) : new Date(from)
  if (Number.isNaN(d.getTime())) {
    const today = new Date()
    today.setMonth(today.getMonth() + months)
    return today.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  }
  const next = new Date(d)
  next.setMonth(next.getMonth() + Number(months) || 6)
  return next.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export function coatedAtDateOnly(isoOrDate = new Date()) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  }
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export function manilaTodayDateOnly(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

/** Calendar-day delta (Manila date-only strings). Negative = overdue. */
export function daysUntilDue(nextDueAt, today = manilaTodayDateOnly()) {
  const due = String(nextDueAt || '').slice(0, 10)
  const day = String(today || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const ms = Date.parse(`${due}T00:00:00+08:00`) - Date.parse(`${day}T00:00:00+08:00`)
  return Math.round(ms / 86400000)
}

/**
 * @returns {'overdue'|'due_soon'|'upcoming'|'none'}
 */
export function maintenanceUrgency(nextDueAt, today = manilaTodayDateOnly(), soonDays = 14) {
  const days = daysUntilDue(nextDueAt, today)
  if (days == null) return 'none'
  if (days < 0) return 'overdue'
  if (days <= soonDays) return 'due_soon'
  return 'upcoming'
}

/**
 * Default Maintenance tab: due soon / overdue, plus rows not yet reminded.
 * Notified upcoming plates stay hidden until ops search for them.
 */
export function maintenanceNeedsOpsAttention(row, today = manilaTodayDateOnly()) {
  const urgency = maintenanceUrgency(row?.next_due_at, today)
  if (urgency === 'overdue' || urgency === 'due_soon') return true
  return String(row?.status || '') !== 'notified'
}

export function matchesMaintenanceSearch(row, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const hay = `${row?.plate_number || ''} ${row?.customer_name || ''} ${row?.customer_phone || ''} ${row?.branch_slug || ''} ${row?.service_slug || ''}`.toLowerCase()
  return hay.includes(q)
}

export function sortMaintenanceSchedules(rows, today = manilaTodayDateOnly()) {
  const rank = { overdue: 0, due_soon: 1, upcoming: 2, none: 3 }
  return [...(rows || [])].sort((a, b) => {
    const ua = maintenanceUrgency(a.next_due_at, today)
    const ub = maintenanceUrgency(b.next_due_at, today)
    if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub]
    return String(a.next_due_at || '').localeCompare(String(b.next_due_at || ''))
  })
}

/**
 * Resolve frequency months from notification_settings rows (most specific wins).
 */
export function resolveFrequencyMonthsFromSettings(settings, serviceId, branchSlug, fallback = 6) {
  const list = Array.isArray(settings) ? settings.filter((s) => s?.enabled !== false) : []
  const match =
    list.find(
      (s) =>
        s.scope === 'per_service_branch' && s.service_id === serviceId && s.branch_slug === branchSlug,
    ) ||
    list.find((s) => s.scope === 'per_service' && s.service_id === serviceId) ||
    list.find((s) => s.scope === 'per_branch' && s.branch_slug === branchSlug) ||
    list.find((s) => s.scope === 'whole') ||
    null
  const months = Number(match?.frequency_months)
  return Number.isFinite(months) && months >= 1 ? Math.min(24, months) : fallback
}

const CLOSED_BOOKING_STATUSES = new Set(['completed', 'cancelled'])

/** Open Paint Maintenance booking already on the board for this plate — blocks a second intake. */
export function openMaintenanceBookingForPlate(bookings, plate) {
  const want = normalizeMaintPlate(plate)
  if (!want) return null
  return (
    (bookings || []).find(
      (b) =>
        b &&
        !b.is_archived &&
        !CLOSED_BOOKING_STATUSES.has(String(b.status || '')) &&
        (b.service_id === PAINT_MAINTENANCE_SERVICE_ID || isPaintMaintenanceSlug(b.services?.slug)) &&
        normalizeMaintPlate(b.vehicle_plate) === want,
    ) || null
  )
}

/**
 * Booking row for a due car that just arrived at the shop — lands on Vehicle intake (`waiting`).
 * Vehicle details fall back to the last booking for the plate; contact falls back schedule → customer → last booking.
 * @returns {{ row: object } | { error: string }}
 */
export function buildMaintenanceArrivalBooking({
  schedule,
  vehicle = null,
  customer = null,
  lastBooking = null,
  service,
  branch,
  staff,
  now = new Date(),
}) {
  const plate = String(schedule?.plate_number || vehicle?.plate_number || '').trim().toUpperCase()
  if (!plate) return { error: 'This schedule has no plate.' }
  if (!branch) return { error: 'Pick a branch for this arrival.' }
  if (!service?.id) return { error: 'Paint Maintenance is missing from the service catalog.' }
  const make = String(vehicle?.vehicle_make || lastBooking?.vehicle_make || '').trim()
  const model = String(vehicle?.vehicle_model || lastBooking?.vehicle_model || '').trim()
  if (!make || !model) return { error: `No make/model on file for ${plate}. Use New booking instead.` }
  const phone = String(schedule?.customer_phone || customer?.phone || lastBooking?.customer_phone || '').trim()
  if (!phone) return { error: `No phone on file for ${plate}. Use New booking instead.` }
  const name =
    String(schedule?.customer_name || customer?.full_name || lastBooking?.customer_name || '').trim() || 'Walk-in'
  const size = normalizePricingSize(vehicle?.vehicle_type || lastBooking?.vehicle_type)
  const price = resolveServicePriceMinor(service, size)
  const at = now.toISOString()
  return {
    row: {
      customer_id: schedule?.customer_id || vehicle?.customer_id || lastBooking?.customer_id || null,
      vehicle_id: schedule?.vehicle_id || vehicle?.id || null,
      customer_name: name,
      customer_phone: phone,
      vehicle_plate: plate,
      vehicle_make: make,
      vehicle_model: model,
      vehicle_type: size,
      service_id: service.id,
      branch,
      scheduled_start: at,
      status: 'waiting',
      waiting_at: at,
      is_archived: false,
      price_minor: price,
      final_price_minor: price,
      created_by: staff?.id || null,
      team_lead_id: staff?.role === 'team_lead' ? staff.id : null,
      notes: 'Paint maintenance arrival',
    },
  }
}

/**
 * Resolve what a completed booking does to the paint-maintenance program.
 * @returns {'enroll'|'reset'|null}
 */
export function paintMaintenanceActionForSlug(slug) {
  const s = String(slug || '').toLowerCase()
  if (isPaintMaintenanceSlug(s)) return 'reset'
  if (isPaintMaintenanceEnrollSlug(s)) return 'enroll'
  return null
}
