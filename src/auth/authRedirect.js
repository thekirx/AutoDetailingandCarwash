import { allowRoute, getOperationsNav, redirectForRole } from './permissions.js'

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
  if (path.startsWith('/operations/employees')) return 'employees'
  if (path.startsWith('/operations/branches')) return 'branches'
  if (path.startsWith('/operations/cars')) return 'cars'
  if (path.startsWith('/operations/vehicle-transfer')) return 'vehicle-transfer'
  if (path.startsWith('/operations/audit')) return 'audit'
  if (path.startsWith('/operations/data-center')) return 'data-center'
  if (path.startsWith('/operations/system')) return 'system'
  if (path.startsWith('/operations/inquiries')) return 'inquiries'
  if (path.startsWith('/operations/crew')) return 'crew'
  if (path.startsWith('/operations/kpi')) return 'kpi'
  if (path.startsWith('/operations/my-tasks')) return 'my-tasks'
  if (path.startsWith('/operations/my-advances')) return 'my-advances'
  if (path.startsWith('/operations/payslips')) return 'payslips'
  if (path.startsWith('/operations/approvals')) return 'approvals'
  if (path.startsWith('/operations/monthly-payroll')) return 'monthly-payroll'
  if (path.startsWith('/operations/pos')) return 'pos'
  if (path.startsWith('/operations/merch-shop')) return 'merch-shop'
  if (path.startsWith('/operations/inventory')) return 'inventory'
  if (path.startsWith('/operations/finance')) return 'finance'
  if (path.startsWith('/operations/crm')) return 'crm'
  if (path.startsWith('/operations/bookings')) return 'bookings'
  if (path.startsWith('/operations/planning')) return 'planning'
  if (path.startsWith('/operations/forms')) return 'planning'
  if (path.startsWith('/operations/settings')) return 'settings'
  if (path.startsWith('/operations/reports')) return 'reports'
  if (path.startsWith('/operations/memberships')) return 'memberships'
  if (path.startsWith('/operations/vouchers')) return 'vouchers'
  if (path.startsWith('/operations/rewards')) return 'rewards'
  if (path.startsWith('/operations/reviews')) return 'reviews'
  if (path.startsWith('/operations/content')) return 'content'
  if (path.startsWith('/operations/notifications')) return 'notifications'
  if (path.startsWith('/operations/broadcast')) return 'notifications'
  if (path.startsWith('/operations/history')) return 'history'
  if (path.startsWith('/operations/attendance')) return 'attendance'
  if (path.startsWith('/operations/services')) return 'inventory'
  if (path.startsWith('/operations/products')) return 'inventory'
  return null
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
