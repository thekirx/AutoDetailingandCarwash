import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import { notificationHref } from '../src/lib/notificationUrl.js'

/**
 * `notificationHref` decides where a notification click actually lands, and it had
 * no test at all. The fan-out test proves a notification carries a url the role is
 * allowed to open and that the app renders that route -- but between the stored url
 * and the click there is one more function, and it was the only piece of the
 * click-through path with nothing watching it.
 *
 * The file's own docstring states the intent: "External origins are rejected so
 * Link never escapes the app shell." That is a containment promise, and the guard
 * is `/^https?:\/\//i` followed by `raw.startsWith('/')`. A protocol-relative url
 * is `//host` -- no scheme, so the first guard misses it, and it starts with `/`,
 * so the second returns it verbatim into `<Link to=...>`.
 *
 * Exploitability is bounded and worth stating plainly: notification urls are
 * written by the app, so reaching `//evil.com` needs a hostile value in a
 * notification row rather than a link anyone can click. This is defence in depth
 * against a stated promise the code did not keep -- not a remotely reachable open
 * redirect, and it is filed that way rather than inflated.
 */

const HOME = '/operations/dashboard'

afterEach(() => {
  delete globalThis.window
})

describe('notificationHref keeps a click inside the app shell', () => {
  it('passes an ordinary internal path through verbatim', () => {
    // The control: without this, a function that returned the fallback for
    // everything would satisfy every other assertion in this file.
    assert.equal(notificationHref('/operations/queue', HOME), '/operations/queue')
  })

  it('keeps the query string a deep link depends on', () => {
    // A notification pointing at a specific sheet/day is useless without its query.
    assert.equal(
      notificationHref('/operations/pos?tab=sheet&date=2026-09-30', HOME),
      '/operations/pos?tab=sheet&date=2026-09-30',
    )
  })

  it('falls back rather than linking to nothing', () => {
    assert.equal(notificationHref(null, HOME), HOME)
    assert.equal(notificationHref(undefined, HOME), HOME)
    assert.equal(notificationHref('', HOME), HOME)
    assert.equal(notificationHref('   ', HOME), HOME)
    assert.equal(notificationHref('/', HOME), HOME, 'a bare slash is not a destination')
  })

  it('rejects an external origin', () => {
    assert.equal(notificationHref('https://evil.example/steal', HOME), HOME)
    assert.equal(notificationHref('http://evil.example/steal', HOME), HOME)
  })

  it('unwraps a same-origin absolute url to a path the router can use', () => {
    globalThis.window = { location: { origin: 'https://ops.hakumautocare.com' } }
    assert.equal(
      notificationHref('https://ops.hakumautocare.com/operations/finance?tab=sheets', HOME),
      '/operations/finance?tab=sheets',
    )
    assert.equal(notificationHref('https://ops.hakumautocare.com/', HOME), HOME)
  })

  it('refuses a protocol-relative url', () => {
    // No scheme, so the https?:// guard cannot see it -- but `//host` is exactly
    // what a browser resolves to an external origin.
    assert.equal(notificationHref('//evil.example/steal', HOME), HOME)
  })

  it('refuses the backslash spelling of the same escape', () => {
    // Browsers normalise `/\` to `//`, so filtering only `//` leaves the door open.
    assert.equal(notificationHref('/\\evil.example/steal', HOME), HOME)
  })

  it('refuses a relative path that would leave the shell', () => {
    assert.equal(notificationHref('evil.example/steal', HOME), HOME)
  })
})