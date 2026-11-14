import { useCallback, useEffect, useMemo, useState } from 'react'
import { filterOperationalBranches } from './inventoryBranchStock.js'
import { nearestBranchSlug } from './branchGeo.js'
import {
  loadCustomerBranch,
  loadCustomerPin,
  resolveCustomerBranchChoice,
  saveCustomerBranch,
  saveCustomerPin,
} from './customerLocation.js'
import { readBrowserLocation } from './phPlaces.js'

const SYNC_EVENT = 'hakum-customer-branch-sync'

function notifySync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
  }
}

/**
 * Shared customer branch + geolocation hook.
 * Keeps manual branch selection, nearest-branch auto-location, and current-location
 * weather coordinates synchronized across Home, Queue, Book, and Points Shop.
 */
export function useCustomerBranch(rawBranches = [], { wanted = '' } = {}) {
  const [pin, setPinState] = useState(() => loadCustomerPin())
  const [savedSlug, setSavedSlug] = useState(() => loadCustomerBranch())
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  const branches = useMemo(() => filterOperationalBranches(rawBranches), [rawBranches])

  useEffect(() => {
    const onSync = () => {
      setPinState(loadCustomerPin())
      setSavedSlug(loadCustomerBranch())
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [])

  // Silently refresh coordinates when browser geolocation is already granted
  // so local weather always reflects the user's current location without prompting.
  useEffect(() => {
    let cancelled = false
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return null
        return readBrowserLocation()
      })
      .then((coords) => {
        if (cancelled || !coords) return
        const saved = saveCustomerPin(coords)
        if (saved) {
          setPinState(saved)
          notifySync()
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const resolved = useMemo(
    () => resolveCustomerBranchChoice({ wanted, savedSlug, pin, branches }),
    [wanted, savedSlug, pin, branches],
  )

  const selectBranch = useCallback((slug) => {
    const next = saveCustomerBranch(slug)
    setSavedSlug(next)
    setLocationError('')
    notifySync()
    return next
  }, [])

  const updatePin = useCallback(
    (nextPin, { autoSelectNearest = true } = {}) => {
      const saved = saveCustomerPin(nextPin)
      if (!saved) {
        setLocationError('That pin is not a valid location.')
        return null
      }
      setLocationError('')
      setPinState(saved)
      let nearest = null
      if (autoSelectNearest && branches.length) {
        nearest = nearestBranchSlug(saved, branches)
        if (nearest?.slug) {
          saveCustomerBranch(nearest.slug)
          setSavedSlug(nearest.slug)
        }
      }
      notifySync()
      return { pin: saved, nearest }
    },
    [branches],
  )

  const locateNearest = useCallback(
    async ({ autoSelectNearest = true } = {}) => {
      setLocating(true)
      setLocationError('')
      try {
        const coords = await readBrowserLocation()
        const saved = saveCustomerPin(coords)
        if (!saved) throw new Error('Unable to save your location.')
        setPinState(saved)
        let nearest = null
        if (autoSelectNearest && branches.length) {
          nearest = nearestBranchSlug(saved, branches)
          if (nearest?.slug) {
            saveCustomerBranch(nearest.slug)
            setSavedSlug(nearest.slug)
          }
        }
        notifySync()
        return { pin: saved, nearest }
      } catch (err) {
        const msg = err?.message || 'Location is off. Drop a pin on the map instead.'
        setLocationError(msg)
        throw err
      } finally {
        setLocating(false)
      }
    },
    [branches],
  )

  return {
    branches,
    selectedBranch: resolved.slug,
    branchSource: resolved.source,
    nearestSlug: resolved.nearestSlug,
    nearestDistanceKm: resolved.nearestDistanceKm,
    pin,
    locating,
    locationError,
    selectBranch,
    updatePin,
    locateNearest,
  }
}
