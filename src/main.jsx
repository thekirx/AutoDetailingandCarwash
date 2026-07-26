import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import CookieConsent from '@/components/CookieConsent'
import { Toaster } from '@/components/ui/sonner'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="hakum-theme" disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <CookieConsent />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
