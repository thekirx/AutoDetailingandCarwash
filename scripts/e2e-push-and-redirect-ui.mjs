/* global window, document, location, HTMLInputElement */
/**
 * Browser E2E verification for the push notification UI, iOS install guidance,
 * post-login deep-link preservation (staff + customer), SW SPA navigation,
 * /operations/reviews -> /operations/forms/results redirect, and Planner Forms.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/e2e-push-and-redirect-ui.mjs
 *   Or omit BASE_URL to run against self-managed vite preview.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { CUSTOMER_DEMO_ACCOUNT, OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { isOpsAuthedUrl } from './screenshotAuth.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const boss = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'boss')
assert.ok(boss?.password, 'Missing VITE_DEMO_PASSWORD_BOSS in environment')
assert.ok(CUSTOMER_DEMO_ACCOUNT?.password, 'Missing VITE_DEMO_PASSWORD_CUSTOMER in environment')

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

async function startPreview() {
  const proc = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: root,
    stdio: 'pipe',
  })
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:4173/home')
      if (res.ok) return proc
    } catch {
      /* waiting for server */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  proc.kill('SIGKILL')
  throw new Error('vite preview failed to start on 127.0.0.1:4173')
}

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (btn) await btn.click().catch(() => null)
}

async function submitLoginForm(page, email, password) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Use email or plate instead/i.test(b.textContent || ''),
    )
    if (btn) btn.click()
  })
  await page.waitForSelector('input:not([type="password"]):not([type="hidden"])', { timeout: 20000 })
  await page.evaluate(
    (e, p) => {
      const emailInput =
        document.querySelector('input[type="email"], input[name="email"]') ||
        document.querySelector('input:not([type="password"]):not([type="hidden"])')
      const passInput = document.querySelector('input[type="password"], input[name="password"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(emailInput, e)
      emailInput.dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(passInput, p)
      passInput.dispatchEvent(new Event('input', { bubbles: true }))
    },
    email,
    password,
  )
  await page.click('button[type="submit"]')
}

function attachErrors(page, bucket) {
  page.on('pageerror', (err) => bucket.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Failed to load resource: net::ERR_|status of 401/i.test(text)) return
    bucket.push(`console: ${text}`)
  })
}

const results = []
function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}

