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

export function weatherCacheKey(lat, lng) {
  return `hakum-wx:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`
}

export function coordsForWeather(branch, fallback = { lat: 14.459, lng: 120.929 }) {
  const lat = Number(branch?.latitude)
  const lng = Number(branch?.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return fallback
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current=temperature_2m,weather_code&timezone=Asia%2FManila`
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
  }
  try {
    store?.setItem(key, JSON.stringify({ at: now, data }))
  } catch {
    /* quota */
  }
  return data
}
