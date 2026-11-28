import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'
import {
  PH_DEFAULT_CENTER,
  isPhilippinesBounds,
  mergePhSearchResults,
  readBrowserLocation,
  reverseGeocodePhDetails,
  searchPhilippinesPlaces,
  suggestPhilippinesPlaces,
} from '@/lib/phPlaces'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const QUICK_PH_PILLS = [
  { id: 'ph-bacoor', label: 'Bacoor', address: 'Bacoor, Cavite', lat: 14.459, lng: 120.929 },
  { id: 'ph-imus', label: 'Imus', address: 'Imus, Cavite', lat: 14.4297, lng: 120.9367 },
  { id: 'ph-dasmarinas', label: 'Dasmariñas', address: 'Dasmariñas, Cavite', lat: 14.3294, lng: 120.9367 },
  { id: 'ph-alabang', label: 'Alabang', address: 'Alabang, Muntinlupa', lat: 14.4176, lng: 121.0422 },
  { id: 'ph-makati', label: 'Makati', address: 'Makati, Metro Manila', lat: 14.5547, lng: 121.0244 },
  { id: 'ph-bgc', label: 'BGC', address: 'BGC, Taguig', lat: 14.5506, lng: 121.0494 },
  { id: 'ph-batangas', label: 'Batangas City', address: 'Batangas City, Batangas', lat: 13.7563, lng: 121.0583 },
  { id: 'ph-lipa', label: 'Lipa', address: 'Lipa City, Batangas', lat: 13.9411, lng: 121.1631 },
  { id: 'ph-cebu', label: 'Cebu', address: 'Cebu City, Cebu', lat: 10.3157, lng: 123.8854 },
  { id: 'ph-davao', label: 'Davao', address: 'Davao City, Davao del Sur', lat: 7.1907, lng: 125.4553 },
]

/**
 * Shared Philippines-wide smart search + GPS auto-locate + interactive Leaflet smart pin.
 * Adapts styling cleanly to Customer App (`variant="capp"`) and Public Website (`variant="public"`).
 */
