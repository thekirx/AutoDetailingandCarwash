/** Seed coords for legacy rows before DB lat/lng existed. Prefer row.latitude/longitude. */
export const BRANCH_GEO = {
  bacoor: { lat: 14.459, lng: 120.929, label: 'Bacoor' },
  batangas: { lat: 13.7563, lng: 121.0583, label: 'Batangas' },
}

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function coordsForBranch(row) {
  const rawLat = row?.latitude
  const rawLng = row?.longitude
  if (rawLat != null && rawLat !== '' && rawLng != null && rawLng !== '') {
    const lat = Number(rawLat)
    const lng = Number(rawLng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, label: row.name }
  }
  return BRANCH_GEO[row?.slug] || null
}

function originCoords(userCoords) {
  const lat = Number(userCoords?.lat)
  const lng = Number(userCoords?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Distance from a pin to one branch, or null when either side has no coordinates. */
export function branchDistanceKm(userCoords, row) {
  const origin = originCoords(userCoords)
  const geo = coordsForBranch(row)
  if (!origin || !geo) return null
  return haversineKm(origin, geo)
}

/** @returns {{ slug: string, distanceKm: number, name?: string } | null} */
export function nearestBranchSlug(userCoords, branches = []) {
  const origin = originCoords(userCoords)
  if (!origin) return null
  let best = null
  for (const row of branches) {
    if (row.coming_soon || row.is_active === false) continue
    const geo = coordsForBranch(row)
    if (!geo) continue
    const distanceKm = haversineKm(origin, geo)
    if (!best || distanceKm < best.distanceKm) {
      best = { slug: row.slug, distanceKm, name: row.name || geo.label }
    }
  }
  return best
}
