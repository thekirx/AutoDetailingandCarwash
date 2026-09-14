import { useEffect, useState } from 'react'
import { coordsForWeather, fetchBranchWeather } from '@/lib/branchWeather'

/** Live Open-Meteo reading for a branch pin. Hidden until a temperature arrives. */
export default function BranchWeather({ branch, className = '' }) {
  const [wx, setWx] = useState(null)
  const { lat, lng } = coordsForWeather(branch)

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
    <p className={`capp-weather ${className}`.trim()} aria-live="polite">
      <span className="capp-weather-temp">{wx.tempC}°</span>
      <span>{wx.label}</span>
    </p>
  )
}
