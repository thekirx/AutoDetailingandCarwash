import { useCallback, useEffect, useMemo, useState } from 'react'
import { filterOperationalBranches } from './inventoryBranchStock.js'
import { nearestBranchSlug } from './branchGeo.js'
import {
  formatCustomerLocationLabel,
  loadCustomerBranch,
  loadCustomerPin,
  resolveCustomerBranchChoice,
  saveCustomerBranch,
  saveCustomerPin,
} from './customerLocation.js'
import { readBrowserLocation, reverseGeocodePhDetails } from './phPlaces.js'

const SYNC_EVENT = 'hakum-customer-branch-sync'

function notifySync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
  }
}

/**
 * Shared customer branch + geolocation hook.
 * Keeps manual branch selection, nearest-branch auto-location, human-readable PH location text,
 * and current-location weather coordinates synchronized across Home, Queue, Book, and Points Shop.
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
  // ONLY if the user has not manually pinned/searched a specific PH place.
  useEffect(() => {
    let cancelled = false
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined
    const initial = loadCustomerPin()
    if (initial?.source === 'manual') return undefined
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return null
        return readBrowserLocation()
      })
      .then(async (coords) => {
        if (cancelled || !coords) return
        const existing = loadCustomerPin()
        if (existing?.source === 'manual') return
        let label = existing?.label || ''
        let address = existing?.address || ''
        const moved =
          !existing ||
          Math.abs(existing.lat - coords.lat) > 0.004 ||
          Math.abs(existing.lng - coords.lng) > 0.004 ||
          !label
        if (moved) {
          const details = await reverseGeocodePhDetails(coords.lat, coords.lng).catch(() => null)
          if (cancelled) return
          if (details) {
            label = details.shortLabel
            address = details.fullAddress
          }
        }
        const saved = saveCustomerPin({ ...coords, label, address, source: 'gps' })
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
      const saved = saveCustomerPin({ ...nextPin, source: nextPin?.source || 'manual' })
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
        const initialSaved = saveCustomerPin({ ...coords, source: 'gps' })
        if (!initialSaved) throw new Error('Unable to save your location.')
        setPinState(initialSaved)
        let nearest = null
        if (autoSelectNearest && branches.length) {
          nearest = nearestBranchSlug(initialSaved, branches)
          if (nearest?.slug) {
            saveCustomerBranch(nearest.slug)
            setSavedSlug(nearest.slug)
          }
        }
        notifySync()

        // Enrich readable Philippines place text smoothly after coordinates lock
        const details = await reverseGeocodePhDetails(coords.lat, coords.lng).catch(() => null)
        let finalPin = initialSaved
        if (details?.shortLabel) {
          finalPin = saveCustomerPin({
            ...coords,
            label: details.shortLabel,
            address: details.fullAddress,
            source: 'gps',
          }) || initialSaved
          setPinState(finalPin)
          notifySync()
        }
        return { pin: finalPin, nearest }
      } catch (err) {
        const msg = err?.message || 'Location is off. Search or drop a pin in the Philippines instead.'
        setLocationError(msg)
        throw err
      } finally {
        setLocating(false)
      }
    },
    [branches],
  )

  const locationLabel = useMemo(() => formatCustomerLocationLabel(pin), [pin])
  const nearestBranch = useMemo(
    () => branches.find((b) => b.slug === resolved.nearestSlug) || null,
    [branches, resolved.nearestSlug],
  )

  return {
    branches,
    selectedBranch: resolved.slug,
    branchSource: resolved.source,
    nearestSlug: resolved.nearestSlug,
    nearestBranch,
    nearestDistanceKm: resolved.nearestDistanceKm,
    pin,
    locationLabel,
    locating,
    locationError,
    selectBranch,
    updatePin,
    locateNearest,
  }
}
