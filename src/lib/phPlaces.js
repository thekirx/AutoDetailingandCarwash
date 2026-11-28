/**
 * Philippines-wide place search, reverse geocoding, and smart suggestions.
 * Uses instant client-side PH index + live OpenStreetMap Nominatim (countrycodes=ph).
 */

import { haversineKm } from './branchGeo.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

let lastSearchAt = 0

async function throttledFetch(url) {
  const wait = Math.max(0, 900 - (Date.now() - lastSearchAt))
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastSearchAt = Date.now()
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null
  let res
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  return res.json()
}

/** Curated PH hubs across Metro Manila, South Luzon, North Luzon, Visayas, Mindanao for instant offline/typeahead coverage. */
export const PH_SMART_PRESETS = Object.freeze([
  // Cavite & Laguna & Batangas (South Luzon corridor)
  { id: 'ph-bacoor', label: 'Bacoor, Cavite', address: 'Bacoor, Cavite, Calabarzon', lat: 14.459, lng: 120.929, aliases: ['molino', 'sm bacoor', 'rfc'] },
  { id: 'ph-molino', label: 'Molino II, Bacoor, Cavite', address: 'Molino Boulevard, Bacoor, Cavite', lat: 14.4148, lng: 120.9768, aliases: ['molino blvd', 'daang hari'] },
  { id: 'ph-imus', label: 'Imus, Cavite', address: 'Imus, Cavite, Calabarzon', lat: 14.4297, lng: 120.9367, aliases: ['somo', 'bucandala', 'buhay na tubig'] },
  { id: 'ph-dasmarinas', label: 'Dasmariñas, Cavite', address: 'Dasmariñas, Cavite, Calabarzon', lat: 14.3294, lng: 120.9367, aliases: ['dasma', 'sm dasma', 'pala-pala'] },
  { id: 'ph-kawit', label: 'Kawit, Cavite', address: 'Kawit, Cavite, Calabarzon', lat: 14.4437, lng: 120.9022, aliases: ['evo city', 'cavitex'] },
  { id: 'ph-gentri', label: 'General Trias, Cavite', address: 'General Trias, Cavite, Calabarzon', lat: 14.3867, lng: 120.8819, aliases: ['gentri', 'lancaster', 'manggahan'] },
  { id: 'ph-tagaytay', label: 'Tagaytay, Cavite', address: 'Tagaytay City, Cavite, Calabarzon', lat: 14.1153, lng: 120.9621, aliases: ['rotunda', 'sky ranch'] },
  { id: 'ph-trece', label: 'Trece Martires, Cavite', address: 'Trece Martires, Cavite, Calabarzon', lat: 14.2814, lng: 120.8675, aliases: ['trece'] },
  { id: 'ph-silang', label: 'Silang, Cavite', address: 'Silang, Cavite, Calabarzon', lat: 14.2306, lng: 120.975, aliases: [] },
  { id: 'ph-carmona', label: 'Carmona, Cavite', address: 'Carmona, Cavite, Calabarzon', lat: 14.3136, lng: 121.0575, aliases: [] },
  { id: 'ph-tanza', label: 'Tanza, Cavite', address: 'Tanza, Cavite, Calabarzon', lat: 14.3944, lng: 120.8533, aliases: [] },
  { id: 'ph-batangas', label: 'Batangas City, Batangas', address: 'Alangilan / Batangas City, Batangas', lat: 13.7563, lng: 121.0583, aliases: ['alangilan', 'pallocan', 'batangas', 'kumintang'] },
  { id: 'ph-lipa', label: 'Lipa City, Batangas', address: 'Lipa City, Batangas, Calabarzon', lat: 13.9411, lng: 121.1631, aliases: ['lipa', 'sm lipa'] },
  { id: 'ph-tanauan', label: 'Tanauan City, Batangas', address: 'Tanauan, Batangas, Calabarzon', lat: 14.0863, lng: 121.1497, aliases: ['tanauan'] },
  { id: 'ph-stotomas', label: 'Santo Tomas, Batangas', address: 'Santo Tomas, Batangas, Calabarzon', lat: 14.1079, lng: 121.1414, aliases: ['sto tomas'] },
  { id: 'ph-bauan', label: 'Bauan, Batangas', address: 'Bauan, Batangas, Calabarzon', lat: 13.7917, lng: 121.0086, aliases: [] },
  { id: 'ph-nasugbu', label: 'Nasugbu, Batangas', address: 'Nasugbu, Batangas, Calabarzon', lat: 14.0725, lng: 120.6331, aliases: [] },
  { id: 'ph-sanpedro', label: 'San Pedro, Laguna', address: 'San Pedro, Laguna, Calabarzon', lat: 14.3595, lng: 121.0473, aliases: ['pacita'] },
  { id: 'ph-binan', label: 'Biñan, Laguna', address: 'Biñan, Laguna, Calabarzon', lat: 14.342, lng: 121.0807, aliases: ['binan', 'southwoods'] },
  { id: 'ph-starosa', label: 'Santa Rosa, Laguna', address: 'Santa Rosa / Nuvali, Laguna', lat: 14.3122, lng: 121.1114, aliases: ['nuvali', 'sta rosa', 'solenad'] },
  { id: 'ph-calamba', label: 'Calamba, Laguna', address: 'Calamba, Laguna, Calabarzon', lat: 14.2117, lng: 121.1653, aliases: [] },
  { id: 'ph-losbanos', label: 'Los Baños, Laguna', address: 'Los Baños, Laguna, Calabarzon', lat: 14.1703, lng: 121.2436, aliases: ['los banos', 'uplb'] },
  { id: 'ph-sanpablo', label: 'San Pablo, Laguna', address: 'San Pablo City, Laguna, Calabarzon', lat: 14.0642, lng: 121.3233, aliases: [] },
  // Metro Manila
  { id: 'ph-alabang', label: 'Alabang, Muntinlupa', address: 'Alabang / Filinvest City, Muntinlupa, Metro Manila', lat: 14.4176, lng: 121.0422, aliases: ['muntinlupa', 'filinvest', 'festival mall', 'atc'] },
  { id: 'ph-laspinas', label: 'Las Piñas, Metro Manila', address: 'Almanza / Las Piñas, Metro Manila', lat: 14.4445, lng: 120.9939, aliases: ['las pinas', 'almanza', 'southmall'] },
  { id: 'ph-paranaque', label: 'Parañaque, Metro Manila', address: 'BF Homes / Parañaque, Metro Manila', lat: 14.4793, lng: 121.0198, aliases: ['paranaque', 'bf homes', 'sucat', 'bicutan'] },
  { id: 'ph-pasay', label: 'Pasay / MOA, Metro Manila', address: 'Mall of Asia Complex, Pasay, Metro Manila', lat: 14.5351, lng: 120.9822, aliases: ['moa', 'mall of asia', 'pasay', 'naia'] },
  { id: 'ph-makati', label: 'Makati CBD, Makati', address: 'Ayala / Poblacion, Makati, Metro Manila', lat: 14.5547, lng: 121.0244, aliases: ['ayala', 'glorietta', 'greenbelt', 'makati'] },
  { id: 'ph-bgc', label: 'BGC, Taguig', address: 'Bonifacio Global City, Taguig, Metro Manila', lat: 14.5506, lng: 121.0494, aliases: ['bgc', 'bonifacio global city', 'taguig', 'high street'] },
  { id: 'ph-ortigas', label: 'Ortigas Center, Pasig', address: 'Ortigas / Kapitolyo, Pasig, Metro Manila', lat: 14.5869, lng: 121.0614, aliases: ['pasig', 'ortigas', 'megamall'] },
  { id: 'ph-mandaluyong', label: 'Mandaluyong, Metro Manila', address: 'Shaw / Greenfield, Mandaluyong, Metro Manila', lat: 14.5794, lng: 121.0359, aliases: [] },
  { id: 'ph-manila', label: 'Manila, Metro Manila', address: 'Ermita / Malate, Manila, Metro Manila', lat: 14.5995, lng: 120.9842, aliases: ['intramuros', 'malate', 'ermita'] },
  { id: 'ph-qc', label: 'Quezon City, Metro Manila', address: 'Diliman / Tomas Morato, Quezon City, Metro Manila', lat: 14.676, lng: 121.0437, aliases: ['qc', 'diliman', 'katipunan', 'cubao', 'trinoma'] },
  { id: 'ph-marikina', label: 'Marikina, Metro Manila', address: 'Marikina Valley, Metro Manila', lat: 14.6507, lng: 121.1029, aliases: [] },
  { id: 'ph-caloocan', label: 'Caloocan, Metro Manila', address: 'Monumento, Caloocan, Metro Manila', lat: 14.6571, lng: 120.9841, aliases: [] },
  // Rizal, North & Central Luzon
  { id: 'ph-antipolo', label: 'Antipolo, Rizal', address: 'Antipolo City, Rizal', lat: 14.5863, lng: 121.1753, aliases: ['rizal', 'sumulong'] },
  { id: 'ph-cainta', label: 'Cainta, Rizal', address: 'Cainta, Rizal', lat: 14.5778, lng: 121.1222, aliases: [] },
  { id: 'ph-malolos', label: 'Malolos, Bulacan', address: 'Malolos, Bulacan', lat: 14.8527, lng: 120.816, aliases: ['bulacan'] },
  { id: 'ph-sanfernando', label: 'San Fernando, Pampanga', address: 'City of San Fernando, Pampanga', lat: 15.0286, lng: 120.6897, aliases: ['pampanga'] },
  { id: 'ph-clark', label: 'Angeles / Clark, Pampanga', address: 'Clark Freeport / Angeles City, Pampanga', lat: 15.145, lng: 120.5887, aliases: ['angeles', 'clark'] },
  { id: 'ph-subic', label: 'Subic / Olongapo, Zambales', address: 'Subic Bay Freeport, Zambales', lat: 14.8292, lng: 120.2828, aliases: ['olongapo', 'sbfz'] },
  { id: 'ph-baguio', label: 'Baguio City, Benguet', address: 'Session Road / Baguio City, Benguet', lat: 16.4023, lng: 120.596, aliases: ['baguio'] },
  { id: 'ph-tarlac', label: 'Tarlac City, Tarlac', address: 'Tarlac City, Tarlac', lat: 15.4755, lng: 120.5963, aliases: [] },
  { id: 'ph-naga', label: 'Naga City, Camarines Sur', address: 'Naga City, Camarines Sur', lat: 13.6218, lng: 123.1948, aliases: ['bicol'] },
  { id: 'ph-legazpi', label: 'Legazpi City, Albay', address: 'Legazpi City, Albay', lat: 13.1391, lng: 123.7438, aliases: [] },
  // Visayas & Mindanao
  { id: 'ph-cebu', label: 'Cebu City, Cebu', address: 'IT Park / Ayala Center, Cebu City, Cebu', lat: 10.3157, lng: 123.8854, aliases: ['cebu', 'it park'] },
  { id: 'ph-mandaue', label: 'Mandaue City, Cebu', address: 'Mandaue City, Cebu', lat: 10.3236, lng: 123.9223, aliases: [] },
  { id: 'ph-iloilo', label: 'Iloilo City, Iloilo', address: 'Mandurriao / Iloilo City, Iloilo', lat: 10.7202, lng: 122.5621, aliases: ['iloilo'] },
  { id: 'ph-bacolod', label: 'Bacolod City, Negros Occidental', address: 'Bacolod City, Negros Occidental', lat: 10.6765, lng: 122.9509, aliases: ['bacolod'] },
  { id: 'ph-tacloban', label: 'Tacloban City, Leyte', address: 'Tacloban City, Leyte', lat: 11.2433, lng: 125.0047, aliases: [] },
  { id: 'ph-palawan', label: 'Puerto Princesa, Palawan', address: 'Puerto Princesa City, Palawan', lat: 9.7392, lng: 118.7353, aliases: ['palawan'] },
  { id: 'ph-davao', label: 'Davao City, Davao del Sur', address: 'Poblacion / Davao City, Davao del Sur', lat: 7.1907, lng: 125.4553, aliases: ['davao'] },
  { id: 'ph-cdo', label: 'Cagayan de Oro, Misamis Oriental', address: 'Cagayan de Oro City, Misamis Oriental', lat: 8.4542, lng: 124.6319, aliases: ['cdo', 'cagayan'] },
  { id: 'ph-gensan', label: 'General Santos, South Cotabato', address: 'General Santos City, South Cotabato', lat: 6.1164, lng: 125.1716, aliases: ['gensan'] },
])

