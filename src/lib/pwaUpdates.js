/* global __APP_BUILD_VERSION__ */

export const UPDATE_POLL_INTERVAL_MS = 4 * 60 * 1000
export const RELOAD_GUARD_KEY = 'hakum-sw-reloaded-version'

export function currentAppVersion() {
  return typeof __APP_BUILD_VERSION__ !== 'undefined' ? String(__APP_BUILD_VERSION__) : 'dev'
}

/**
 * Ask Chromium/Android/Safari to keep SW caches, localStorage session tokens,
 * and offline data durable under device storage pressure.
 */
export async function ensurePersistentStorage(nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (!nav?.storage?.persist) return false
    const already = typeof nav.storage.persisted === 'function' ? await nav.storage.persisted() : false
    if (already) return true
    return Boolean(await nav.storage.persist())
  } catch {
    return false
  }
}

/** Detect active editing or checkout screens so auto-refresh never interrupts unsaved input. */
export function isUserBusyEditing(doc = typeof document !== 'undefined' ? document : null, loc = typeof window !== 'undefined' ? window.location : null) {
  if (!doc) return false
  const active = doc.activeElement
  if (active) {
    const tag = String(active.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable) {
      return true
    }
  }
  if (doc.querySelector('[role="dialog"][data-state="open"], dialog[open]')) {
    return true
  }
  const pathname = String(loc?.pathname || '')
  if (/^\/operations\/(pos|forms|planning|content)/.test(pathname) || pathname === '/book') {
    return Boolean(doc.querySelector('form input:not([type="hidden"]), form textarea'))
  }
  return false
}

export function shouldAutoReloadForUpdate({ busyEditing = false, dismissed = false, hasReloadedSameVersion = false } = {}) {
  return !busyEditing && !dismissed && !hasReloadedSameVersion
}

export async function detectVersionDrift(fetchImpl = typeof fetch === 'function' ? fetch : null, localVersion = currentAppVersion()) {
  if (!fetchImpl || !localVersion || localVersion === 'dev') {
    return { stale: false, latest: localVersion }
  }
  try {
    const res = await fetchImpl(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return { stale: false, latest: localVersion }
    const data = await res.json().catch(() => null)
    const latest = data?.version ? String(data.version) : ''
    if (!latest || latest === localVersion) return { stale: false, latest: localVersion }
    return { stale: true, latest }
  } catch {
    return { stale: false, latest: localVersion }
  }
}

export function markVersionReloaded(version, storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!storage || !version) return
  try {
    storage.setItem(RELOAD_GUARD_KEY, String(version))
  } catch {
    /* private browsing */
  }
}

export function wasVersionAlreadyReloaded(version, storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!storage || !version) return false
  try {
    return storage.getItem(RELOAD_GUARD_KEY) === String(version)
  } catch {
    return false
  }
}

/** Sync unread notification count onto Android / Windows / iOS Home Screen app icon. */
export async function syncAppBadge(count, nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (!nav) return
    const n = Number(count) || 0
    if (n > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(n)
    } else if (n <= 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge()
    }
  } catch {
    /* unsupported on current browser */
  }
}
