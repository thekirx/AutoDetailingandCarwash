import { useEffect, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { fetchBranchWeather, resolveWeatherTarget } from '@/lib/branchWeather'
import { formatCustomerLocationLabel, formatDistanceKm } from '@/lib/customerLocation'

function branchShortName(name) {
  return String(name || '').replace(/^Hakum Auto Care\s*/i, '') || name || ''
}

/**
 * Live Open-Meteo reading. Prefers the customer's current location (`userCoords`)
 * over branch coordinates, displays concise location text, and opens the smart PH
 * location picker (type / GPS / smart pin) + nearest Hakum summary cleanly.
 */
export default function BranchWeather({
  userCoords = null,
  branch = null,
  nearestBranch = null,
  nearestDistanceKm = null,
  onLocate,
  onOpenPicker,
  locating = false,
  className = '',
}) {
  const [wx, setWx] = useState(null)
  const target = resolveWeatherTarget({ userCoords, branch })
  const { lat, lng, source } = target
  const locationText = source === 'user' ? formatCustomerLocationLabel(userCoords) || 'Your location' : ''

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

  const triggerAction = onOpenPicker || onLocate
  const nearestShort = nearestBranch ? branchShortName(nearestBranch.name) : ''

  return (
    <div className={`capp-weather ${className}`.trim()} aria-live="polite">
      <span className="capp-weather-now">
        <span className="capp-weather-temp">{wx.tempC}°</span>
        <span>{wx.label}</span>
        {source === 'user' ? (
          triggerAction ? (
            <button
              type="button"
              className="capp-weather-loc-btn is-located"
              onClick={triggerAction}
              disabled={locating}
              title={userCoords?.address || locationText}
            >
              <MapPin size={12} strokeWidth={2} aria-hidden />
              <span className="capp-weather-loc-text">{locationText}</span>
              <ChevronDown size={11} strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            <span className="capp-weather-tag" title={userCoords?.address || locationText}>
              <MapPin size={12} strokeWidth={2} aria-hidden />
              <span className="capp-weather-loc-text">{locationText}</span>
            </span>
          )
        ) : triggerAction ? (
          <button
            type="button"
            className="capp-weather-loc-btn"
            onClick={triggerAction}
            disabled={locating}
          >
            <MapPin size={12} strokeWidth={2} aria-hidden />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        ) : null}
      </span>
      {wx.line ? <span className="capp-weather-line">{wx.line}</span> : null}
      {source === 'user' && nearestShort ? (
        <span className="capp-weather-nearest">
          Nearest: {nearestShort}
          {nearestDistanceKm != null ? ` · ${formatDistanceKm(nearestDistanceKm)}` : ''}
        </span>
      ) : null}
    </div>
  )
}
