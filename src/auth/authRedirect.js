import { allowRoute, redirectForRole } from './permissions.js'

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

/** Map ops pathname → allowRoute key (longest match wins). */
export function opsRouteKeyFromPath(pathname) {
  const path = safeAuthReturnPath(pathname)
  if (!path || !path.startsWith('/operations')) return null
  if (path === '/operations' || path === '/operations/') return null
  if (path.startsWith('/operations/queue/new')) return 'queue-new'
  if (path.startsWith('/operations/queue/')) return 'queue'
  if (path.startsWith('/operations/queue')) return 'queue'
  if (path.startsWith('/operations/dashboard')) return 'dashboard'
  if (path.startsWith('/operations/console')) return 'console'
  if (path.startsWith('/operations/people')) return 'people'
  if (path.startsWith('/operations/branches')) return 'branches'
  if (path.startsWith('/operations/cars')) return 'cars'
  if (path.startsWith('/operations/audit')) return 'audit'
  if (path.startsWith('/operations/data-center')) return 'data-center'
  if (path.startsWith('/operations/inquiries')) return 'inquiries'
  if (path.startsWith('/operations/crew')) return 'crew'
  if (path.startsWith('/operations/kpi')) return 'kpi'
  if (path.startsWith('/operations/my-tasks')) return 'my-tasks'
  if (path.startsWith('/operations/pos')) return 'pos'
  if (path.startsWith('/operations/inventory')) return 'inventory'
  if (path.startsWith('/operations/finance')) return 'finance'
  if (path.startsWith('/operations/payroll')) return 'payroll'
  if (path.startsWith('/operations/my-pay')) return 'my-pay'
  if (path.startsWith('/operations/crm')) return 'crm'
  if (path.startsWith('/operations/bookings')) return 'bookings'
  if (path.startsWith('/operations/planning')) return 'planning'
  if (path.startsWith('/operations/settings')) return 'settings'
  if (path.startsWith('/operations/reports')) return 'reports'
  if (path.startsWith('/operations/memberships')) return 'memberships'
  if (path.startsWith('/operations/services')) return 'inventory'
  if (path.startsWith('/operations/products')) return 'inventory'
  return null
}

/**
 * Post-login destination: prefer deep-link only when this role can open it.
 * Prevents login → forbidden page → access-denied flicker.
 */
export function resolvePostLoginPath(profile, fromPath) {
  const home = redirectForRole(profile?.role)
  const safe = safeAuthReturnPath(fromPath)
  if (!safe) return home
  const key = opsRouteKeyFromPath(safe)
  if (!key) return home
  if (allowRoute(profile, key)) return safe
  return home
}