/** Loose Philippines bounding box used to clamp / validate PH map pins. */
export function isPhilippinesBounds(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  return Number.isFinite(la) && Number.isFinite(ln) && la >= 4.2 && la <= 21.4 && ln >= 116.5 && ln <= 127.0
}

/**
 * Condense Nominatim or raw display strings into crisp primary + secondary labels.
 * Strips noisy country/postcode/region suffixes while keeping landmark + city/province.
 */
export function formatPhPlaceSummary(input) {
  if (!input) return { primary: '', secondary: '', full: '' }
  if (typeof input === 'string') {
    const parts = input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^philippines$/i.test(s) && !/^\d{4}$/.test(s) && !/^calabarzon|ncr|central luzon|metro manila district/i.test(s))
    if (!parts.length) return { primary: input.trim(), secondary: '', full: input.trim() }
    const primary = parts.slice(0, 2).join(', ')
    const secondary = parts.slice(2, 4).join(', ')
    return { primary, secondary, full: input.trim() }
  }

  const addr = input.address || {}
  const full = String(input.display_name || '').trim()
  const spot =
    addr.amenity ||
    addr.building ||
    addr.shop ||
    addr.mall ||
    addr.neighbourhood ||
    addr.suburb ||
    addr.village ||
    addr.quarter ||
    addr.road
  const locality = addr.city || addr.town || addr.municipality || addr.city_district
  const province = addr.province || addr.state || (locality !== 'Metro Manila' ? addr.region : '')

  const primaryParts = [spot, locality].filter((p, idx, arr) => p && arr.indexOf(p) === idx)
  if (primaryParts.length) {
    const primary = primaryParts.slice(0, 2).join(', ')
    const secondaryParts = [
      locality && !primaryParts.includes(locality) ? locality : null,
      province && province !== locality ? province : null,
    ].filter(Boolean)
    return {
      primary,
      secondary: secondaryParts.join(', '),
      full: full || [primary, ...secondaryParts].filter(Boolean).join(', '),
    }
  }
  return formatPhPlaceSummary(full)
}

