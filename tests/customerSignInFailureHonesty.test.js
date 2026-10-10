import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describeCustomerAuthFailure } from '../src/lib/authErrorMessage.js'

/**
 * BUG-077 — the customer sign-in page had the same misreport as BUG-076, in the
 * place where it costs the most trust.
 *
 * CustomerSignInPage.jsx reached for `/api/customer-auth-lookup` and, when that
 * request came back anything other than a session, answered with a literal
 * credential string:
 *
 *   throw new Error(data.error || 'Invalid phone or password.')   // line 200
 *   throw new Error(data.error || pwError?.message || 'Invalid email or password.')
 *
 * The HTTP status was discarded. That matters because `data` is `{}` whenever the
 * body is not JSON — a gateway 502, a Vercel function timeout, a hard crash in the
 * serverless handler. In exactly those cases the fallback fires and the customer is
 * told their password is wrong. Nobody asked the password. Nobody checked it.
 *
 * The status code is the authoritative discriminator, and the server already
 * maintains it honestly: server/customerSignIn.mjs returns 401 only when Auth
 * actually rejected the credentials, 429 only from rateLimit(), and 500 only when
 * something threw. So classify on the status and keep the server's own wording only
 * when the server deliberately sent one.
 *
 * The last test in the first block is the anti-tautology guard. A "fix" that
 * replaced every failure with a vague apology would satisfy the first four and fail
 * that one — the mapping must still say the credentials are wrong when they are.
 */

const CREDENTIALS = /invalid (phone|email) or password/i

describe('a customer sign-in failure is reported as what it actually is', () => {
  it('does not blame the password when the server crashed and sent no JSON', () => {
    // The exact shape that fires the fallback: a non-OK response whose body did
    // not parse, so `data` is `{}`.
    const msg = describeCustomerAuthFailure({ status: 500, data: {} })
    assert.doesNotMatch(msg, CREDENTIALS, 'a server crash must not be reported as a bad password')
    assert.match(msg, /service|try again/i)
  })

  it('does not blame the password on any server-side or transport fault', () => {
    const faults = [
      { status: 500, data: {} },
      { status: 502, data: {} },
      { status: 503, data: { error: 'Service Unavailable' } },
      { status: 429, data: { error: 'Too many requests. Try again shortly.' } },
      { status: 504, data: {} },
      { status: 0, data: {} },
      { status: 0, data: null },
      {},
    ]
    for (const fault of faults) {
      const msg = describeCustomerAuthFailure(fault)
      assert.doesNotMatch(
        msg,
        CREDENTIALS,
        `${JSON.stringify(fault)} must not be reported as a bad password`,
      )
      assert.ok(msg.trim().length > 0, `empty message for ${JSON.stringify(fault)}`)
    }
  })

  it('keeps internal server detail out of a customer-facing message', () => {
    // customerAuthLookup.mjs rethrows err.message verbatim on a 500, which can be
    // "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY". That is our
    // infrastructure talking to a customer.
    const msg = describeCustomerAuthFailure({
      status: 500,
      data: { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
    })
    assert.doesNotMatch(msg, /SUPABASE_URL|SERVICE_ROLE/i, 'internal config names must not reach the page')
  })

  it('STILL says the credentials are wrong when the server rejected them', () => {
    // Anti-tautology: honesty must not become vagueness.
    assert.match(describeCustomerAuthFailure({ status: 401, data: {} }), CREDENTIALS)
    assert.match(
      describeCustomerAuthFailure({ status: 401, data: { error: 'Invalid phone or password.' } }),
      CREDENTIALS,
    )
  })

  it("keeps the server's curated wording when the server deliberately sent one", () => {
    // need_password (400) and the activate / offer_signup shapes carry guidance the
    // page must not paraphrase away.
    assert.equal(
      describeCustomerAuthFailure({ status: 400, data: { error: 'Enter a password to finish setup.' } }),
      'Enter a password to finish setup.',
    )
    assert.equal(
      describeCustomerAuthFailure({
        status: 409,
        data: { error: 'Activate your account to see your history.' },
      }),
      'Activate your account to see your history.',
    )
  })
})

describe('CustomerSignInPage classifies instead of hardcoding', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const page = readFileSync(join(root, 'src/pages/CustomerSignInPage.jsx'), 'utf8')
  // Ignore the module's own import line when looking for inline literals.
  const body = page.replace(/import[^\n]*authErrorMessage[^\n]*/g, '')

  it('delegates the API failure to describeCustomerAuthFailure', () => {
    assert.match(page, /from '\.\.\/lib\/authErrorMessage'/s, 'the page must import the mapper')
    assert.match(
      page,
      /describeCustomerAuthFailure\(\{\s*status:\s*res\.status/,
      'the API failure must be classified by HTTP status, not by message text',
    )
  })

  it('carries no inline credential fallback', () => {
    assert.ok(
      !/throw new Error\([^)]*\|\|\s*['"]Invalid (phone|email) or password/.test(body),
      'CustomerSignInPage must not hardcode a credential verdict as the fallback for any failure',
    )
  })

  it('passes the real status instead of testing res.ok alone', () => {
    // `!res.ok` collapses 401, 429, 500, 502 and 504 into one branch. The status
    // has to reach the mapper or the classification cannot happen.
    assert.ok(
      !/if\s*\(\s*!\s*res\.ok\s*\|\|\s*!data\.access_token\s*\|\|\s*!data\.refresh_token\s*\)\s*\{\s*\n?\s*throw new Error\(data\.error/.test(
        body,
      ),
      'the bare !res.ok branch must classify rather than pass data.error through',
    )
  })

  it('classifies a dead network instead of showing the browser raw message', () => {
    // A rejected fetch reaches the shared `catch (err) { setError(err.message) }`
    // untouched, so the customer would read "Failed to fetch". Nothing was asked
    // of the password, so nothing may be claimed about it.
    assert.match(
      page,
      /catch \(err\) \{[\s\S]{0,120}?throw new Error\(\s*\n?\s*describeAuthError\(\{ message: err\?\.message \}\)/,
      'the sign-in fetch must classify transport failures before the shared catch sees them',
    )
  })

  it('routes the password-reset fallback through the same mapper', () => {
    assert.ok(
      !/if \(resetError\) throw resetError/.test(body),
      'a raw Supabase error must not be shown verbatim on the customer page',
    )
  })

  it('routes the lookup helper through the mapper too', () => {
    // The typing debounce swallows its errors, but handleSendSetup and handleForgot
    // render `err.message` directly — so a 5xx here put "Missing SUPABASE_URL or
    // SUPABASE_SERVICE_ROLE_KEY" on the screen. Assert positively, scoped to this
    // function: the same mapper call also appears in the sign-in branch below it.
    const lookupFn = page.match(/async function authLookup\([\s\S]*?\n\}/)?.[0]
    assert.ok(lookupFn, 'authLookup must remain findable for this assertion to mean anything')
    assert.match(
      lookupFn,
      /describeCustomerAuthFailure\(\{ status: res\.status, data \}\)/,
      'authLookup must classify by status, not pass our own 5xx text to the customer',
    )
  })
})