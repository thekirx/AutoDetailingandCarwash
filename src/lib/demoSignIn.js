import { QA_KEY_STORAGE, DEFAULT_QA_KEY, isDemoLoginEnabled, storedQaKey } from './demoLogin.js'

/**
 * One-click demo sign-in, client half. Posts an account id and the stored QA key
 * to /api/demo-login; the server signs in and returns only the session.
 */
async function post(body) {
  return fetch('/api/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function isTestOrVercelHost() {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.location?.hostname || (window.location?.href ? new URL(window.location.href).hostname : '')
    const host = String(raw || '').toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.vercel.app') ||
      Boolean(import.meta.env?.DEV)
    )
  } catch {
    return false
  }
}

export function isDemoLoginVisible() {
  if (typeof window === 'undefined') return isDemoLoginEnabled()
  if (isTestOrVercelHost()) {
    return true
  }
  // On custom/production domain (e.g. hakumautocare.com, www.hakumautocare.com):
  const key = storedQaKey()
  if (key === DEFAULT_QA_KEY) {
    try {
      globalThis.localStorage?.removeItem(QA_KEY_STORAGE)
    } catch {}
    return false
  }
  return Boolean(key)
}

export async function demoSignIn(accountId) {
  const res = await post({ id: accountId, key: storedQaKey() })
  const data = await res.json().catch(() => ({}))
  if (res.status === 404 && storedQaKey() !== DEFAULT_QA_KEY) globalThis.localStorage?.removeItem(QA_KEY_STORAGE)
  if (!res.ok) throw new Error(res.status === 404 ? 'Demo sign-in is locked on this device' : data.error || 'Demo sign-in failed')
  return data
}

// Shared so a second call (React StrictMode re-runs effects in dev) waits for the first key check.
let unlocking = Promise.resolve()

/** Stores `?qa=<key>` if the server accepts it, strips it from the address bar, and reports whether chips are on. */
export async function unlockDemoLoginFromUrl() {
  if (typeof window === 'undefined') return isDemoLoginEnabled()
  let url
  try {
    url = new URL(window.location.href)
  } catch {
    return isDemoLoginVisible()
  }
  const key = url.searchParams.get('qa')
  if (key) {
    url.searchParams.delete('qa')
    if (window.history?.replaceState) {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    unlocking = post({ key, check: true })
      .then((res) => {
        if (res?.ok) {
          try {
            localStorage.setItem(QA_KEY_STORAGE, key)
          } catch {}
        }
      })
      .catch(() => {})
    await unlocking
  } else if (isTestOrVercelHost()) {
    if (!storedQaKey() && DEFAULT_QA_KEY) {
      try {
        localStorage.setItem(QA_KEY_STORAGE, DEFAULT_QA_KEY)
      } catch {
        /* ignore storage access errors */
      }
    }
  } else {
    // On the main domain, ensure default demo key is stripped
    if (storedQaKey() === DEFAULT_QA_KEY) {
      try {
        localStorage.removeItem(QA_KEY_STORAGE)
      } catch {
        /* ignore storage access errors */
      }
    }
  }
  return isDemoLoginVisible()
}
