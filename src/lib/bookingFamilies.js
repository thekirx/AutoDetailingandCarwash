/**
 * Customer app Book: the bookable detailing packages grouped into three services
 * (PPF, Ceramic Coating, Nano Ceramic Tint). Ceramic asks one question first
 * ("already coated?"); PPF and Tint go straight to picking a package.
 */

export const BOOKING_FAMILIES = [
  { key: 'ppf', title: 'Paint Protection Film', blurb: 'Clear, coloured or satin film', pickTitle: 'Pick your package' },
  { key: 'ceramic', title: 'Ceramic Coating', blurb: 'Coating and paint maintenance', pickTitle: 'Pick your coating' },
  { key: 'tint', title: 'Nano Ceramic Tint', blurb: 'Heat-rejecting window film', pickTitle: 'Pick your tint' },
]

/** Coated answers for the Ceramic question. */
export const COATED_CHOICES = [
  { id: 'hakum', label: 'Yes, coated at Hakum', hint: 'You need Ceramic Paint Maintenance.' },
  { id: 'elsewhere', label: 'Yes, coated somewhere else', hint: 'Our team will assess it first.' },
  { id: 'no', label: 'No, not yet', hint: 'We’ll start with a full coating.' },
]

export function bookingFamilyOf(service = {}) {
  const hay = `${service.slug || ''} ${service.name || ''}`.toLowerCase()
  if (/\bppf\b|paint-protection-film|paint protection film/.test(hay) || hay.includes('ppf')) return 'ppf'
  if (hay.includes('tint')) return 'tint'
  return 'ceramic'
}

export function isMaintenanceService(service = {}) {
  return `${service.slug || ''} ${service.name || ''}`.toLowerCase().includes('maintenance')
}

/** Lowest price the service can cost across car sizes (minor units). */
export function lowestPriceMinor(service = {}) {
  const sizes = Object.values(service.size_prices || {}).map(Number).filter((n) => n > 0)
  if (sizes.length) return Math.min(...sizes)
  return Number(service.price_minor || 0)
}

/** Families that have at least one bookable service, in display order, with their services. */
export function groupBookingFamilies(services = []) {
  return BOOKING_FAMILIES.map((fam) => {
    const items = services.filter((s) => bookingFamilyOf(s) === fam.key)
    const prices = items.map(lowestPriceMinor).filter((n) => n > 0)
    return { ...fam, items, fromMinor: prices.length ? Math.min(...prices) : 0 }
  }).filter((fam) => fam.items.length)
}

/** Packages offered on the pick step. Ceramic narrows by the coated answer. */
export function familyPickItems(family, coated = '') {
  const items = family?.items || []
  if (family?.key !== 'ceramic') return items
  if (coated === 'hakum') return items.filter(isMaintenanceService)
  if (coated === 'no') return items.filter((s) => !isMaintenanceService(s))
  return []
}

/** Service the booking is filed under when a car coated elsewhere needs an assessment. */
export function assessmentServiceFor(family) {
  const items = family?.items || []
  return items.find(isMaintenanceService) || items[0] || null
}

export function bookingFamilySteps(familyKey, { hasPackages = false } = {}) {
  return [
    'car',
    ...(familyKey === 'ceramic' ? ['coated'] : []),
    'pick',
    ...(hasPackages ? ['package'] : []),
    'when',
    'details',
    'review',
  ]
}
