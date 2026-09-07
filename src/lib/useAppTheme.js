import { useCallback, useEffect, useState } from 'react'

const KEY = 'capp-theme'
const listeners = new Set()
let current = read()

function read() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * Customer app light/dark preference.
 *
 * Presentation only: the choice lives in this browser and never leaves it, so
 * nothing here touches the account, the profile, or any stored data. Shared
 * through a module-level store so the app frame and the header toggle stay in
 * step without threading props through every screen.
 */
export function useAppTheme() {
  const [theme, setThemeState] = useState(current)

  useEffect(() => {
    listeners.add(setThemeState)
    return () => listeners.delete(setThemeState)
  }, [])

  const setTheme = useCallback((next) => {
    current = next === 'dark' ? 'dark' : 'light'
    try {
      localStorage.setItem(KEY, current)
    } catch {
      /* private mode — the toggle still works for this session */
    }
    for (const listener of listeners) listener(current)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