async function main() {
  const base = (process.env.BASE_URL || '').replace(/\/$/, '') || 'http://127.0.0.1:4173'
  const selfServer = process.env.BASE_URL ? null : await startPreview()
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

  try {
    // 1. Staff deep-link query preservation + mobile/desktop PushToggle + SPA SW nav + /operations/reviews redirect
    const opsCtx = await browser.createBrowserContext()
    try {
      const page = await opsCtx.newPage()
      await page.setViewport({ width: 1440, height: 900 })
      const errors = []
      attachErrors(page, errors)

      await page.goto(`${base}/operations/finance?tab=sheets&sheet=qa-probe`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname === '/operations/login')
      await dismissCookieBanner(page)
      await submitLoginForm(page, boss.email, boss.password)
      await page.waitForFunction(
        () => location.pathname === '/operations/finance' && location.search.includes('tab=sheets'),
        { timeout: 30000 },
      )
      const landed = new URL(page.url())
      assert.equal(landed.pathname, '/operations/finance')
      assert.equal(landed.searchParams.get('tab'), 'sheets')
      assert.equal(landed.searchParams.get('sheet'), 'qa-probe')
      assert.equal(isOpsAuthedUrl(page.url()), true)
      pass('staff.deep_link_preserves_query', landed.pathname + landed.search)

      // Mobile 390x844 must render PushToggle cleanly with zero horizontal overflow
      await page.setViewport({ width: 390, height: 844 })
      await page.waitForSelector('.push-chip', { timeout: 10000 })
      const mobileState = await page.evaluate(() => {
        const chip = document.querySelector('.push-chip')
        const rect = chip?.getBoundingClientRect()
        return {
          visible: Boolean(chip && rect && rect.width > 0 && rect.height > 0),
          text: chip?.textContent?.trim() || '',
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })
      assert.equal(mobileState.visible, true, 'PushToggle must stay visible on mobile staff header')
      assert.equal(mobileState.overflow, false, 'Mobile finance header overflow')
      pass('staff.mobile_push_chip_visible', mobileState.text)

      // Test HAKUM_NAV service-worker message -> hakum:sw-navigate -> SPA router navigation + Planner Forms tab
      await page.setViewport({ width: 1440, height: 900 })
      const navMarker = await page.evaluate(() => {
        window.__hakumSpaMarker = 'alive'
        navigator.serviceWorker.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'HAKUM_NAV', url: `${location.origin}/operations/planning?tab=forms` },
          }),
        )
        return { marker: window.__hakumSpaMarker }
      })
      assert.equal(navMarker.marker, 'alive')
      await page.waitForFunction(
        () => location.pathname === '/operations/planning' && location.search.includes('tab=forms'),
        { timeout: 15000 },
      )
      const stillAlive = await page.evaluate(() => window.__hakumSpaMarker === 'alive')
      assert.equal(stillAlive, true, 'HAKUM_NAV SPA navigation should not trigger a hard page reload')
      pass('staff.sw_spa_navigate_no_reload', page.url())

      // Check /operations/planning has Form Results tab and renders embedded FormResultsBoardPage without Events RSVP
      await page.waitForSelector('[aria-label="Planner Board"] [role="tab"]', { timeout: 15000 })
      const clickedResultsTab = await page.evaluate(() => {
        const tab = [...document.querySelectorAll('[aria-label="Planner Board"] [role="tab"]')].find((el) =>
          /Form Results/i.test(el.textContent || ''),
        )
        if (!tab) return false
        tab.click()
        return true
      })
      assert.equal(clickedResultsTab, true, 'Planner Board must include Form Results tab')
      await page.waitForFunction(
        () => location.search.includes('tab=results') && Boolean(document.querySelector('.frb-embedded')),
        { timeout: 15000 },
      )
      const hasEventsRsvpTab = await page.evaluate(() =>
        [...document.querySelectorAll('.frb-embedded [role="tab"]')].some((el) =>
          /Events RSVP/i.test(el.textContent || ''),
        ),
      )
      assert.equal(hasEventsRsvpTab, false, 'Events RSVP tab must be removed from Form Results')
      pass('staff.planner_form_results_tab', page.url())

      // Check /operations/reviews redirects to /operations/forms/results
      await page.goto(`${base}/operations/reviews`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname === '/operations/forms/results', { timeout: 15000 })
      assert.equal(new URL(page.url()).pathname, '/operations/forms/results')
      pass('staff.reviews_redirect_to_form_results', page.url())

      assert.deepEqual(errors, [], `Ops session emitted errors: ${errors.join('; ')}`)
    } finally {
      await opsCtx.close()
    }

    // 2. Emulated iOS Safari non-standalone -> mobile header shows "Install app" + modal instructions
    const iosCtx = await browser.createBrowserContext()
    try {
      const page = await iosCtx.newPage()
      await page.setUserAgent(IOS_SAFARI_UA)
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'chrome', { value: undefined, configurable: true })
        Object.defineProperty(navigator, 'standalone', { value: false, configurable: true })
      })
      const errors = []
      attachErrors(page, errors)

      await page.goto(`${base}/operations/login`, { waitUntil: 'networkidle0' })
      await dismissCookieBanner(page)
      await submitLoginForm(page, boss.email, boss.password)
      await page.waitForFunction(() => location.pathname.startsWith('/operations') && location.pathname !== '/operations/login', {
        timeout: 30000,
      })

      await page.waitForSelector('.push-chip', { timeout: 10000 })
      const iosChipText = await page.$eval('.push-chip', (el) => el.textContent.trim())
      assert.match(iosChipText, /Install app/i)
      await page.click('.push-chip')
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
      const modalText = await page.$eval('[role="dialog"]', (el) => el.textContent)
      assert.match(modalText, /Add to Home Screen/i)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false)
      pass('ios_safari.install_guidance_modal', iosChipText)

      assert.deepEqual(errors, [], `iOS context errors: ${errors.join('; ')}`)
    } finally {
      await iosCtx.close()
    }

    // 3. Customer deep-link /account/book?service=paint-maintenance preservation + /account mobile header
    const custCtx = await browser.createBrowserContext()
    try {
      const page = await custCtx.newPage()
      await page.setViewport({ width: 390, height: 844 })
      const errors = []
      attachErrors(page, errors)

      await page.goto(`${base}/account/book?service=paint-maintenance`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname === '/signin', { timeout: 15000 })
      await dismissCookieBanner(page)
      await submitLoginForm(page, CUSTOMER_DEMO_ACCOUNT.email, CUSTOMER_DEMO_ACCOUNT.password)
      await page.waitForFunction(
        () => location.pathname === '/account/book' && location.search.includes('service=paint-maintenance'),
        { timeout: 30000 },
      )
      assert.equal(new URL(page.url()).pathname, '/account/book')
      assert.equal(new URL(page.url()).searchParams.get('service'), 'paint-maintenance')
      pass('customer.deep_link_preserves_query', page.url())

      await page.goto(`${base}/account`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.push-chip', { timeout: 10000 })
      const custMobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      assert.equal(custMobileOverflow, false)
      pass('customer.mobile_account_push_and_layout')

      assert.deepEqual(errors, [], `Customer session errors: ${errors.join('; ')}`)
    } finally {
      await custCtx.close()
    }

    console.log(`\nALL ${results.length} E2E PUSH/REDIRECT FLOWS PASSED`)
  } finally {
    await browser.close()
    if (selfServer) selfServer.kill('SIGKILL')
  }
}

main().catch((err) => {
  console.error('✖ E2E push/redirect failed:', err)
  process.exit(1)
})
