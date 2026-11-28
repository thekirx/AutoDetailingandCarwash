import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, Loader2, MapPin, Navigation, Phone } from 'lucide-react'
import { branchCityName } from '@/lib/branches'
import { formatCustomerLocationLabel, loadCustomerPin, saveCustomerPin } from '@/lib/customerLocation'
import { QUICK_CITY_ORIGINS, rankOpenBranchesForOrigin } from '@/lib/localBranchPages'
import { readBrowserLocation, reverseGeocodePhDetails } from '@/lib/phPlaces'
import '@/styles/seoLocal.css'

const PhilippinesSmartPinField = lazy(() => import('@/components/PhilippinesSmartPinField'))

/**
 * Interactive "nearest car wash / auto detailing studio near me" locator across
 * anywhere in the Philippines: GPS auto-detect, PH smart search, draggable smart pin,
 * quick-corridor shortcuts, and live branch distance ranking.
 */
export default function NearestBranchFinder({ branches = [], defaultCity = '', headingLevel = 'h2' }) {
  const [selectedCity, setSelectedCity] = useState(defaultCity)
  const [savedPin, setSavedPin] = useState(() => loadCustomerPin())
  const [mapOpen, setMapOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')

  useEffect(() => {
    const sync = () => setSavedPin(loadCustomerPin())
    window.addEventListener('hakum-customer-branch-sync', sync)
    return () => window.removeEventListener('hakum-customer-branch-sync', sync)
  }, [])

  const activePreset = useMemo(
    () => QUICK_CITY_ORIGINS.find((c) => c.id === selectedCity) || null,
    [selectedCity],
  )

  const originCoords = useMemo(
    () => (savedPin ? { lat: savedPin.lat, lng: savedPin.lng } : activePreset ? { lat: activePreset.lat, lng: activePreset.lng } : null),
    [savedPin, activePreset],
  )
  const ranked = useMemo(() => rankOpenBranchesForOrigin(originCoords, branches), [originCoords, branches])
  const Heading = headingLevel
  const currentLocationText = formatCustomerLocationLabel(savedPin)

  function applyOriginPin(nextPin) {
    const stored = saveCustomerPin(nextPin)
    if (!stored) return
    setSavedPin(stored)
    setSelectedCity('')
    setGeoError('')
    window.dispatchEvent(new CustomEvent('hakum-customer-branch-sync'))
  }

  async function handleUseGps() {
    setLocating(true)
    setGeoError('')
    try {
      const coords = await readBrowserLocation()
      applyOriginPin(coords)
      const details = await reverseGeocodePhDetails(coords.lat, coords.lng).catch(() => null)
      if (details?.shortLabel) {
        applyOriginPin({ ...coords, label: details.shortLabel, address: details.fullAddress })
      }
    } catch (err) {
      setGeoError(err?.message || 'Location permission declined — search or drop a pin anywhere in the Philippines.')
      setMapOpen(true)
    } finally {
      setLocating(false)
    }
  }

  function pickCity(city) {
    setGeoError('')
    if (selectedCity === city.id) {
      setSelectedCity('')
      return
    }
    setSavedPin(null)
    setSelectedCity(city.id)
    saveCustomerPin({ lat: city.lat, lng: city.lng, label: city.label, address: `${city.label}, Philippines` })
    window.dispatchEvent(new CustomEvent('hakum-customer-branch-sync'))
  }

  const closestSlug = originCoords && ranked[0]?.distanceKm != null ? ranked[0].branch.slug : null

  return (
    <section className="bd-near-finder bd-reveal" aria-labelledby="near-finder-heading">
      <div className="bd-near-head">
        <div>
          <p className="bd-eyebrow">Nearest studio near me</p>
          <Heading id="near-finder-heading">Find your closest Hakum branch</Heading>
          <p className="bd-near-copy">
            Auto-detect GPS or search and pin any address, barangay, or city anywhere in the Philippines to see your closest open Hakum studio.
          </p>
        </div>
        <div className="bd-near-head-actions">
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleUseGps} disabled={locating}>
            {locating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Crosshair size={15} aria-hidden="true" />}
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <button
            type="button"
            className="bd-btn bd-btn-quiet"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
          >
            <MapPin size={14} aria-hidden="true" />
            {mapOpen ? 'Hide PH search & map' : 'Search or pin PH map'}
          </button>
        </div>
      </div>

      {mapOpen ? (
        <div className="bd-near-picker-panel">
          <Suspense fallback={<p className="bd-near-copy">Loading Philippines map &amp; search…</p>}>
            <PhilippinesSmartPinField
              variant="public"
              value={savedPin}
              branches={branches}
              onChange={applyOriginPin}
              inputId="bd-ph-branch-search"
              mapHeight={240}
            />
          </Suspense>
        </div>
      ) : (
        <div className="bd-near-controls" role="group" aria-label="Quick city selector">
          {QUICK_CITY_ORIGINS.map((city) => (
            <button
              key={city.id}
              type="button"
              className={`bd-city-chip ${selectedCity === city.id ? 'is-active' : ''}`}
              onClick={() => pickCity(city)}
            >
              <MapPin size={13} aria-hidden="true" />
              {city.label}
            </button>
          ))}
        </div>
      )}

      {geoError ? (
        <p className="bd-near-copy" role="status">
          {geoError}
        </p>
      ) : null}

      {currentLocationText || activePreset || savedPin ? (
        <p className="bd-near-copy" role="status">
          Current location:{' '}
          <strong>
            {currentLocationText || activePreset?.label || `${savedPin.lat.toFixed(4)}, ${savedPin.lng.toFixed(4)}`}
          </strong>
          {ranked[0]?.distanceKm != null ? ` · Closest studio: ${branchCityName(ranked[0].branch)} (~${ranked[0].distanceKm.toFixed(1)} km)` : ''}
        </p>
      ) : null}

      <div className="bd-near-results">
        {ranked.map(({ branch, distanceKm, directions, phone }) => {
          const isClosest = closestSlug === branch.slug
          return (
            <article key={branch.slug} className={`bd-near-card ${isClosest ? 'is-closest' : ''}`}>
              <div className="bd-near-card-top">
                <h4>{branchCityName(branch)}</h4>
                {distanceKm != null ? (
                  <span className="bd-near-distance">
                    <Navigation size={12} aria-hidden="true" />
                    {isClosest ? `Closest · ~${distanceKm.toFixed(1)} km` : `~${distanceKm.toFixed(1)} km away`}
                  </span>
                ) : (
                  <span className="bd-near-distance">Open studio</span>
                )}
              </div>
              {branch.address ? <p className="bd-near-copy">{branch.address}</p> : null}
              <div className="bd-near-actions">
                <Link className="bd-btn bd-btn-primary" to={`/book?branch=${encodeURIComponent(branch.slug)}`}>
                  Book slot
                </Link>
                <Link className="bd-btn bd-btn-quiet" to={`/queue/${branch.slug}`}>
                  Live queue
                </Link>
                <Link className="bd-btn bd-btn-quiet" to={`/branches/${branch.slug}`}>
                  City guide
                </Link>
                {directions?.google ? (
                  <a className="bd-btn bd-btn-quiet" href={directions.google} target="_blank" rel="noopener noreferrer">
                    Google Maps
                  </a>
                ) : null}
                {phone?.href ? (
                  <a className="bd-btn bd-btn-quiet" href={phone.href}>
                    <Phone size={13} aria-hidden="true" />
                    Call
                  </a>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
