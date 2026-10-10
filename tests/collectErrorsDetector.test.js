import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createHash } from 'node:crypto'
import { collectErrors } from '../scripts/lib/collect-errors.mjs'

/**
 * The role-QA wave has gone ten consecutive runs with zero 401/403. That is
 * only meaningful if the instrument that would have caught them still works --
 * a collector that quietly stopped listening is indistinguishable from a wave
 * that genuinely stopped failing, and "we stopped seeing it" is exactly the
 * sentence that preceded BUG-067(2) being unresolvable for a day.
 *
 * So the collector is exercised directly, with a fake page, and required to
 * still produce the two records BUG-067 needs to tell its hypotheses apart:
 *
 *   http 401 GET @/operations/console .../api/foo [auth:1a2b3c4d]   stale token
 *   http 401 GET @/operations/console .../api/foo [auth:none]        no token
 *
 * Same status, same route, same URL -- and a completely different fix depending
 * on which one it is. That discrimination is the whole value of listening on the
 * wire instead of the console, whose message is always the same sentence and
 * names neither URL nor status.
 */

function fakePage(url = 'https://app.test/operations/console') {
  const handlers = {}
  return {
    on: (evt, cb) => {
      handlers[evt] = cb
    },
    url: () => url,
    fire: (evt, arg) => handlers[evt]?.(arg),
    has: (evt) => Boolean(handlers[evt]),
  }
}

function fakeResponse({ status = 401, method = 'GET', url = '/api/thing', headers = {} }) {
  return { status: () => status, url: () => url, request: () => ({ method: () => method, headers: () => headers }) }
}

describe('collectErrors still records the auth faults BUG-067 needs', () => {
  it('registers all three listeners -- console, pageerror and the wire', () => {
    const page = fakePage()
    collectErrors(page)
    assert.ok(page.has('console'), 'no console listener')
    assert.ok(page.has('pageerror'), 'no pageerror listener')
    assert.ok(page.has('response'), 'no response listener — this is the one that carries the route')
  })

  it('records a 401 with its route, method, URL and an auth digest', () => {
    const page = fakePage('https://app.test/operations/console')
    const { take } = collectErrors(page)
    page.fire('response', fakeResponse({ status: 401, method: 'GET', url: '/api/bookings?x=1' }))

    const got = take()
    assert.equal(got.length, 1, 'the 401 was not recorded at all')
    assert.match(got[0], /^http 401 GET @\/operations\/console /)
    assert.match(got[0], /\/api\/bookings\?x=1/)
  })

  it('tells a stale token from no token — the two BUG-067 hypotheses', () => {
    // Identical status and route. These need opposite fixes, so collapsing them
    // into "auth failed" is what made the original report unactionable.
    const page = fakePage()
    const { take } = collectErrors(page)

    page.fire('response', fakeResponse({ headers: { authorization: 'Bearer eyJhbGciOi.SECRET.TOKEN' } }))
    page.fire('response', fakeResponse({ headers: {} }))

    const got = take()
    assert.equal(got.length, 2)
    assert.match(got[0], /\[auth:[0-9a-f]{8}\]/)
    assert.match(got[1], /\[auth:none\]/)

    const expected = createHash('sha256').update('Bearer eyJhbGciOi.SECRET.TOKEN').digest('hex').slice(0, 8)
    assert.match(got[0], new RegExp(`\\[auth:${expected}\\]`))
  })

  it('never writes the credential itself into the evidence file', () => {
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('response', fakeResponse({ headers: { Authorization: 'Bearer super-secret-value' } }))
    const text = take().join('\n')
    assert.doesNotMatch(text, /super-secret-value/, 'the token leaked into the evidence')
    assert.doesNotMatch(text, /Bearer /, 'the auth scheme leaked into the evidence')
  })

  it('is scoped: a 404 is NOT recorded, so the signal stays diagnostic', () => {
    // The control that proves the filter is narrow. If everything were
    // recorded, "zero auth failures" would be unfalsifiable -- a wave full of
    // dev-server 404s would read as a failing wave, and once someone widened
    // the scope to silence that, the 401 check would die quietly.
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('response', fakeResponse({ status: 404 }))
    page.fire('response', fakeResponse({ status: 500 }))
    assert.deepEqual(take(), [], 'non-auth statuses leaked into the auth bucket')
  })

  it('drops the duplicate console 401 but keeps a console 500', () => {
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('console', { type: () => 'error', text: () => 'Failed to load resource: the server responded with a status of 401 ()' })
    assert.deepEqual(take(), [], 'the useless console duplicate was not suppressed')

    page.fire('console', { type: () => 'error', text: () => 'Uncaught TypeError: x is not a function' })
    assert.equal(take().length, 1, 'a real console error was dropped')
  })

  it('ignores console noise that is not an error', () => {
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('console', { type: () => 'warning', text: () => 'whatever' })
    page.fire('console', { type: () => 'log', text: () => 'hello' })
    assert.deepEqual(take(), [])
  })

  it('records a pageerror against the route it happened on', () => {
    const page = fakePage('https://app.test/operations/finance')
    const { take } = collectErrors(page)
    page.fire('pageerror', new Error('boom'))
    assert.match(take()[0], /^pageerror @\/operations\/finance: boom/)
  })

  it('take() drains, which is what gives each persona its own bucket', () => {
    // Route attribution is only per-persona because take() empties the array.
    // If it returned the array itself, every persona would inherit the previous
    // one's failures and the attribution BUG-067 gained would be fictional.
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('response', fakeResponse({ status: 401 }))
    assert.equal(take().length, 1)
    assert.deepEqual(take(), [], 'take() did not drain')
  })

  it('survives a response whose request is no longer resolvable', () => {
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('response', {
      status: () => 403,
      url: () => '/api/gone',
      request: () => {
        throw new Error('no longer resolvable')
      },
    })
    const got = take()
    assert.equal(got.length, 1, 'a 403 was dropped instead of degraded')
    assert.match(got[0], /^http 403 \? @\/operations\/console/)
  })

  it('truncates an enormous URL rather than writing it whole', () => {
    const page = fakePage()
    const { take } = collectErrors(page)
    page.fire('response', fakeResponse({ url: `/${'x'.repeat(5000)}` }))
    const got = take()[0]
    assert.ok(got.length < 500, `record grew to ${got.length} chars`)
  })
})