/** Cookie preference storage — localStorage only (no third-party trackers wired yet). */
export const COOKIE_CONSENT_KEY = 'hakum_cookie_consent'
export const COOKIE_CONSENT_VERSION = 1

export function readCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION) return null
    if (parsed.choice !== 'accepted' && parsed.choice !== 'necessary') return null
    return parsed
  } catch {
    return null
  }
}

export function writeCookieConsent(choice) {
  if (choice !== 'accepted' && choice !== 'necessary') {
    throw new Error('Invalid cookie consent choice.')
  }
  const payload = { version: COOKIE_CONSENT_VERSION, choice, at: new Date().toISOString() }
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload))
  return payload
}

export function needsCookieConsentPrompt() {
  return readCookieConsent() == null
}
