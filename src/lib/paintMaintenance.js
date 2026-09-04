/**
 * Paint maintenance program — Ceramic Coating + PPF share one 6-month reminder cycle per plate.
 * Dedup key: plate_normalized + program_key (active rows only).
 */

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
