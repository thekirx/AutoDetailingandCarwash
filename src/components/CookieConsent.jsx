import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  COOKIE_CONSENT_OPEN_EVENT,
  needsCookieConsentPrompt,
  openCookieConsentPrompt,
  writeCookieConsent,
} from '@/lib/cookieConsent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return needsCookieConsentPrompt()
  })

  useEffect(() => {
    const reopen = () => setVisible(true)
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, reopen)
  }, [])

  if (!visible) return null

  const choose = (choice) => {
    writeCookieConsent(choice)
    setVisible(false)
  }

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-copy">
      <div className="cookie-consent-inner">
        <div className="cookie-consent-copy">
          <p id="cookie-consent-title" className="cookie-consent-title">We use cookies</p>
          <p id="cookie-consent-copy">
            Hakum uses essential cookies to keep you signed in and remember site preferences.
            Optional cookies are reserved for future analytics — none are loaded until we enable them.
            See our{' '}
            <Link to="/cookies">Cookie Policy</Link>
            {' '}and{' '}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
        <div className="cookie-consent-actions">
          <button type="button" className="cookie-consent-secondary" onClick={() => choose('necessary')}>
            Necessary only
          </button>
          <button type="button" className="cookie-consent-primary" onClick={() => choose('accepted')}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}

export function CookiePreferencesButton({ className = 'cookie-prefs-btn' }) {
  return (
    <button type="button" className={className} onClick={() => openCookieConsentPrompt()}>
      Cookie preferences
    </button>
  )
}
