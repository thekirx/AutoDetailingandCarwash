/**
 * `safeEvaluate` must survive a navigation race, and the harness must actually
 * use it everywhere it evaluates.
 *
 * This is a behavioural test against a real Puppeteer page, not a string grep
 * for the helper's name. A grep proves the symbol is mentioned; only driving a
 * browser proves the retry works.
 *
 * Why it matters: `e2e-role-qa-wave.mjs` reports a red run when a route guard
 * redirects mid-evaluate. On 2026-10-08 that turned a 179/179 wave into
 * 166/169 — `fail('fatal', 'Execution context was destroyed')` unwound the
 * whole run and silently dropped the remaining checks. A gate that fails for
 * reasons unrelated to the product is a gate people learn to ignore, which is
 * the same failure BUG-053 recorded for a stale persona.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { safeEvaluate, isNavigationRace } from '../scripts/lib/safe-evaluate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('a real navigation race does not lose the evaluate', async (t) => {
  let browser
  let server
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  } catch {
    t.skip('puppeteer could not launch in this environment')
    return
  }
  // Two real pages over real HTTP. The earlier attempts used setContent plus a
  // data: URL, and Chrome blocks navigation to a data: URL from a page — so the
  // redirect never happened and the test silently proved nothing. This version
  // asserts the post-race content, which can only pass if the race was real.
  server = createServer((req, res) => {
    const body = req.url === '/b' ? 'after' : 'before'
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(`<body><h1>${body}</h1></body>`)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    const page = await browser.newPage()
    await page.goto(`${base}/a`, { waitUntil: 'domcontentloaded' })

    // The redirect is driven from OUTSIDE the evaluate, while the evaluate is
    // genuinely still awaiting. That is the only shape that actually destroys
    // an execution context.
    const navTimer = setTimeout(() => { page.goto(`${base}/b`).catch(() => null) }, 300)

    const value = await safeEvaluate(page, async () => {
      await new Promise((r) => setTimeout(r, 1200))
      return document.body?.innerText || ''
    })
    clearTimeout(navTimer)

    // Strong form: the retry did not merely avoid throwing, it read the page as
    // it is NOW. A version that rethrows the race, or returns the pre-navigation
    // value, fails here.
    assert.equal(String(value).trim(), 'after',
      'safeEvaluate must retry through the navigation and read the page as it is now')
  } finally {
    await browser.close()
    await new Promise((r) => server.close(r))
  }
})

test('a genuine error is rethrown rather than swallowed as a race', async (t) => {
  // Retrying everything would turn real failures into silent passes, which is
  // how BUG-057 happened. Only the race is retryable.
  assert.equal(isNavigationRace(new Error('Execution context was destroyed, most likely because of a navigation.')), true)
  assert.equal(isNavigationRace(new Error('Cannot find context with specified id')), true)
  assert.equal(isNavigationRace(new Error('document.body.innerText is not a function')), false)
  assert.equal(isNavigationRace(new Error('net::ERR_CONNECTION_REFUSED')), false)

  // The predicate alone is not the behaviour. Drive the real helper and prove
  // it propagates: a version that `return false` instead of `throw err` passes
  // every assertion above and still silently converts a broken assertion into a
  // green run — exactly the failure mode BUG-057 recorded.
  let browser
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  } catch {
    t.skip('puppeteer could not launch in this environment')
    return
  }
  try {
    const page = await browser.newPage()
    await page.setContent('<body><h1>here</h1></body>')
    await assert.rejects(
      () => safeEvaluate(page, () => { throw new Error('genuine-failure-marker') }),
      (err) => /genuine-failure-marker/.test(String(err?.message || err)),
      'safeEvaluate must rethrow a non-race error instead of swallowing it',
    )
  } finally {
    await browser.close()
  }
})

test('the harness routes its assertions through safeEvaluate', () => {
  const src = read('scripts/e2e-role-qa-wave.mjs')
  // clearSession keeps its own explicit retry block; everything else must go
  // through the helper. A bare page.evaluate in an assertion path is the bug.
  const bare = [...src.matchAll(/(?<!safe)\bpage\.evaluate\(/g)]
  const clearSessionBlock = src.slice(src.indexOf('async function clearSession'), src.indexOf('async function opsLogin'))
  const outsideClearSession = src.replace(clearSessionBlock, '')
  const leftovers = [...outsideClearSession.matchAll(/(?<!safe)\bpage\.evaluate\(/g)]
  assert.equal(leftovers.length, 0,
    'assertion evaluates must use safeEvaluate so a redirect cannot abort the run')
  assert.ok(bare.length >= 0)
})