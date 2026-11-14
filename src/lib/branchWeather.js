/** Open-Meteo current conditions — no API key. Coords from the selected Hakum branch. */

const CACHE_MS = 15 * 60 * 1000

const WMO = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Snow',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
}

export function weatherLabelFromCode(code) {
  const n = Number(code)
  if (!Number.isFinite(n)) return 'Weather'
  return WMO[n] || (n >= 50 && n < 70 ? 'Rain' : n >= 80 && n < 90 ? 'Showers' : 'Weather')
}

/**
 * One line under the temperature. Empty when the code is unknown.
 * `isDay` is Open-Meteo's `is_day` flag: after dark the line talks about tonight, never "sunny".
 */
export function weatherForecastLine(code, { isDay = true } = {}) {
  if (code == null || code === '') return ''
  const n = Number(code)
  if (!Number.isFinite(n)) return ''
  const when = isDay ? 'today' : 'tonight'
  if (n <= 1) return isDay ? "It's sunny today." : 'Clear skies tonight.'
  if (n === 2) return `It's partly cloudy ${when}.`
  if (n === 3) return `It's cloudy ${when}.`
  if (n === 45 || n === 48) return `It's foggy ${when}.`
  if (n >= 51 && n <= 67) return `It's raining ${when}.`
  if (n >= 71 && n <= 77) return `It's snowing ${when}.`
  if (n >= 80 && n <= 82) return `Showers ${when}.`
  if (n >= 95) return `Storms ${when} — take it easy on the road.`
  return ''
}

export function weatherCacheKey(lat, lng) {
  return `hakum-wx:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`
}

export function coordsForWeather(branch, fallback = { lat: 14.459, lng: 120.929 }) {
  const lat = Number(branch?.latitude)
  const lng = Number(branch?.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return fallback
}

/**
 * Resolve weather coordinates: always prefer the user's current location (GPS or saved pin)
 * so weather reflects where the customer actually is, not whichever branch they pick.
 */
export function resolveWeatherTarget({ userCoords = null, branch = null, fallback = { lat: 14.459, lng: 120.929 } } = {}) {
  const uLat = Number(userCoords?.lat)
  const uLng = Number(userCoords?.lng)
  if (Number.isFinite(uLat) && Number.isFinite(uLng) && uLat >= -90 && uLat <= 90 && uLng >= -180 && uLng <= 180) {
    return { lat: uLat, lng: uLng, source: 'user' }
  }
  const bLat = Number(branch?.latitude)
  const bLng = Number(branch?.longitude)
  if (Number.isFinite(bLat) && Number.isFinite(bLng)) {
    return { lat: bLat, lng: bLng, source: 'branch' }
  }
  return { ...fallback, source: 'fallback' }
}

export async function fetchBranchWeather(lat, lng, { fetchImpl = fetch, now = Date.now(), storage } = {}) {
  const key = weatherCacheKey(lat, lng)
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage)
  if (store) {
    try {
      const hit = JSON.parse(store.getItem(key) || 'null')
      if (hit && now - hit.at < CACHE_MS) return hit.data
    } catch {
      /* ignore bad cache */
    }
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FManila`
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null
  let res
  try {
    res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined)
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (!res.ok) throw new Error('Weather unavailable')
  const body = await res.json()
  const temp = Number(body?.current?.temperature_2m)
  const code = body?.current?.weather_code
  if (!Number.isFinite(temp)) throw new Error('Weather unavailable')
  const data = {
    tempC: Math.round(temp),
    label: weatherLabelFromCode(code),
    // Open-Meteo sends is_day as 1/0; a missing flag keeps the daytime wording.
    line: weatherForecastLine(code, { isDay: body?.current?.is_day !== 0 }),
  }
  try {
    store?.setItem(key, JSON.stringify({ at: now, data }))
  } catch {
    /* quota */
  }
  return data
}
