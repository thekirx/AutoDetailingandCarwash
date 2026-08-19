import { useCallback, useEffect, useRef, useState } from 'react'

import { nearestBranchSlug } from './branchGeo'

/**
 * Nearest bookable branch to the visitor.
 *
 * Deliberately does NOT prompt on load. A geolocation dialog thrown at a
 * first-time visitor before they have read a word of the page is the kind of
 * thing people bounce on, so:
 *
 *   - permission already granted -> locate silently, no dialog
 *   - permission not yet asked   -> expose request(), let the UI offer it
 *   - permission denied          -> stay quiet, caller falls back
 *
 * The same permission-first pattern is used on the customer account page.
 */
export function useNearestBranch(branches) {
  const [slug, setSlug] = useState(null)
  const [canAsk, setCanAsk] = useState(false)
  const [locating, setLocating] = useState(false)
  const branchesRef = useRef(branches)

  useEffect(() => { branchesRef.current = branches }, [branches])

  const locate = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const nearest = nearestBranchSlug(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          branchesRef.current || [],
        )
        if (nearest) {
          setSlug(nearest.slug)
          setCanAsk(false)
        }
      },
      () => {
        /* Denied or timed out. Never retry — the caller's fallback is fine and
           a second dialog is worse than a slightly less relevant branch. */
        setLocating(false)
        setCanAsk(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  useEffect(() => {
    if (!branches?.length || !navigator.geolocation) return
    let cancelled = false

    if (!navigator.permissions?.query) {
      /* No Permissions API (older Safari). Offer the button rather than
         prompting unannounced. */
      setCanAsk(true)
      return
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled) return
        if (status.state === 'granted') locate()
        else if (status.state === 'prompt') setCanAsk(true)
      })
      .catch(() => { if (!cancelled) setCanAsk(true) })

    return () => { cancelled = true }
  }, [branches, locate])

  return { slug, canAsk, locating, request: locate }
}
