import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { safeNotificationPath } from '../server/notificationTargetUrl.mjs'

/**
 * A broadcast's "Tap URL" is free text typed by a Marketing / Assistant Super
 * Admin / Super Admin account, and it was passed through verbatim into the push
 * payload and into two tables.
 *
 * Both consumers now refuse to leave the app -- `notificationHref` for the inbox
 * link and the service worker's `notificationclick` for the tap -- so this guard
 * is not what keeps a user safe. It exists because the value is *stored*: today
 * the only place that could re-open the hole is a future surface rendering a
 * broadcast-history row with a plain href, and "closed in two other places" is
 * not a property that survives being restated in a third.
 */
describe('safeNotificationPath', () => {
  it('keeps an internal path, including its query', () => {
    // The control. Without it a function returning the fallback for everything
    // would satisfy every containment assertion below.
    assert.equal(safeNotificationPath('/operations/pos?tab=sheet&date=2026-09-30'), '/operations/pos?tab=sheet&date=2026-09-30')
    assert.equal(safeNotificationPath('/account'), '/account')
  })

  it('falls back rather than storing nothing', () => {
    assert.equal(safeNotificationPath(null, '/account'), '/account')
    assert.equal(safeNotificationPath('', '/account'), '/account')
    assert.equal(safeNotificationPath('   ', '/account'), '/account')
    assert.equal(safeNotificationPath('/', '/account'), '/account')
  })

  it('refuses a url that would leave the app', () => {
    assert.equal(safeNotificationPath('https://evil.test/phish', '/account'), '/account')
    assert.equal(safeNotificationPath('http://evil.test/phish', '/account'), '/account')
    assert.equal(safeNotificationPath('javascript:alert(1)', '/account'), '/account')
  })

  it('refuses both spellings of a protocol-relative escape', () => {
    assert.equal(safeNotificationPath('//evil.test/phish', '/account'), '/account')
    assert.equal(safeNotificationPath('/\\evil.test/phish', '/account'), '/account')
  })

  it('honours the fallback it was given, rather than always /account', () => {
    // pushApi sends system pushes with '/' as the fallback; hard-coding /account
    // would silently redirect a system notification into the customer shell.
    assert.equal(safeNotificationPath('https://evil.test', '/'), '/')
  })

  it('every ingest point routes through it, so none can drift back to raw', () => {
    // The helper is worthless if one caller keeps bypassing it. This asserts the
    // call sites, not the behaviour, because behaviour at a call site is invisible
    // to a unit test of the helper.
    for (const file of ['server/notificationBroadcastApi.mjs', 'server/pushApi.mjs']) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      assert.ok(src.includes('safeNotificationPath'), `${file} does not normalise the broadcast url`)
      assert.doesNotMatch(
        src,
        /url:\s*body\.url\s*\|\|/,
        `${file} still stores the raw broadcast url`,
      )
    }
  })
})