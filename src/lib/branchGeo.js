/** Fallback coordinates for nearest-branch (PH). Upgrade: store lat/lng on branches. */
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

/** @returns {{ slug: string, distanceKm: number } | null} */
export function nearestBranchSlug(userCoords, branches = []) {
  if (!userCoords?.lat || !userCoords?.lng) return null
  let best = null
  for (const row of branches) {
    const geo = BRANCH_GEO[row.slug] || (row.latitude != null ? { lat: Number(row.latitude), lng: Number(row.longitude) } : null)
    if (!geo) continue
    const distanceKm = haversineKm(userCoords, geo)
    if (!best || distanceKm < best.distanceKm) best = { slug: row.slug, distanceKm, name: row.name }
  }
  return best
}
