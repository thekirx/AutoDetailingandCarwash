import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import Papa from 'papaparse'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import CookieConsent from '@/components/CookieConsent'
import { Toaster } from '@/components/ui/sonner'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import './styles-customer-app.css'
import './styles/bredesign.css'

registerSW({ immediate: true })

// Service worker notificationclick → SPA deep link when WindowClient.navigate is unavailable
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const url = event.data?.type === 'HAKUM_NAV' ? event.data.url : null
    if (!url || typeof window === 'undefined') return
    try {
      const next = new URL(url, window.location.origin)
      if (next.origin !== window.location.origin) return
      const path = `${next.pathname}${next.search}${next.hash}` || '/'
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` === path) return
      window.location.assign(path)
    } catch {
      /* ignore malformed */
    }
  })
}

// papaparse is used by finance CSV exports; expose it as a global for the pure helper.
if (typeof window !== 'undefined' && !window.Papa) window.Papa = Papa

// After a deploy, a stale tab/SW can request deleted hashed chunks. Reload once so the new index wins.
const PRELOAD_RELOAD_KEY = 'hakum-preload-reload'
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY) === '1') return
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1')
  } catch {
    window.location.reload()
    return
  }
  window.location.reload()
})
window.setTimeout(() => {
  try {
    sessionStorage.removeItem(PRELOAD_RELOAD_KEY)
  } catch {
    /* private mode */
  }
}, 8000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="hakum-theme" disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
          <CookieConsent />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
