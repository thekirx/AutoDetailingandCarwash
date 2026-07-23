/**
 * Philippines place search via OpenStreetMap Nominatim (no API key).
 * Respect Nominatim usage policy: debounce ≥1s, identify app in User-Agent.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const UA = 'HakumAutoCare/1.0 (branch-locator; admin@hakumautocare.com)'

let lastSearchAt = 0

async function throttledFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastSearchAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastSearchAt = Date.now()
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  return res.json()
}

/** @returns {Promise<Array<{ id: string, label: string, address: string, lat: number, lng: number }>>} */
export async function searchPhilippinesPlaces(query, { limit = 6 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 3) return []
  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'ph')
  url.searchParams.set('limit', String(limit))
  const rows = await throttledFetch(url.toString())
  return (rows || []).map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    address: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  }))
}

/** Reverse geocode PH pin → address string */
export async function reverseGeocodePh(lat, lng) {
  const url = new URL(`${NOMINATIM}/reverse`)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('zoom', '18')
  url.searchParams.set('addressdetails', '1')
  const row = await throttledFetch(url.toString())
  return row?.display_name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
}

export function readBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Unable to read your location.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  })
}

/** Default map center — Metro Manila / Cavite corridor */
export const PH_DEFAULT_CENTER = { lat: 14.45, lng: 120.98 }
