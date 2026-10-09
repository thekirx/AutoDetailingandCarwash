import { useCallback, useSyncExternalStore } from 'react'

/**
 * The customer app's own appearance, separate from the site-wide next-themes
 * class. Dark is the website's palette (navy, the default since 2026-10-09);
 * light is the warm paper ground. Stored per device, nothing is sent anywhere.
 */
export const CUSTOMER_APP_THEME_KEY = 'hakum-app-theme'
const EVENT = 'hakum-app-theme'

export function readCustomerAppTheme() {
  try {
    return window.localStorage.getItem(CUSTOMER_APP_THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function writeCustomerAppTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  try {
    window.localStorage.setItem(CUSTOMER_APP_THEME_KEY, next)
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  window.dispatchEvent(new Event(EVENT))
  return next
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useCustomerAppTheme() {
  const theme = useSyncExternalStore(subscribe, readCustomerAppTheme, () => 'dark')
  const setTheme = useCallback((next) => writeCustomerAppTheme(next), [])
  return [theme, setTheme]
}
