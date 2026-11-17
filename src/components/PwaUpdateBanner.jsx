import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import {
  UPDATE_POLL_INTERVAL_MS,
  currentAppVersion,
  detectVersionDrift,
  ensurePersistentStorage,
  isUserBusyEditing,
  markVersionReloaded,
  shouldAutoReloadForUpdate,
  wasVersionAlreadyReloaded,
} from '@/lib/pwaUpdates'
import '@/styles/pwaUpdate.css'

const AUTO_REFRESH_SECONDS = 8

export default function PwaUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(() =>
    typeof window !== 'undefined' ? Boolean(window.__hakumNeedRefresh) : false,
  )
  const [latestVersion, setLatestVersion] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [pausedByEdit, setPausedByEdit] = useState(false)
  const applyingRef = useRef(false)

  const applyRefresh = useCallback(() => {
    if (applyingRef.current) return
    applyingRef.current = true
    if (latestVersion) markVersionReloaded(latestVersion)
    if (typeof window !== 'undefined') {
      if (typeof window.__hakumUpdateSW === 'function') {
        try {
          void window.__hakumUpdateSW(true)
        } catch {
          /* fallback below */
        }
      } else if (window.__hakumSwRegistration?.waiting) {
        try {
          window.__hakumSwRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
        } catch {
          /* ignore */
        }
      }
      // Guarantee hard reload on browsers/iOS Home Screen PWAs where controllerchange does not fire promptly
      window.setTimeout(() => {
        window.location.reload()
      }, 350)
    }
  }, [latestVersion])

  const checkForUpdates = useCallback(async () => {
    try {
      const reg = typeof window !== 'undefined' ? window.__hakumSwRegistration : null
      if (reg?.update) await reg.update()
      if (reg?.waiting) {
        setUpdateReady(true)
        setDismissed(false)
      }
    } catch {
      /* offline */
    }
    const localVer = currentAppVersion()
    const drift = await detectVersionDrift(fetch, localVer)
    if (drift.stale && !wasVersionAlreadyReloaded(drift.latest)) {
      setLatestVersion(drift.latest)
      setUpdateReady(true)
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    void ensurePersistentStorage()
    void checkForUpdates()

    const onSwUpdate = () => {
      setUpdateReady(true)
      setDismissed(false)
    }

    const onControllerChange = () => {
      if (applyingRef.current) {
        window.location.reload()
      }
    }

    const onVisibleOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    }
    const onOnline = () => void checkForUpdates()

    window.addEventListener('hakum:sw-update', onSwUpdate)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    }
    document.addEventListener('visibilitychange', onVisibleOrFocus)
    window.addEventListener('focus', onVisibleOrFocus)
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => void checkForUpdates(), UPDATE_POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('hakum:sw-update', onSwUpdate)
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
      document.removeEventListener('visibilitychange', onVisibleOrFocus)
      window.removeEventListener('focus', onVisibleOrFocus)
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [checkForUpdates])

  // Smart safe auto-refresh: counts down only when idle & not filling a form/POS checkout
  useEffect(() => {
    if (!updateReady || dismissed) {
      setCountdown(null)
      return undefined
    }
    const busy = isUserBusyEditing()
    setPausedByEdit(busy)
    if (
      !shouldAutoReloadForUpdate({
        busyEditing: busy,
        dismissed,
        hasReloadedSameVersion: latestVersion ? wasVersionAlreadyReloaded(latestVersion) : false,
      })
    ) {
      return undefined
    }

    setCountdown(AUTO_REFRESH_SECONDS)
    const interval = window.setInterval(() => {
      if (isUserBusyEditing()) {
        setPausedByEdit(true)
        setCountdown(null)
        window.clearInterval(interval)
        return
      }
      setCountdown((prev) => {
        if (prev == null) return null
        if (prev <= 1) {
          window.clearInterval(interval)
          applyRefresh()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [updateReady, dismissed, latestVersion, applyRefresh])

  if (!updateReady || dismissed) return null

  return (
    <aside className="hakum-update-banner" role="status" aria-live="polite" aria-label="Application update available">
      <div className="hakum-update-copy">
        <p className="hakum-update-title">
          <RefreshCw size={15} aria-hidden="true" />
          New Hakum update available
        </p>
        <p className="hakum-update-desc">
          {pausedByEdit
            ? 'Tap Refresh when you finish editing to load the newest release.'
            : countdown != null
              ? `Refreshing automatically in ${countdown}s for the latest features and fixes.`
              : 'Tap Refresh now to load the latest version cleanly.'}
        </p>
      </div>
      <div className="hakum-update-actions">
        <button type="button" className="hakum-update-btn is-primary" onClick={applyRefresh}>
          <RefreshCw size={14} aria-hidden="true" />
          Refresh now
        </button>
        <button
          type="button"
          className="hakum-update-btn is-ghost"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update reminder for now"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
