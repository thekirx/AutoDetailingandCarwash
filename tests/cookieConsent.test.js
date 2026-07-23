import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  COOKIE_CONSENT_KEY,
  needsCookieConsentPrompt,
  readCookieConsent,
  writeCookieConsent,
} from '../src/lib/cookieConsent.js'

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
})
