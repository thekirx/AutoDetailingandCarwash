/**
 * Floor catalog kinds for queue + Super Admin.
 * Maps services.pay_category → service | package | detailing.
 * Detailing is multi-day: queue numbers do not reset with the Manila calendar day.
 */

/** TL/Sales form bookings: Ceramic, Tint, PPF, and Paint Maintenance. */
export const FLOOR_DETAILING_SERVICE_SLUGS = [
  'ceramic-coating',
  'paint-maintenance',
  'nano-ceramic-tint',
  'paint-protection-film',
]

export const SERVICE_KINDS = [
  {
    id: 'service',
    label: 'Services',
    shortLabel: 'Service',
    hint: 'Same-day bay work. Queue numbers reset daily.',
    categories: ['general', 'wash', 'addon'],
  },
  {
    id: 'package',
    label: 'Packages',
    shortLabel: 'Package',
    hint: 'Bundled same-day mix of services, or a custom package price. Queue numbers reset daily.',
    categories: ['package', 'ppf'],
  },
  {
    id: 'detailing',
    label: 'Detailing services',
    shortLabel: 'Detail',
    hint: 'Multi-day jobs. Queue numbers stay until the ticket finishes.',
    categories: ['detailing'],
  },
]

/** Catalog options Super Admin can pick when adding/editing a row. */
export const PAY_CATEGORY_OPTIONS = [
  { value: 'general', label: 'Service (general)', kind: 'service' },
  { value: 'wash', label: 'Service (wash)', kind: 'service' },
  { value: 'addon', label: 'Service (add-on)', kind: 'service' },
  { value: 'package', label: 'Package', kind: 'package' },
  { value: 'ppf', label: 'Package (PPF / film)', kind: 'package' },
  { value: 'detailing', label: 'Detailing (multi-day)', kind: 'detailing' },
]

/** Inventory create forms: bay = services+packages; detailing = multi-day only. */
export function payCategoryOptionsForCatalogScope(scope = 'all') {
  const key = String(scope || 'all')
  if (key === 'bay') {
    return PAY_CATEGORY_OPTIONS.filter((row) => row.kind === 'service' || row.kind === 'package')
  }
  if (key === 'detailing') {
    return PAY_CATEGORY_OPTIONS.filter((row) => row.kind === 'detailing')
  }
  return PAY_CATEGORY_OPTIONS
}

export function defaultPayCategoryForCatalogScope(scope = 'all') {
  if (String(scope) === 'detailing') return 'detailing'
  if (String(scope) === 'bay') return 'general'
  return 'general'
}

const CATEGORY_TO_KIND = Object.fromEntries(
  PAY_CATEGORY_OPTIONS.map((row) => [row.value, row.kind]),
)

export function serviceKindFromPayCategory(payCategory) {
  const key = String(payCategory || 'general').trim().toLowerCase() || 'general'
  return CATEGORY_TO_KIND[key] || 'service'
}

export function isDetailingPayCategory(payCategory) {
  return serviceKindFromPayCategory(payCategory) === 'detailing'
}

export function isSameDayQueueKind(kindOrPayCategory) {
  const kind = SERVICE_KINDS.some((k) => k.id === kindOrPayCategory)
    ? kindOrPayCategory
    : serviceKindFromPayCategory(kindOrPayCategory)
  return kind === 'service' || kind === 'package'
}

export function filterServicesByKind(services, kindId) {
  return (services || []).filter((svc) => serviceKindFromPayCategory(svc.pay_category) === kindId)
}

/** POS Sell: same-day Services + Packages in one tab (excludes multi-day detailing SKUs). */
export function filterPosBayCatalog(services) {
  const detailingSlugs = new Set(FLOOR_DETAILING_SERVICE_SLUGS)
  return (services || []).filter((svc) => {
    const slug = String(svc.slug || '').toLowerCase()
    if (detailingSlugs.has(slug)) return false
    const kind = serviceKindFromPayCategory(svc.pay_category)
    return kind === 'service' || kind === 'package'
  })
}

/** POS Sell: multi-day detailing (Ceramic / Tint / PPF / Paint Maint + detailing category). */
export function filterPosDetailingCatalog(services) {
  const detailingSlugs = new Set(FLOOR_DETAILING_SERVICE_SLUGS)
  return (services || []).filter((svc) => {
    const slug = String(svc.slug || '').toLowerCase()
    if (detailingSlugs.has(slug)) return true
    return serviceKindFromPayCategory(svc.pay_category) === 'detailing'
  })
}

/** Prefer floor detailing SKUs (Ceramic / Paint Maint / Tint / PPF); fall back to any active detailing row. */
export function filterFloorDetailingServices(services) {
  const rows = services || []
  const preferred = new Set(FLOOR_DETAILING_SERVICE_SLUGS)
  const named = rows.filter((svc) => preferred.has(String(svc.slug || '').toLowerCase()))
  if (named.length) {
    return [...named].sort((a, b) => {
      const ai = FLOOR_DETAILING_SERVICE_SLUGS.indexOf(String(a.slug || '').toLowerCase())
      const bi = FLOOR_DETAILING_SERVICE_SLUGS.indexOf(String(b.slug || '').toLowerCase())
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
  }
  return filterServicesByKind(rows, 'detailing')
}

/**
 * Bookings board is multi-day detailing only (ceramic, paint maint, tint, PPF).
 * Wash / same-day packages stay on Queue.
 */
export function isBookingBoardService(service = {}) {
  const slug = String(service?.slug || '').toLowerCase()
  if (FLOOR_DETAILING_SERVICE_SLUGS.includes(slug)) return true
  const cat = String(service?.pay_category || '').toLowerCase()
  return cat === 'detailing' || cat === 'ppf'
}

export function isBookingBoardRow(booking = {}) {
  const svc = booking?.services || {}
  return isBookingBoardService({
    slug: svc.slug || booking?.service_slug,
    pay_category: svc.pay_category || booking?.service_pay_category,
  })
}

export function searchServices(services, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return services || []
  return (services || []).filter((svc) => {
    const hay = `${svc.name || ''} ${svc.slug || ''} ${svc.pay_category || ''}`.toLowerCase()
    return hay.includes(q)
  })
}

/**
 * Same-day services/packages: hide stale waiting tickets from prior Manila days.
 * Detailing + already-started work always stay on the floor.
 */
export function isTicketOnTodayFloor(ticket, todayDate) {
  if (!ticket) return false
  const kind = serviceKindFromPayCategory(ticket.service_pay_category || ticket.pay_category)
  if (kind === 'detailing') return true

  const started = ['in_progress', 'final_checking', 'redo', 'for_payment'].includes(ticket.status)
  if (started) return true

  const qd = ticket.queue_date || null
  if (!qd || !todayDate) return true
  return String(qd) === String(todayDate)
}

export function formatQueueNumberForKind(queueNumber, payCategory) {
  if (queueNumber === null || queueNumber === undefined || queueNumber === '') {
    return isDetailingPayCategory(payCategory) ? 'D---' : 'Q---'
  }
  const prefix = isDetailingPayCategory(payCategory) ? 'D' : 'Q'
  return `${prefix}-${String(queueNumber).padStart(3, '0')}`
}
