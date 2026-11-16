import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, Loader2, MapPin, Navigation, Phone } from 'lucide-react'
import { branchCityName } from '@/lib/branches'
import { QUICK_CITY_ORIGINS, rankOpenBranchesForOrigin } from '@/lib/localBranchPages'
import { readBrowserLocation } from '@/lib/phPlaces'
import '@/styles/seoLocal.css'

/**
 * Interactive "nearest car wash / auto detailing studio near me" locator for
 * Cavite (Bacoor, Imus, Dasmariñas) and Batangas motorists.
 */
export default function NearestBranchFinder({ branches = [], defaultCity = '', headingLevel = 'h2' }) {
  const [selectedCity, setSelectedCity] = useState(defaultCity)
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsLabel, setGpsLabel] = useState('')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')

  const activePreset = useMemo(
    () => QUICK_CITY_ORIGINS.find((c) => c.id === selectedCity) || null,
    [selectedCity],
  )

  const originCoords = useMemo(
    () => gpsCoords || (activePreset ? { lat: activePreset.lat, lng: activePreset.lng } : null),
    [gpsCoords, activePreset],
  )
  const ranked = useMemo(() => rankOpenBranchesForOrigin(originCoords, branches), [originCoords, branches])
  const Heading = headingLevel

  async function handleUseGps() {
    setLocating(true)
    setGeoError('')
    try {
      const coords = await readBrowserLocation()
      setGpsCoords(coords)
      setSelectedCity('')
      setGpsLabel('Your current location')
    } catch (err) {
      setGeoError(err?.message || 'Location permission declined — choose your city below instead.')
    } finally {
      setLocating(false)
    }
  }

  function pickCity(cityId) {
    setGpsCoords(null)
    setGpsLabel('')
    setGeoError('')
    setSelectedCity((prev) => (prev === cityId ? '' : cityId))
  }

  const closestSlug = originCoords && ranked[0]?.distanceKm != null ? ranked[0].branch.slug : null

  return (
    <section className="bd-near-finder bd-reveal" aria-labelledby="near-finder-heading">
      <div className="bd-near-head">
        <div>
          <p className="bd-eyebrow">Nearest studio near me</p>
          <Heading id="near-finder-heading">Find your closest Hakum branch</Heading>
          <p className="bd-near-copy">
            Use your GPS location or tap your city in Bacoor, Imus, Cavite, or Batangas to see the nearest open detailing
            and car wash bay with live directions.
          </p>
        </div>
        <button type="button" className="bd-btn bd-btn-primary" onClick={handleUseGps} disabled={locating}>
          {locating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Crosshair size={15} aria-hidden="true" />}
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      <div className="bd-near-controls" role="group" aria-label="Quick city selector">
        {QUICK_CITY_ORIGINS.map((city) => (
          <button
            key={city.id}
            type="button"
            className={`bd-city-chip ${selectedCity === city.id ? 'is-active' : ''}`}
            onClick={() => pickCity(city.id)}
          >
            <MapPin size={13} aria-hidden="true" />
            {city.label}
          </button>
        ))}
      </div>

      {geoError ? (
        <p className="bd-near-copy" role="status">
          {geoError}
        </p>
      ) : null}

      {gpsLabel || activePreset ? (
        <p className="bd-near-copy" role="status">
          Showing straight-line distances from <strong>{gpsLabel || activePreset.label}</strong>:
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