/** Instant Philippines autocomplete from local city/hub index (works cleanly at 2+ chars or offline). */
export function suggestPhilippinesPlaces(query, { limit = 6 } = {}) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return PH_SMART_PRESETS.slice(0, limit)
  const scored = []
  for (const item of PH_SMART_PRESETS) {
    const label = item.label.toLowerCase()
    const addr = item.address.toLowerCase()
    const aliases = (item.aliases || []).map((a) => a.toLowerCase())
    let rank = 0
    if (label.startsWith(q) || aliases.some((a) => a === q)) rank = 4
    else if (aliases.some((a) => a.startsWith(q))) rank = 3
    else if (label.includes(q)) rank = 2
    else if (addr.includes(q) || aliases.some((a) => a.includes(q))) rank = 1
    if (rank > 0) scored.push({ item, rank })
  }
  scored.sort((a, b) => b.rank - a.rank || a.item.label.localeCompare(b.item.label))
  return scored.slice(0, limit).map(({ item }) => ({
    id: item.id,
    label: item.label,
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    source: 'preset',
  }))
}

/** Merge live Nominatim hits first (when available), appending non-overlapping PH preset suggestions. */
export function mergePhSearchResults(localHits = [], remoteHits = [], { limit = 8 } = {}) {
  const out = []
  const seenLabels = new Set()
  const push = (row) => {
    if (!row || !Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng))) return
    const norm = String(row.label || '').trim().toLowerCase()
    if (!norm || seenLabels.has(norm)) return
    const dupCoord = out.some((existing) => haversineKm(existing, row) < 0.35 && existing.label.toLowerCase() === norm)
    if (dupCoord) return
    seenLabels.add(norm)
    out.push(row)
  }
  for (const r of remoteHits || []) push(r)
  for (const l of localHits || []) push(l)
  return out.slice(0, limit)
}

