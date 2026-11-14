import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { fetchBranchWeather, resolveWeatherTarget } from '@/lib/branchWeather'

/**
 * Live Open-Meteo reading. Always prefers the customer's current location (`userCoords`)
 * over branch coordinates so weather reflects where the customer actually is.
 */
export default function BranchWeather({ userCoords = null, branch = null, onLocate, locating = false, className = '' }) {
  const [wx, setWx] = useState(null)
  const target = resolveWeatherTarget({ userCoords, branch })
  const { lat, lng, source } = target

  useEffect(() => {
    let cancelled = false
    fetchBranchWeather(lat, lng)
      .then((data) => {
        if (!cancelled) setWx(data)
      })
      .catch(() => {
        if (!cancelled) setWx(null)
      })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (!wx) return null

  return (
    <div className={`capp-weather ${className}`.trim()} aria-live="polite">
      <span className="capp-weather-now">
        <span className="capp-weather-temp">{wx.tempC}°</span>
        <span>{wx.label}</span>
        {source === 'user' ? (
          <span className="capp-weather-tag">
            <MapPin size={12} strokeWidth={2} aria-hidden />
            Your location
          </span>
        ) : onLocate ? (
          <button
            type="button"
            className="capp-weather-loc-btn"
            onClick={onLocate}
            disabled={locating}
          >
            <MapPin size={12} strokeWidth={2} aria-hidden />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        ) : null}
      </span>
      {wx.line ? <span className="capp-weather-line">{wx.line}</span> : null}
    </div>
  )
}
