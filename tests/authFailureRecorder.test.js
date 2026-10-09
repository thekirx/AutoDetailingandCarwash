import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { describe, it, after, before } from 'node:test'
import puppeteer from 'puppeteer'
import { collectErrors } from '../scripts/lib/collect-errors.mjs'

/**
 * BUG-067 is open because the recorder could not tell a request that carried a
 * stale token from one that carried no token at all — both printed as
 * "http 401 @/some/route <url>". These drive a real browser against real 401
 * responses so the distinction is proven against the wire, not asserted from the
 * source text. A gate that has never been seen red is an untested gate, so
 * test 5 deliberately asserts the *absence* of the credential.
 */

let server
let base
let browser
let page

before(async () => {
  // Only the API paths 401. The document itself must load cleanly, otherwise the
  // navigation and the favicon land in the same bucket as the calls under test
  // and every "exactly one failure" assertion is measuring the fixture, not the
  // recorder.
  server = createServer((req, res) => {
    if (req.url.startsWith('/rest/v1/')) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'denied' }))
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><title>fixture</title><body>ok</body>')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`

  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  page = await browser.newPage()
  await page.goto(`${base}/operations/bookings`, { waitUntil: 'networkidle2' })
})

after(async () => {
  await browser?.close()
  await new Promise((r) => server?.close(r))
})

describe('the auth-failure recorder must identify the request, not just the status', () => {
  it('records a 401 with its method, URL, route and a token digest', async () => {
    const errors = collectErrors(page)
    await page.evaluate(async (b) => {
      await fetch(`${b}/rest/v1/bookings?select=*`, { headers: { apikey: 'k', Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.personaA' } }).catch(() => null)
    }, base)
    await new Promise((r) => setTimeout(r, 400))
    const seen = errors.take()
    assert.equal(seen.length, 1, `expected exactly one recorded failure, got: ${JSON.stringify(seen)}`)
    const line = seen[0]
    assert.match(line, /^http 401 GET /, 'the method must be named')
    assert.match(line, /@\/operations\/bookings/, 'the route must be named')
    assert.match(line, /\/rest\/v1\/bookings/, 'the failing URL must be named')
    assert.match(line, /\[auth:[0-9a-f]{8}\]/, 'an attached token must leave a digest, not a blank')
  })

  it('distinguishes a request carrying a token from one carrying none', async () => {
    const errors = collectErrors(page)
    await page.evaluate(async (b) => {
      await fetch(`${b}/rest/v1/with-auth`, { headers: { Authorization: 'Bearer token-one' } }).catch(() => null)
      await fetch(`${b}/rest/v1/no-auth`).catch(() => null)
    }, base)
    await new Promise((r) => setTimeout(r, 400))
    const seen = errors.take()
    assert.equal(seen.length, 2, `expected two recorded failures, got: ${JSON.stringify(seen)}`)
    const withAuth = seen.find((l) => l.includes('/rest/v1/with-auth'))
    const noAuth = seen.find((l) => l.includes('/rest/v1/no-auth'))
    assert.ok(withAuth, 'the authenticated call was not recorded')
    assert.ok(noAuth, 'the unauthenticated call was not recorded')
    assert.match(withAuth, /\[auth:[0-9a-f]{8}\]/, 'a token must be fingerprinted')
    assert.match(noAuth, /\[auth:none\]/, 'an absent token must read "none", not a digest')
  })

  it('gives two different tokens two different digests, so a stale persona is visible', async () => {
    const errors = collectErrors(page)
    await page.evaluate(async (b) => {
      await fetch(`${b}/rest/v1/t1`, { headers: { Authorization: 'Bearer token-one' } }).catch(() => null)
      await fetch(`${b}/rest/v1/t2`, { headers: { Authorization: 'Bearer token-two' } }).catch(() => null)
      await fetch(`${b}/rest/v1/t1`, { headers: { Authorization: 'Bearer token-one' } }).catch(() => null)
    }, base)
    await new Promise((r) => setTimeout(r, 400))
    const seen = errors.take()
    const digests = seen.map((l) => l.match(/\[auth:([^\]]+)\]/)?.[1])
    assert.equal(digests.length, 3, `expected three records, got: ${JSON.stringify(seen)}`)
    assert.notEqual(digests[0], digests[1], 'two different tokens must not collapse to one digest')
    assert.equal(digests[2], digests[0], 'the same token must fingerprint identically')
  })

  it('ignores non-auth statuses so dev-server 404s stay out of the evidence', async () => {
    const notFound = createServer((req, res) => {
      res.statusCode = 404
      res.end('nope')
    })
    await new Promise((r) => notFound.listen(0, '127.0.0.1', r))
    const other = `http://127.0.0.1:${notFound.address().port}`
    const errors = collectErrors(page)
    await page.evaluate(async (b) => {
      await fetch(`${b}/missing-asset.js`).catch(() => null)
    }, other)
    await new Promise((r) => setTimeout(r, 400))
    // Only the wire channel is under test here: the 404 must not become an
    // `http 404` record. Chrome's own console line for it still comes through
    // on the console channel — that is pre-existing behaviour and the wave
    // already filters it at the call site.
    const wire = errors.take().filter((l) => l.startsWith('http '))
    assert.deepEqual(wire, [], 'a 404 is a dev-server artefact, not a product auth fault')
    await new Promise((r) => notFound.close(r))
  })

  it('never writes the credential itself into the evidence file', async () => {
    const secret = 'Bearer super-secret-token-value-9f3a'
    const errors = collectErrors(page)
    await page.evaluate(async (b, s) => {
      await fetch(`${b}/rest/v1/leak-check`, { headers: { Authorization: s } }).catch(() => null)
    }, base, secret)
    await new Promise((r) => setTimeout(r, 400))
    const seen = errors.take()
    assert.equal(seen.length, 1)
    assert.ok(
      !seen[0].includes('super-secret-token-value-9f3a'),
      `the raw token leaked into the record: ${seen[0]}`,
    )
    assert.ok(!seen[0].includes('Bearer '), `the scheme leaked too: ${seen[0]}`)
  })
})