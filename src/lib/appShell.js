import { isStandaloneDisplay } from './installApp.js'
import { OPS_LOGIN_ROLES } from '../auth/permissions.js'
import { resolvePostLoginPath } from '../auth/authRedirect.js'

/**
 * Prefer the app shell (customer / team sign-in) over the marketing landing
 * only inside the installed app (PWA standalone / fullscreen).
 * Phone and desktop browsers both land on the marketing site first; the
 * sign-in gate stays reachable at /app and via the site's sign-in links.
 */
export function prefersAppShell({ standalone = isStandaloneDisplay() } = {}) {
  return Boolean(standalone)
}

/** Where a signed-in user lands inside the app shell. */
export function resolveAppHome(profile) {
  if (!profile?.role) return null
  if (profile.role === 'customer') return '/account'
  if (OPS_LOGIN_ROLES.includes(profile.role)) return resolvePostLoginPath(profile, null)
  return null
}

export const APP_SHELL_PATH = '/app'
export const MARKETING_HOME_PATH = '/home'
