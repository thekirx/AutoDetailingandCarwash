/** Landing-page packages seeded under the four detailing services. Prices are centavos. */

export const LANDING_DETAILING_PACKAGES = [
  {
    parentSlug: 'ceramic-coating',
    slug: 'ceramic-coating-premium',
    name: 'Premium',
    pitch: 'Deeper gloss and stronger water repellency, covered for five years.',
    points: 5,
    priceMinor: 0,
    displayOrder: 1,
  },
  {
    parentSlug: 'ceramic-coating',
    slug: 'ceramic-coating-platinum',
    name: 'Platinum',
    pitch: 'Our highest gloss and longest paint preservation, covered for eight years.',
    points: 5,
    priceMinor: 0,
    displayOrder: 2,
  },
  {
    parentSlug: 'paint-protection-film',
    slug: 'ppf-high-impact',
    name: 'High Impact Partial',
    pitch: 'Film on the front of the car, ceramic coating on the rest. From ₱48,000.',
    points: 10,
    priceMinor: 4_800_000,
    displayOrder: 1,
  },
  {
    parentSlug: 'paint-protection-film',
    slug: 'ppf-basic',
    name: 'Basic PPF Protection',
    pitch: 'Full-body protection on 7.5 mil film with a 7-year warranty. From ₱75,000.',
    points: 10,
    priceMinor: 7_500_000,
    displayOrder: 2,
  },
  {
    parentSlug: 'paint-protection-film',
    slug: 'ppf-ultimate',
    name: 'Ultimate PPF Protection',
    pitch: 'Thicker full-body film, 10-year warranty, panel replacement. From ₱94,000.',
    points: 10,
    priceMinor: 9_400_000,
    displayOrder: 3,
  },
  {
    parentSlug: 'paint-protection-film',
    slug: 'ppf-platinum',
    name: 'Platinum PPF Protection',
    pitch: 'Thickest film, rocker panels, 12-year warranty. From ₱130,000.',
    points: 10,
    priceMinor: 13_000_000,
    displayOrder: 4,
  },
]

export function packagesForService(services, parentId) {
  if (!parentId) return []
  return (services || [])
    .filter((row) => row.parent_service_id === parentId && row.is_active !== false && !row.is_archived)
    .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0) || String(a.name).localeCompare(String(b.name)))
}

/** A booked package row is stored as the booking service. Parents stay the picker. */
export function splitBookedService(services, serviceId) {
  const row = (services || []).find((item) => item.id === serviceId)
  if (row?.parent_service_id) return { serviceId: row.parent_service_id, packageId: row.id }
  return { serviceId: serviceId || '', packageId: '' }
}

/** Package id when the service has packages; otherwise the service id. Empty if a required package was not picked. */
export function bookedDetailingServiceId(serviceId, packageId, packages) {
  if (packages?.length) return packages.some((row) => row.id === packageId) ? packageId : ''
  return serviceId || ''
}
