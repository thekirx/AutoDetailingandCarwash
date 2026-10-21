import { useEffect, useState } from 'react'
import { REFERRAL_DEFAULTS, normalizeReferralSettings } from './referral'

/**
 * Public referral settings (on/off, reward words, validity, which services count).
 * One fetch per page load, shared by the /refer page and the footer link.
 * Falls back to REFERRAL_DEFAULTS (enabled: false) when the API is unreachable.
 */
let cached = null
let inflight = null

function load() {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetch('/api/referral?view=settings')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((body) => {
        cached = normalizeReferralSettings(body?.settings || body)
        return cached
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useReferralSettings() {
  const [settings, setSettings] = useState(() => cached || normalizeReferralSettings(REFERRAL_DEFAULTS))
  const [loaded, setLoaded] = useState(Boolean(cached))
  useEffect(() => {
    let live = true
    load().then((next) => {
      if (!live) return
      setSettings(next)
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [])
  return { settings, loaded }
}
