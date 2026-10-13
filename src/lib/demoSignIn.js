import { QA_KEY_STORAGE, isDemoLoginEnabled, storedQaKey } from './demoLogin'

/**
 * One-click demo sign-in, client half. Posts an account id and the stored QA key
 * to /api/demo-login; the server signs in and returns only the session. No
 * password exists on this side.
 */
async function post(body) {
  return fetch('/api/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function demoSignIn(accountId) {
  const res = await post({ id: accountId, key: storedQaKey() })
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) globalThis.localStorage?.removeItem(QA_KEY_STORAGE)
  if (!res.ok) throw new Error(res.status === 404 ? 'Demo sign-in is locked on this device' : data.error || 'Demo sign-in failed')
  return data
}

/** Stores `?qa=<key>` if the server accepts it, strips it from the address bar, and reports whether chips are on. */
export async function unlockDemoLoginFromUrl() {
  const url = new URL(window.location.href)
  const key = url.searchParams.get('qa')
  if (key) {
    url.searchParams.delete('qa')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    const res = await post({ key, check: true }).catch(() => null)
    if (res?.ok) localStorage.setItem(QA_KEY_STORAGE, key)
  }
  return isDemoLoginEnabled()
}
