import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, beforeEach } from 'node:test'
import {
  COOKIE_CONSENT_KEY,
  clearCookieConsent,
  needsCookieConsentPrompt,
  openCookieConsentPrompt,
  readCookieConsent,
  writeCookieConsent,
} from '../src/lib/cookieConsent.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('cookie consent storage', () => {
  beforeEach(() => {
    globalThis.localStorage = (() => {
      const store = new Map()
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      }
    })()
    globalThis.window = {
      dispatchEvent: () => true,
    }
  })

  it('prompts when no choice is stored', () => {
    assert.equal(needsCookieConsentPrompt(), true)
    assert.equal(readCookieConsent(), null)
  })

  it('persists accepted and necessary choices', () => {
    writeCookieConsent('accepted')
    assert.equal(needsCookieConsentPrompt(), false)
    assert.equal(readCookieConsent().choice, 'accepted')
    assert.ok(localStorage.getItem(COOKIE_CONSENT_KEY))

    writeCookieConsent('necessary')
    assert.equal(readCookieConsent().choice, 'necessary')
  })

  it('rejects invalid choices', () => {
    assert.throws(() => writeCookieConsent('maybe'), /Invalid cookie consent/)
  })

  it('clears and reopens prompt', () => {
    writeCookieConsent('accepted')
    clearCookieConsent()
    assert.equal(needsCookieConsentPrompt(), true)
    openCookieConsentPrompt()
    assert.equal(needsCookieConsentPrompt(), true)
  })
})

describe('customer legal surface', () => {
  it('routes cookies and 403 pages', () => {
    const app = read('src/App.jsx')
    assert.match(app, /path="\/cookies"/)
    assert.match(app, /path="\/403"/)
    assert.match(app, /CookiesPage/)
    assert.match(app, /ForbiddenPage/)
    assert.match(app, /unauthorizedTo="\/403"/)
  })

  it('exports CookiesPage and mounts error boundary + cookie reopen', () => {
    assert.match(read('src/pages/LegalPages.jsx'), /export function CookiesPage/)
    assert.match(read('src/main.jsx'), /AppErrorBoundary/)
    assert.match(read('src/components/CookieConsent.jsx'), /COOKIE_CONSENT_OPEN_EVENT/)
    assert.match(read('src/layouts/PublicLayout.jsx'), /CookiePreferencesButton/)
    assert.match(read('src/layouts/PublicLayout.jsx'), /to="\/cookies"/)
  })

  it('customer PII forms require FormLegalNotice', () => {
    for (const file of [
      'src/pages/ContactPage.jsx',
      'src/pages/ComplaintsPage.jsx',
      'src/pages/EventsPage.jsx',
      'src/pages/EventSharePage.jsx',
      'src/pages/PublicUtilityPage.jsx',
    ]) {
      assert.match(read(file), /FormLegalNotice/, `${file} missing FormLegalNotice`)
    }
    assert.match(read('src/pages/PublicFormPage.jsx'), /acceptedLegal/)
    assert.match(read('src/pages/PublicFormPage.jsx'), /to="\/terms"/)
  })
})
