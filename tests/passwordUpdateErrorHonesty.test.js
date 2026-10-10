import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describePasswordUpdateError } from '../src/lib/authErrorMessage.js'

/**
 * BUG-078 — the two customer auth surfaces that still rendered raw server text.
 *
 * `CustomerSetPasswordPage.jsx` did `if (updateError) throw updateError` and then
 * `setError(err.message)`, so the screen could read "Auth session missing!" or
 * "Failed to fetch" verbatim. `CustomerSignUpPage.jsx` did the BUG-077 mistake
 * again on a different endpoint: `throw new Error(body.error || 'Unable to create
 * account.')`, discarding the status — so a 502 or a function timeout landed on
 * "Unable to create account." and, when the body was not JSON, on a message that
 * says nothing about what happened.
 *
 * The trap this file exists to prevent: the obvious fix is to reuse
 * `describeAuthError` on both, and that mints a NEW false credential verdict.
 * Verified by running the mapper, not by reading it:
 *
 *   describeAuthError({ status: 400,
 *     message: 'New password should be different from the old password.' })
 *     -> 'Invalid email or password.'
 *
 * On the page where the user has just chosen a password. So set-password gets its
 * own mapping, and the last test in the first block is the guard that keeps it
 * from ever degrading into the sign-in one.
 */

const CREDENTIALS = /invalid (phone|email) or password|wrong password/i
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const setPassword = readFileSync(join(root, 'src/pages/CustomerSetPasswordPage.jsx'), 'utf8')
const signUp = readFileSync(join(root, 'src/pages/CustomerSignUpPage.jsx'), 'utf8')
const body = (src) => src.replace(/import[^\n]*authErrorMessage[^\n]*/g, '')

describe('a failed password update is reported as what it actually is', () => {
  // The generic fallback is 'Could not save your password. Try again.' Every
  // specific branch below must beat it. Asserting only that the fallback is
  // absent is what caught the two loose matchers noted inline — `/again/i` and
  // `/try again/i` both match the fallback's own wording, so those assertions
  // passed whether or not the branch existed.
  const FALLBACK = /could not save your password/i

  it('points an expired reset link back at the email instead of showing "Auth session missing!"', () => {
    const msg = describePasswordUpdateError({ status: 400, message: 'Auth session missing!' })
    assert.doesNotMatch(msg, /auth session missing/i, 'the raw Supabase string must not reach the page')
    assert.doesNotMatch(msg, FALLBACK, 'a dead session has a specific fix; the generic message hides it')
    assert.match(msg, /link|expired/i, 'the fix for a dead session is to reopen the link')
  })

  it('distinguishes "same as your old password" from a credentials verdict', () => {
    const msg = describePasswordUpdateError({
      status: 422,
      message: 'New password should be different from the old password.',
    })
    assert.doesNotMatch(msg, CREDENTIALS, 'the user did not sign in; nothing about a password is wrong')
    assert.doesNotMatch(msg, FALLBACK)
    assert.match(msg, /different/i)
  })

  it('agrees with the page own minimum instead of Supabase default of six', () => {
    // The page validates 8 characters before it ever calls updateUser, so this
    // branch is defensive — but if it is ever reached it must not tell a customer
    // to use 6 while the form refuses 8.
    const msg = describePasswordUpdateError({ status: 400, message: 'Password should be at least 6 characters.' })
    assert.doesNotMatch(msg, FALLBACK)
    assert.match(msg, /8 characters/i)
    assert.doesNotMatch(msg, /6 characters/i)
  })

  it('still says the network or the service failed, never that the password is wrong', () => {
    const net = describePasswordUpdateError({ message: 'Failed to fetch' })
    assert.doesNotMatch(net, FALLBACK)
    assert.match(net, /connection|reach/i)

    const five = describePasswordUpdateError({ status: 500, message: 'Internal' })
    assert.doesNotMatch(five, FALLBACK)
    assert.match(five, /service/i)

    const limited = describePasswordUpdateError({ status: 429, message: 'Too many requests' })
    assert.doesNotMatch(limited, FALLBACK)
    assert.match(limited, /too many|wait/i)
  })

  it('NEVER returns a credentials verdict — the user just chose this password', () => {
    // The anti-tautology guard for BUG-078. Every unrecognised shape, including a
    // bare 400, must stay clear of the sign-in wording.
    const shapes = [
      null,
      undefined,
      {},
      { status: 400, message: 'Something new we have never seen' },
      { status: 400, message: 'Auth session missing!' },
      { status: 422, message: 'New password should be different from the old password.' },
      { status: 401 },
      { status: 404, message: 'User not found' },
      { status: 418, message: 'teapot' },
      { message: 'Failed to fetch' },
    ]
    for (const shape of shapes) {
      const msg = describePasswordUpdateError(shape)
      assert.equal(typeof msg, 'string', `non-string for ${JSON.stringify(shape)}`)
      assert.ok(msg.trim().length > 0, `empty message for ${JSON.stringify(shape)}`)
      assert.doesNotMatch(msg, CREDENTIALS, `${JSON.stringify(shape)} produced a credentials verdict`)
    }
  })
})

