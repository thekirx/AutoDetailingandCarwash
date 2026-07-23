import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PH_DEFAULT_CENTER,
  readBrowserLocation,
  reverseGeocodePh,
  searchPhilippinesPlaces,
} from '@/lib/phPlaces'

// Leaflet default marker icons break under Vite bundling — use CDN glyphs
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

/**
 * PH place search + geolocation + draggable map pin.
 * onChange({ latitude, longitude, address })
 */
export default function BranchLocationPicker({ latitude, longitude, address, onChange }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const lat = latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null
  const lng = longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined
    const center = lat != null && lng != null ? [lat, lng] : [PH_DEFAULT_CENTER.lat, PH_DEFAULT_CENTER.lng]
    const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView(center, lat != null ? 15 : 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map)
    marker.on('dragend', async () => {
      const p = marker.getLatLng()
      setError('')
      try {
        const addr = await reverseGeocodePh(p.lat, p.lng)
        onChange({ latitude: p.lat, longitude: p.lng, address: addr })
      } catch (err) {
        onChange({ latitude: p.lat, longitude: p.lng, address: address || '' })
        setError(err.message)
      }
    })
    map.on('click', async (e) => {
      marker.setLatLng(e.latlng)
      setError('')
      try {
        const addr = await reverseGeocodePh(e.latlng.lat, e.latlng.lng)
        onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng, address: addr })
      } catch (err) {
        onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng, address: address || '' })
        setError(err.message)
      }
    })

    mapRef.current = map
    markerRef.current = marker
    // Invalidate size after layout
    window.setTimeout(() => map.invalidateSize(), 80)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || lat == null || lng == null) return
    const next = L.latLng(lat, lng)
    markerRef.current.setLatLng(next)
    mapRef.current.setView(next, Math.max(mapRef.current.getZoom(), 15))
  }, [lat, lng])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setHits([])
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const rows = await searchPhilippinesPlaces(q)
        if (!cancelled) setHits(rows)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  async function useMyLocation() {
    setLocating(true)
    setError('')
    try {
      const pos = await readBrowserLocation()
      const addr = await reverseGeocodePh(pos.lat, pos.lng)
      onChange({ latitude: pos.lat, longitude: pos.lng, address: addr })
    } catch (err) {
      setError(err.message)
    } finally {
      setLocating(false)
    }
  }

  function pickHit(hit) {
    setQuery('')
    setHits([])
    onChange({ latitude: hit.lat, longitude: hit.lng, address: hit.address })
  }

  return (
    <div className="branch-location flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="branch-place-search">Find place in the Philippines</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="branch-place-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, mall, barangay, street…"
            className="pl-9"
            autoComplete="off"
          />
          {searching ? <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-background shadow-lg">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onClick={() => pickHit(hit)}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="leading-snug">{hit.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          <Crosshair className="mr-1.5 size-4" />
          {locating ? 'Locating…' : 'Use my location'}
        </Button>
        {lat != null && lng != null ? (
          <span className="self-center text-xs text-muted-foreground tabular-nums">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        ) : (
          <span className="self-center text-xs text-muted-foreground">Search or tap the map to drop a pin</span>
        )}
      </div>

      <div ref={mapEl} className="branch-location-map h-[260px] w-full overflow-hidden rounded-xl border border-border" />

      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}