export default function PhilippinesSmartPinField({
  value = null,
  branches = [],
  onChange,
  variant = 'capp',
  inputId = 'ph-smart-location-search',
  mapHeight = 220,
}) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const branchLayerRef = useRef(null)
  const searchWrapRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [remoteHits, setRemoteHits] = useState([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [resolvingPin, setResolvingPin] = useState(false)
  const [error, setError] = useState('')

  const lat = value?.lat != null && Number.isFinite(Number(value.lat)) ? Number(value.lat) : null
  const lng = value?.lng != null && Number.isFinite(Number(value.lng)) ? Number(value.lng) : null

  const instantHits = useMemo(() => suggestPhilippinesPlaces(query, { limit: 6 }), [query])
  const hits = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return dropdownOpen ? instantHits.slice(0, 5) : []
    return mergePhSearchResults(instantHits, remoteHits, { limit: 7 })
  }, [query, dropdownOpen, instantHits, remoteHits])

  useEffect(() => {
    if (!dropdownOpen) return undefined
    const onPointerDown = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined
    const center = lat != null && lng != null ? [lat, lng] : [PH_DEFAULT_CENTER.lat, PH_DEFAULT_CENTER.lng]
    const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView(center, lat != null ? 14 : 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map)
    const branchLayer = L.layerGroup().addTo(map)

    async function handlePinMove(nextLat, nextLng) {
      if (!isPhilippinesBounds(nextLat, nextLng)) {
        setError('Please place your pin within the Philippines.')
        return
      }
      setError('')
      setResolvingPin(true)
      try {
        const details = await reverseGeocodePhDetails(nextLat, nextLng)
        onChangeRef.current?.({
          lat: nextLat,
          lng: nextLng,
          label: details.shortLabel,
          address: details.fullAddress,
          source: 'manual',
        })
      } catch {
        onChangeRef.current?.({
          lat: nextLat,
          lng: nextLng,
          label: `${nextLat.toFixed(4)}, ${nextLng.toFixed(4)}`,
          address: `${nextLat.toFixed(4)}, ${nextLng.toFixed(4)}`,
          source: 'manual',
        })
      } finally {
        setResolvingPin(false)
      }
    }

    marker.on('dragend', () => {
      const p = marker.getLatLng()
      handlePinMove(p.lat, p.lng)
    })

    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      handlePinMove(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map
    markerRef.current = marker
    branchLayerRef.current = branchLayer
    window.setTimeout(() => map.invalidateSize(), 120)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      branchLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize Leaflet once
  }, [])

  // Plot Hakum studio pins cleanly using active CSS tokens so light/dark/public themes match automatically
  useEffect(() => {
    const layer = branchLayerRef.current
    if (!layer || !mapEl.current) return
    const styles = getComputedStyle(mapEl.current)
    const stroke = styles.getPropertyValue('--bd-paper').trim() || styles.getPropertyValue('--capp-surface').trim() || 'white'
    const openFill = styles.getPropertyValue('--bd-blue').trim() || styles.getPropertyValue('--capp-accent').trim() || 'royalblue'
    const soonFill = styles.getPropertyValue('--bd-ink-2').trim() || styles.getPropertyValue('--capp-steel').trim() || 'slategray'
    layer.clearLayers()
    for (const b of branches || []) {
      const bLat = Number(b?.latitude)
      const bLng = Number(b?.longitude)
      if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) continue
      L.circleMarker([bLat, bLng], {
        radius: 7,
        weight: 2,
        color: stroke,
        fillColor: b.coming_soon ? soonFill : openFill,
        fillOpacity: 0.95,
      })
        .bindTooltip(`${String(b.name || '').replace(/^Hakum Auto Care\s*/i, 'Hakum ')}${b.coming_soon ? ' (Soon)' : ''}`)
        .addTo(layer)
    }
  }, [branches])

  // Sync external coordinate changes onto map pin
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || lat == null || lng == null) return
    const next = L.latLng(lat, lng)
    markerRef.current.setLatLng(next)
    mapRef.current.setView(next, Math.max(mapRef.current.getZoom(), 13), { animate: true })
  }, [lat, lng])

  // Live OpenStreetMap Nominatim search across the entire Philippines
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setRemoteHits([])
      setSearching(false)
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const rows = await searchPhilippinesPlaces(q, { limit: 6 })
        if (!cancelled) setRemoteHits(rows)
      } catch {
        // Keep instant PH suggestions cleanly when Nominatim is offline or rate-limited
        if (!cancelled) setRemoteHits([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  async function handleAutoLocate() {
    setLocating(true)
    setError('')
    try {
      const pos = await readBrowserLocation()
      setResolvingPin(true)
      const details = await reverseGeocodePhDetails(pos.lat, pos.lng)
      onChange?.({
        lat: pos.lat,
        lng: pos.lng,
        label: details.shortLabel,
        address: details.fullAddress,
        source: 'gps',
      })
      setQuery('')
      setDropdownOpen(false)
    } catch (err) {
      setError(err?.message || 'Unable to read GPS location. Type a city or drop a pin on the map.')
    } finally {
      setLocating(false)
      setResolvingPin(false)
    }
  }

  function pickSuggestion(hit) {
    setQuery('')
    setRemoteHits([])
    setDropdownOpen(false)
    setError('')
    onChange?.({
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label,
      address: hit.fullAddress || hit.address || hit.label,
      source: 'manual',
    })
  }

  const rootClass = variant === 'public' ? 'bd-smart-loc' : 'capp-smart-loc'

  return (
    <div className={rootClass}>
      <div className="smart-loc-field">
        <label htmlFor={inputId} className="smart-loc-label">
          Search anywhere in the Philippines
        </label>
        <div className="smart-loc-input-row">
          <div className="smart-loc-input-wrap" ref={searchWrapRef}>
            <Search size={16} strokeWidth={1.8} className="smart-loc-icon" aria-hidden />
            <input
              id={inputId}
              type="text"
              className="smart-loc-input"
              value={query}
              placeholder="Barangay, city, mall, street, or landmark…"
              autoComplete="off"
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setDropdownOpen(true)
              }}
            />
            {searching ? (
              <Loader2 size={15} className="smart-loc-spin animate-spin" aria-hidden />
            ) : query ? (
              <button
                type="button"
                className="smart-loc-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  setRemoteHits([])
                }}
              >
                <X size={14} aria-hidden />
              </button>
            ) : null}

            {dropdownOpen && hits.length > 0 ? (
              <ul className="smart-loc-dropdown" role="listbox" aria-label="Philippines location suggestions">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="smart-loc-hit"
                      onClick={() => pickSuggestion(hit)}
                    >
                      <MapPin size={15} strokeWidth={1.85} className="smart-loc-hit-pin" aria-hidden />
                      <span className="smart-loc-hit-text">
                        <strong>{hit.label}</strong>
                        {hit.address && hit.address !== hit.label ? <small>{hit.address}</small> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            className="smart-loc-gps-btn"
            onClick={handleAutoLocate}
            disabled={locating}
            aria-busy={locating}
          >
            {locating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Crosshair size={15} aria-hidden />}
            <span>{locating ? 'Locating…' : 'Use GPS'}</span>
          </button>
        </div>
      </div>

      <div className="smart-loc-pills" role="group" aria-label="Quick Philippine cities">
        {QUICK_PH_PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className={`smart-loc-pill ${value?.label && value.label.toLowerCase().includes(pill.label.toLowerCase()) ? 'is-active' : ''}`}
            onClick={() => pickSuggestion(pill)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="smart-loc-map-wrap">
        <div ref={mapEl} className="smart-loc-map" style={{ height: `${mapHeight}px` }} />
        <p className="smart-loc-map-hint">
          {resolvingPin
            ? 'Updating place name from pin…'
            : 'Tap anywhere on the map or drag the pin anywhere in the Philippines.'}
        </p>
      </div>

      {error ? (
        <p className="smart-loc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