describe('signup classifies by status like the sign-in path does', () => {
  it('routes the signup failure through the mapper instead of body.error', () => {
    assert.match(
      signUp,
      /describeCustomerAuthFailure\(\{ status: res\.status, data: body \}\)/,
      'signup must classify by HTTP status, not pass body.error through',
    )
    assert.ok(
      !/throw new Error\(body\.error \|\| 'Unable to create account\.'\)/.test(body(signUp)),
      'signup must not treat any failure as "unable to create account"',
    )
  })

  it('still renders the per-field validation errors the server sends', () => {
    // 400 carries `fields`; losing that would turn a highlighted-form UX into a
    // single banner. The fix must not swallow it.
    assert.match(signUp, /if \(body\.fields\) setErrors\(body\.fields\)/)
  })

  it('set-password routes its updateUser failure through the mapper', () => {
    assert.match(
      setPassword,
      /setError\(describePasswordUpdateError\(err\)\)/,
      'set-password must classify rather than show err.message verbatim',
    )
    assert.ok(
      !/if \(updateError\) throw updateError/.test(body(setPassword)),
      'the raw error must not be rethrown into a setError(err.message) catch',
    )
  })

  it('never re-wraps an already-described message', () => {
    // Caught while implementing, not after. `throw new Error(describePasswordUpdateError(e))`
    // sends the message back through the mapper on the way to the catch, where no
    // branch recognises it and it degrades to the generic fallback — losing the
    // actual guidance the user needed. Describe once, at the point of failure.
    assert.ok(
      !/throw new Error\(\s*\n?\s*describePasswordUpdateError/.test(body(setPassword)),
      'a described message must not be fed back through the mapper',
    )
  })

  it('does not report a failed save when the save already succeeded', () => {
    // `homeAfterPassword` runs AFTER setDone(true). If it throws, the old shape
    // reported "Could not save your password" on a screen that was simultaneously
    // showing "Password saved. Redirecting…".
    assert.match(
      setPassword,
      /homeAfterPassword\([\s\S]{0,80}?\)\.catch\(/,
      'resolving the landing page must not be able to surface as a save failure',
    )
    const doneIdx = setPassword.indexOf('setDone(true)')
    // Search for the CALL, not the declaration: `indexOf('homeAfterPassword(')`
    // finds the function definition near the top of the file, which is always
    // before setDone(true) and makes this ordering assertion vacuously false.
    const homeIdx = setPassword.indexOf('homeAfterPassword(', doneIdx)
    assert.ok(doneIdx > -1, 'the save must be marked done')
    assert.ok(homeIdx > doneIdx, 'the redirect lookup must come after the save is marked done')
  })
})

describe('the two mappings cannot be swapped by accident', () => {
  it('the password-update mapper is not the sign-in mapper under a new name', () => {
    // Pin the difference that makes them different objects. If someone routes
    // set-password through describeAuthError, this is the shape that breaks.
    const signInSays = describeAuthErrorShim()
    const updateSays = describePasswordUpdateError({
      status: 400,
      message: 'New password should be different from the old password.',
    })
    assert.notEqual(signInSays, updateSays)
  })
})

// Local copy of the sign-in mapper's behaviour for this one shape, so the test
// does not depend on describeAuthError's internals staying identical forever.
function describeAuthErrorShim() {
  const status = 400
  return status === 400 ? 'Invalid email or password.' : 'Sign-in failed. Please try again.'
}