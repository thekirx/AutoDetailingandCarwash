import { isStandaloneDisplay, isIosDevice, isAndroidDevice } from './installApp.js'
import { OPS_LOGIN_ROLES, redirectForRole } from '../auth/permissions.js'

/**
 * Prefer native-app shell (sign-in / account) over marketing landing.
 * - Installed PWA / standalone / fullscreen
 * - Phone-sized touch browsers (mobile web that should feel like the app)
 * Desktop browser keeps the marketing site.
 */
export function prefersAppShell({
  standalone = isStandaloneDisplay(),
  mobileUa = isIosDevice() || isAndroidDevice(),
  narrow = typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 900px)').matches
    : false,
  touch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints > 0 : false,
} = {}) {
  if (standalone) return true
  // Mobile browser: phone UA or narrow+touch viewport
  if (mobileUa) return true
  if (narrow && touch) return true
  return false
}

/** Where a signed-in user lands inside the app shell. */
export function resolveAppHome(profile) {
  if (!profile?.role) return null
  if (profile.role === 'customer') return '/account'
  if (OPS_LOGIN_ROLES.includes(profile.role)) return redirectForRole(profile.role)
  return null
}

export const APP_SHELL_PATH = '/app'
export const MARKETING_HOME_PATH = '/home'
