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
