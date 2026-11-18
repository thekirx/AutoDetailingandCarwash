import { allowRoute, getOperationsNav, redirectForRole } from './permissions.js'
import { resolveOpsRouteKeyFromPath } from '../lib/opsNavigationRegistry.js'

const AUTH_LOOP_PATHS = new Set([
  '/operations/access-denied',
  '/operations/login',
  '/signin',
  '/signup',
  '/login',
  '/account/login',
])

/** Safe post-login redirect pathname (strips query) — never bounce back to access-denied / login loops. */
export function safeAuthReturnPath(pathname, { fallback = null } = {}) {
  if (!pathname || typeof pathname !== 'string') return fallback
  const path = pathname.split('?')[0].split('#')[0]
  if (!path.startsWith('/') || /^\/[/\\]/.test(path)) return fallback
  if (AUTH_LOOP_PATHS.has(path)) return fallback
  return path
}

/** Safe post-login redirect URL preserving query string (and optional Location object). */
export function safeAuthReturnUrl(from, { fallback = null } = {}) {
  if (!from) return fallback
  let raw = ''
  if (typeof from === 'string') {
    raw = from.trim()
  } else if (typeof from === 'object' && typeof from.pathname === 'string') {
    raw = `${from.pathname}${from.search || ''}${from.hash || ''}`.trim()
  }
  if (!raw || !raw.startsWith('/') || /^\/[/\\]/.test(raw)) return fallback
  const path = safeAuthReturnPath(raw)
  if (!path) return fallback
  return raw
}

/** Map ops pathname → allowRoute key (longest match wins via canonical registry). */
export function opsRouteKeyFromPath(pathname) {
  return resolveOpsRouteKeyFromPath(safeAuthReturnPath(pathname))
}

/**
 * Post-login destination: prefer deep-link (with query params) only when this role can open it.
 * Prevents login → forbidden page → access-denied flicker.
 */
function allowedRoleHome(profile) {
  const home = redirectForRole(profile?.role)
  const key = opsRouteKeyFromPath(home)
  if (!key || allowRoute(profile, key)) return home
  return getOperationsNav(profile)[0]?.to || home
}

export function resolvePostLoginPath(profile, fromTarget) {
  const home = allowedRoleHome(profile)
  const safe = safeAuthReturnUrl(fromTarget)
  if (!safe) return home
  const key = opsRouteKeyFromPath(safe)
  if (!key) return home
  if (allowRoute(profile, key)) return safe
  return home
}

/** Customer post-login destination: preserve /account/* (and /book, /queue) deep links with query params. */
export function resolveCustomerPostLoginPath(fromTarget, { fallback = '/account' } = {}) {
  const safe = safeAuthReturnUrl(fromTarget)
  if (!safe) return fallback
  const path = safe.split('?')[0].split('#')[0]
  if (path === '/account' || path.startsWith('/account/') || path === '/book' || path === '/queue') {
    return safe
  }
  return fallback
}