/** @returns {Promise<Array<{ id: string, label: string, address: string, lat: number, lng: number }>>} */
export async function searchPhilippinesPlaces(query, { limit = 6 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 3) return []
  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'ph')
  url.searchParams.set('accept-language', 'en')
  url.searchParams.set('limit', String(limit))
  const rows = await throttledFetch(url.toString())
  return (rows || []).map((row) => {
    const summary = formatPhPlaceSummary(row)
    return {
      id: String(row.place_id),
      label: summary.primary || row.display_name,
      address: summary.secondary || row.display_name,
      fullAddress: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
      source: 'nominatim',
    }
  })
}

/** Reverse geocode PH pin → structured { shortLabel, fullAddress, lat, lng } */
export async function reverseGeocodePhDetails(lat, lng) {
  const numLat = Number(lat)
  const numLng = Number(lng)
  const fallbackCoord = `${numLat.toFixed(4)}, ${numLng.toFixed(4)}`
  try {
    const url = new URL(`${NOMINATIM}/reverse`)
    url.searchParams.set('lat', String(numLat))
    url.searchParams.set('lon', String(numLng))
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('zoom', '16')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'en')
    const row = await throttledFetch(url.toString())
    const summary = formatPhPlaceSummary(row)
    return {
      shortLabel: summary.primary || fallbackCoord,
      fullAddress: row?.display_name || summary.full || fallbackCoord,
      lat: numLat,
      lng: numLng,
    }
  } catch {
    // Graceful fallback to closest known PH corridor if Nominatim throttles/offline
    let best = null
    for (const preset of PH_SMART_PRESETS) {
      const km = haversineKm({ lat: numLat, lng: numLng }, preset)
      if (km <= 12 && (!best || km < best.km)) best = { preset, km }
    }
    const label = best ? `Near ${best.preset.label}` : fallbackCoord
    return { shortLabel: label, fullAddress: label, lat: numLat, lng: numLng }
  }
}

/** Reverse geocode PH pin → address string (compatible with BranchLocationPicker) */
export async function reverseGeocodePh(lat, lng) {
  const details = await reverseGeocodePhDetails(lat, lng)
  return details.fullAddress || details.shortLabel
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
