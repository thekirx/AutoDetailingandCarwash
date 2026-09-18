import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { launchPuppeteer, newPreparedPage } from './puppeteerLaunch.js'

const PREVIEW_ORIGIN = process.env.PUBLIC_TEST_URL || process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4173'

describe('BreDESIGN public page fallbacks', () => {
  let browser
  let page

  before(async () => {
    browser = await launchPuppeteer()
    page = await newPreparedPage(browser, { width: 1440, height: 900 })
  })

  after(async () => {
    await browser?.close()
  })

  it('renders the complete services catalog instead of a network error', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/services`, { waitUntil: 'networkidle0' })
    const result = await page.evaluate(() => ({
      error: document.querySelector('[role="alert"]')?.textContent.trim() || '',
      cards: [...document.querySelectorAll('#catalog .bd-card h2')].map((item) => item.textContent.trim()),
    }))

    assert.equal(result.error, '')
    assert.equal(result.cards.length, 8)
    assert.ok(result.cards.some((title) => title.startsWith('Paint Protection Film')))
    assert.ok(!result.cards.includes('Paint Maintenance'))
    assert.ok(!result.cards.some((title) => /package/i.test(title)))
  })

  it('renders all branch cards instead of a network error', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/branches`, { waitUntil: 'networkidle0' })
    const result = await page.evaluate(() => ({
      error: document.querySelector('[role="alert"]')?.textContent.trim() || '',
      cards: [...document.querySelectorAll('#locations .bd-site h2')].map((item) => item.textContent.trim()),
    }))

    assert.equal(result.error, '')
    assert.deepEqual(result.cards, ['Bacoor', 'Batangas', 'Dasmariñas'])
  })

  it('shows TikTok in Contact Us', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/contact`, { waitUntil: 'networkidle0' })
    const href = await page.$eval('a[aria-label="Hakum on TikTok"]', (link) => link.href)
    assert.equal(href, 'https://www.tiktok.com/@hakum_autocare')
  })

  it('shows the approved PPF names and keeps the package comparison visible', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/services/ppf`, { waitUntil: 'networkidle0' })
    const comparisonState = await page.evaluate(() => ({
      tiers: document.querySelectorAll('.bd-tier').length,
      tierNames: [...document.querySelectorAll('.bd-tier h3')].map((item) => item.textContent.trim()),
      redundantPriceSummary: Boolean(document.querySelector('.bd-pk-price')),
      toggle: Boolean(document.querySelector('.bd-cmp-toggle')),
      comparisonHidden: document.querySelector('#ppf-compare')?.hidden,
      stepLabels: document.querySelectorAll('.bd-tier-step').length,
      risers: document.querySelectorAll('.bd-tier-riser').length,
    }))

    assert.deepEqual(comparisonState, {
      tiers: 4,
      tierNames: [
        'High Impact Partial',
        'Basic PPF Protection',
        'Ultimate PPF Protection',
        'Platinum PPF Protection',
      ],
      redundantPriceSummary: false,
      toggle: false,
      comparisonHidden: false,
      stepLabels: 0,
      risers: 0,
    })
  })

  it('keeps the complete Hakum story over the storefront image at desktop and phone widths', async () => {
    for (const viewport of [
      { width: 1440, height: 900, maxCopyTopRatio: 0.2 },
      { width: 390, height: 844, maxCopyTopRatio: 0.16 },
    ]) {
      await page.setViewport(viewport)
      await page.goto(`${PREVIEW_ORIGIN}/home#origin`, { waitUntil: 'networkidle0' })
      const layout = await page.evaluate(() => {
        const photo = document.querySelector('.bd-origin-photo')?.getBoundingClientRect()
        const copy = document.querySelector('.bd-origin-copy')?.getBoundingClientRect()
        const header = document.querySelector('.public-header')?.getBoundingClientRect()
        return {
          copyTop: copy.top,
          copyBottom: copy.bottom,
          photoTop: photo.top,
          photoBottom: photo.bottom,
          headerBottom: header.bottom,
          copyTopRatio: (copy.top - photo.top) / photo.height,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })

      assert.ok(layout.copyTop >= layout.photoTop, `story starts above photo at ${viewport.width}px`)
      assert.ok(layout.copyTop >= layout.headerBottom + 8, `story is hidden behind header at ${viewport.width}px`)
      assert.ok(
        layout.copyTopRatio <= viewport.maxCopyTopRatio,
        `story starts too low at ${viewport.width}px: ${layout.copyTopRatio}`,
      )
      assert.ok(layout.copyBottom <= layout.photoBottom + 1, `story ends below photo at ${viewport.width}px`)
      assert.equal(layout.horizontalOverflow, false, `story causes horizontal overflow at ${viewport.width}px`)
    }

    await page.setViewport({ width: 1440, height: 900 })
  })

  it('renders Wash & Detailing as a page with a looping service rail and only matching Google reviews', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/services/wash-detailing`, { waitUntil: 'networkidle0' })
    const result = await page.evaluate(() => ({
      heading: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(),
      rail: document.querySelector('[data-wash-service-rail]')?.getAttribute('data-looping'),
      services: [...document.querySelectorAll('[data-wash-service-card] h2, [data-wash-service-card] h3')]
        .map((item) => item.textContent.trim()),
      reviews: [...document.querySelectorAll('[data-service-review]')].map((item) => item.textContent),
      dialog: Boolean(document.querySelector('[data-wash-modal]')),
      actions: [...document.querySelectorAll('[data-wash-service-card] a')].map((link) => new URL(link.href).pathname),
      /* Scoped past the site header: its Book now button belongs to every
         page and still books the services that are bookable. What this
         page must not carry is a booking CTA of its own, because wash and
         detailing are walk-in and the queue is the call to action. */
      bookLinks: [...document.querySelectorAll('a')]
        .filter((link) => !link.closest('header, .public-header'))
        .filter((link) => new URL(link.href).pathname === '/book').length,
      headerBookLinks: [...document.querySelectorAll('header a, .public-header a')]
        .filter((link) => new URL(link.href).pathname === '/book').length,
      galleryPages: document.querySelectorAll('[data-wash-gallery-page]').length,
      galleryPhotos: [...document.querySelectorAll('[data-wash-gallery-page] img')]
        .map((image) => new URL(image.src).pathname.split('/').at(-1)),
      galleryUsesHomeRail: Boolean(document.querySelector('.bd-wash-gallery .bd-gallery-rail')),
      mobileComingSoon: document.querySelector('[data-wash-service-card][data-package="mobile-detailing"] .bd-wash-unavailable')?.textContent.trim(),
    }))

    assert.match(result.heading, /Premium Wash & Detailing/i)
    assert.equal(result.rail, 'true')
    assert.deepEqual(result.services.slice(0, 10), [
      'Premium Car Wash',
      'Glass Coating',
      'Glass Detailing',
      'Interior Detailing',
      'Interior Deep Cleaning',
      'Bactozero',
      'Black Trims Restoration',
      'Headlight Restoration',
      'Engine Wash',
      'Mobile Detailing',
    ])
    assert.equal(result.dialog, false)
    assert.ok(result.actions.length > 0)
    assert.ok(result.actions.every((path) => path === '/queue'))
    assert.equal(result.bookLinks, 0)
    assert.equal(result.headerBookLinks, 1)
    assert.ok(result.reviews.some((review) => /Paul Russel Sandoval/.test(review)))
    assert.ok(result.reviews.every((review) => /wash|clean|buffing/i.test(review)))
    assert.ok(result.reviews.every((review) => !/ceramic coating/i.test(review)))
    assert.equal(result.galleryPages, 2)
    assert.equal(new Set(result.galleryPhotos).size, 8)
    assert.equal(result.galleryUsesHomeRail, true)
    assert.equal(result.mobileComingSoon, 'Coming soon')
  })

  it('labels tint benefits and pulses both ceramic warranty messages', async () => {
    await page.goto(`${PREVIEW_ORIGIN}/services/tint`, { waitUntil: 'networkidle0' })
    assert.match(await page.$eval('.bd-benefits-heading', (item) => item.textContent), /Benefits of Nano Ceramic Tint/i)

    await page.goto(`${PREVIEW_ORIGIN}/services/ceramic`, { waitUntil: 'networkidle0' })
    const cards = await page.$$eval('.ceramic-package-panel', (items) => items.map((item) => ({
      warranty: item.querySelector('.ceramic-package-warranty')?.classList.contains('is-pulsing'),
      unli: item.querySelector('.ceramic-package-unlimited')?.classList.contains('is-pulsing'),
    })))
    assert.deepEqual(cards, [{ warranty: true, unli: true }, { warranty: true, unli: true }])
  })
})
