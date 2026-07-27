/** Safe post-login redirect — never bounce back to access-denied / login loops. */
export function safeAuthReturnPath(pathname, { fallback = null } = {}) {
  if (!pathname || typeof pathname !== 'string') return fallback
  const path = pathname.split('?')[0]
  if (!path.startsWith('/')) return fallback
  if (path === '/operations/access-denied') return fallback
  if (path === '/operations/login' || path === '/signin' || path === '/signup') return fallback
  if (path === '/login' || path === '/account/login') return fallback
  return path
}
