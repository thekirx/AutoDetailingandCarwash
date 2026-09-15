/**
 * Resolve inbox / push deep links for React Router.
 * Absolute same-origin URLs → path+search+hash. Bare "/" → fallback (customer home).
 * External origins are rejected so Link never escapes the app shell.
 */
export function notificationHref(url, fallback = '/account') {
  const fb = String(fallback || '/account').trim() || '/account'
  const raw = String(url || '').trim()
  if (!raw || raw === '/') return fb

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      if (origin && u.origin === origin) {
        const path = `${u.pathname}${u.search}${u.hash}` || '/'
        return path === '/' ? fb : path
      }
    } catch {
      /* ignore */
    }
    return fb
  }

  if (raw.startsWith('/')) return raw
  return fb
}
