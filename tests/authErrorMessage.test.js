import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describeAuthError, isTransientAuthFailure } from '../src/lib/authErrorMessage.js'

/**
 * BUG-076 — the login page answered *every* auth error with "Invalid email or
 * password.", including a 429, a 5xx and a dead network.
 *
 * This is not cosmetic. A Branch Admin whose sign-in fails because the auth service
 * hiccupped is told their password is wrong: they retry, hammer the endpoint, and
 * escalate to the owner over a non-problem. The one thing the user can act on is the
 * distinction between "your credentials are wrong" and "we could not ask", so it is
 * the distinction the message must preserve.
 *
 * The last case is not hypothetical. The evidence from the readiness run that
 * started this investigation showed the real page rendering correctly, credentials
 * filled, and displaying exactly this string.
 */

const CREDENTIALS = 'Invalid email or password.'

describe('a sign-in failure is reported as what it actually is', () => {
  it('blames the password only when the server said the credentials were wrong', () => {
    assert.equal(describeAuthError({ status: 400, message: 'Invalid login credentials' }), CREDENTIALS)
    assert.equal(describeAuthError({ message: 'Invalid login credentials' }), CREDENTIALS)
  })

  it('tells the user to wait when they are being rate limited', () => {
    const msg = describeAuthError({ status: 429, message: 'Too many requests' })
    assert.notEqual(msg, CREDENTIALS, 'a rate limit must not be reported as a bad password')
    assert.match(msg, /too many|wait/i)
    assert.ok(isTransientAuthFailure({ status: 429, message: 'Too many requests' }))
  })

  it('tells the user the server could not be reached when the network failed', () => {
    for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch', 'timeout', 'ECONNREFUSED']) {
      const msg = describeAuthError({ message })
      assert.notEqual(msg, CREDENTIALS, `"${message}" must not be reported as a bad password`)
      assert.ok(isTransientAuthFailure({ message }), `"${message}" must count as transient`)
    }
  })

  it('does not blame the password when the auth service itself is failing', () => {
    // A 5xx means nothing is known about the credentials. Guessing "wrong password"
    // here is precisely the misreport that sent this investigation down a path.
    const msg = describeAuthError({ status: 503, message: 'Service Unavailable' })
    assert.notEqual(msg, CREDENTIALS, 'a 5xx must not be reported as a bad password')
    assert.match(msg, /service|try again/i)
    assert.ok(isTransientAuthFailure({ status: 503, message: 'Service Unavailable' }))
  })

  it('points an unconfirmed account at the person who can fix it', () => {
    const msg = describeAuthError({ status: 403, message: 'Email not confirmed' })
    assert.notEqual(msg, CREDENTIALS)
    assert.match(msg, /confirm/i)
  })

  it('never returns an empty message, whatever it is handed', () => {
    for (const input of [null, undefined, {}, { status: 0, message: '' }, { status: 418, message: 'teapot' }]) {
      const msg = describeAuthError(input)
      assert.equal(typeof msg, 'string')
      assert.ok(msg.trim().length > 0, `empty message for ${JSON.stringify(input)}`)
    }
  })

  it('treats an empty error as transient-unknown rather than a credential verdict', () => {
    // No error at all must never become "your password is wrong".
    assert.notEqual(describeAuthError(null), CREDENTIALS)
    assert.notEqual(describeAuthError({ status: 418, message: 'teapot' }), CREDENTIALS)
  })
})

describe('the login pages use the honest mapping', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const login = readFileSync(join(root, 'src/pages/LoginPage.jsx'), 'utf8')

  it('LoginPage delegates to describeAuthError instead of hardcoding the string', () => {
    assert.match(login, /describeAuthError\(authError\)/, 'the handler must call the mapper')
    // The old literal must survive only where the mapper defines it, never inline.
    const inline = login.replace(/import[^\n]*authErrorMessage[^\n]*/g, '')
    assert.ok(
      !/setError\(['"]Invalid email or password/.test(inline),
      'LoginPage must not hardcode the credential error for every failure',
    )
  })
})