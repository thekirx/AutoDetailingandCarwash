import { useState } from 'react'
import { Link } from 'react-router-dom'
import { needsCookieConsentPrompt, writeCookieConsent } from '@/lib/cookieConsent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return needsCookieConsentPrompt()
  })

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
            Optional cookies help us understand how the site is used. See our{' '}
            <Link to="/privacy">Privacy Policy</Link> for details.
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
