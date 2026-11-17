import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { launchPuppeteer, prepareBrowserPage } from './puppeteerLaunch.js'

const ORIGIN = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

async function attachErrorCollectors(page) {
  const errors = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!/Failed to load resource: net::ERR_/i.test(text)) errors.push(`console: ${text}`)
    }
  })
  return errors
}

describe('PWA assets, SEO shells, push worker, and auth redirect guards', () => {
  let browser

  before(async () => {
    browser = await launchPuppeteer()
  })

  after(async () => {
    await browser?.close()
  })

  it('serves valid PWA workers, manifest, version metadata, and prerendered SEO HTML shells', async () => {
    const context = await browser.createBrowserContext()
    try {
      const page = await prepareBrowserPage(await context.newPage(), { width: 1440, height: 900 })
      const [pushSwRes, swRes, manifestRes, versionRes] = await Promise.all([
        fetch(`${ORIGIN}/push-sw.js`),
        fetch(`${ORIGIN}/sw.js`),
        fetch(`${ORIGIN}/manifest.webmanifest`),
        fetch(`${ORIGIN}/version.json`),
      ])

      assert.equal(pushSwRes.status, 200)
      assert.equal(swRes.status, 200)
      assert.equal(manifestRes.status, 200)
      assert.equal(versionRes.status, 200)

      const pushSwBody = await pushSwRes.text()
      assert.match(pushSwBody, /HAKUM_NAV/)
      assert.match(pushSwBody, /event\.data\?\.text/)
      assert.match(pushSwBody, /notificationclick/)

      const manifest = await manifestRes.json()
      assert.equal(manifest.display, 'standalone')
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0)

      for (const route of ['/branches/bacoor', '/services/ppf', '/blog']) {
        const errors = await attachErrorCollectors(page)
        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewport(viewport)
          const res = await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle0' })
          assert.ok(res.status() === 200 || res.status() === 304, `${route} returned ${res.status()}`)
          const state = await page.evaluate(() => ({
            title: document.title,
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            bodyLen: document.body.innerText.trim().length,
          }))
          assert.ok(state.title.length > 5, `${route} missing title`)
          assert.ok(state.canonical.startsWith('http'), `${route} missing canonical`)
          assert.ok(state.bodyLen > 100, `${route} rendered empty body`)
          assert.equal(state.overflow, false, `${route} horizontal overflow at ${viewport.width}px`)
        }
        assert.deepEqual(errors, [], `${route} emitted errors: ${errors.join('; ')}`)
      }
    } finally {
      await context.close()
    }
  })

  it('guards protected staff and customer deep links cleanly across mobile and desktop without errors', async () => {
    const context = await browser.createBrowserContext()
    try {
      const page = await prepareBrowserPage(await context.newPage(), { width: 390, height: 844 })
      const errors = await attachErrorCollectors(page)

      await page.goto(`${ORIGIN}/operations/finance?tab=sheets&sheet=qa`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname.startsWith('/operations/login'))
      const opsWall = await page.evaluate(() => ({
        pathname: location.pathname,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasForm: Boolean(document.querySelector('form input[type="password"]')),
      }))
      assert.equal(opsWall.pathname, '/operations/login')
      assert.equal(opsWall.hasForm, true)
      assert.equal(opsWall.overflow, false)

      await page.goto(`${ORIGIN}/account/book?service=paint-maintenance`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname === '/signin')
      const custWall = await page.evaluate(() => ({
        pathname: location.pathname,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasForm: Boolean(document.querySelector('form input[type="password"]')),
      }))
      assert.equal(custWall.pathname, '/signin')
      assert.equal(custWall.hasForm, true)
      assert.equal(custWall.overflow, false)

      await page.goto(`${ORIGIN}/operations/reviews`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => location.pathname.startsWith('/operations/login'))
      assert.equal(new URL(page.url()).pathname, '/operations/login')

      assert.deepEqual(errors, [])
    } finally {
      await context.close()
    }
  })
})
