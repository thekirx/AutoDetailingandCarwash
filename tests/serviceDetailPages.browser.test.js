import test from 'node:test'
import assert from 'node:assert/strict'
import { launchPuppeteer, prepareBrowserPage } from './puppeteerLaunch.js'

const BASE_URL = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

const count = (page, selector) => page.$$eval(selector, (nodes) => nodes.length)

async function withPage(path, run, viewport = { width: 1280, height: 900, deviceScaleFactor: 1 }) {
  const browser = await launchPuppeteer()
  try {
    const page = await browser.newPage()
    await prepareBrowserPage(page, viewport)
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('main')
    await run(page)
  } finally {
    await browser.close()
  }
}

test('Mobile PPF hero centers its intro and matches the animated chapter typography', async () => {
  await withPage('/services/ppf', async (page) => {
    const result = await page.evaluate(() => {
      const hero = document.querySelector('.ppf-information-stage')
      const eyebrow = document.querySelector('.ppf-information-heading > p')
      const headline = document.querySelector('.ppf-information-heading > h2')
      const supportingCopy = document.querySelector('.ppf-information-heading > span')
      const chapterHeadline = document.querySelector('.ppf-information-chapter h3')
      const eyebrowStyle = getComputedStyle(eyebrow)
      const headlineStyle = getComputedStyle(headline)
      const chapterStyle = getComputedStyle(chapterHeadline)
      const eyebrowBox = eyebrow.getBoundingClientRect()
      const copyBox = supportingCopy.getBoundingClientRect()

      return {
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        heroWidth: hero.getBoundingClientRect().width,
        viewportWidth: document.documentElement.clientWidth,
        eyebrowShadow: eyebrowStyle.textShadow,
        headlineShadow: headlineStyle.textShadow,
        supportingCopyShadow: getComputedStyle(supportingCopy).textShadow,
        introCenter: (eyebrowBox.top + copyBox.bottom) / 2,
        viewportCenter: window.innerHeight / 2,
        eyebrowFont: [eyebrowStyle.fontFamily, eyebrowStyle.fontWeight, eyebrowStyle.fontStyle],
        headlineFont: [headlineStyle.fontFamily, headlineStyle.fontWeight, headlineStyle.fontStyle],
        chapterFont: [chapterStyle.fontFamily, chapterStyle.fontWeight, chapterStyle.fontStyle],
      }
    })

    assert.match(result.colorScheme, /dark/)
    assert.equal(result.heroWidth, result.viewportWidth)
    assert.notEqual(result.eyebrowShadow, 'none')
    assert.notEqual(result.headlineShadow, 'none')
    assert.equal(result.supportingCopyShadow, 'none')
    assert.ok(Math.abs(result.introCenter - result.viewportCenter) < 60)
    assert.deepEqual(result.eyebrowFont, result.chapterFont)
    assert.deepEqual(result.headlineFont, result.chapterFont)
  }, { width: 393, height: 852, deviceScaleFactor: 2 })
})

test('PPF page contains ClearPro, packages, proof, focused FAQs, and bottom booking', async () => {
  await withPage('/services/ppf', async (page) => {
    const firstSection = await page.$eval('main > section', (node) => node.id)

    assert.equal(firstSection, 'ppf-information')
    assert.equal(await count(page, 'main > #ppf-information .ppf-sequence canvas'), 1)
    assert.equal(await count(page, 'main > .bd-page-hero'), 0)
    assert.equal(await count(page, '[data-service-brand="clearpro"]'), 1)
    assert.equal(await count(page, '[data-service-packages="ppf"]'), 1)
    assert.equal(await count(page, '[data-service-packages="ppf"] [data-package]'), 4)
    /* Proof clips are a rail of posters; nothing loads until one is opened. */
    assert.equal(await count(page, '[data-service-proof="ppf"] [data-proof-clip]'), 12)
    assert.equal(await count(page, '[data-service-proof="ppf"] [data-proof-clip] img[src]'), 12)
    assert.equal(await count(page, '[data-service-proof="ppf"] video'), 0)
    assert.equal(await count(page, '[data-service-packages="ppf"] video'), 0)
    assert.ok(await count(page, '[data-service-faq="ppf"] button') >= 5)
    assert.equal(await count(page, '[data-service-bottom-cta="ppf"] a[href="/book"]'), 1)

    const firstQuestion = await page.$('[data-service-faq="ppf"] button')
    await firstQuestion.click()
    assert.equal(await firstQuestion.evaluate((node) => node.getAttribute('aria-expanded')), 'true')
  })
})

test('Ceramic page contains both packages, Unlimited Recoating, proof, FAQs, and booking', async () => {
  await withPage('/services/ceramic', async (page) => {
    assert.equal(await count(page, '[data-service-packages="ceramic"] article'), 2)
    assert.equal(await page.$$eval('*', (nodes) => nodes.filter((node) => node.textContent.trim() === 'Unlimited Recoating').length), 2)
    assert.equal(await count(page, '[data-service-proof="ceramic"] [data-proof-clip]'), 9)
    assert.ok(await count(page, '[data-service-faq="ceramic"] button') >= 5)
    assert.equal(await count(page, '[data-service-bottom-cta="ceramic"] a[href="/book"]'), 1)
  })
})

test('Tint page contains three tint proof videos, focused FAQs, and no protection packages', async () => {
  await withPage('/services/tint', async (page) => {
    assert.ok(await count(page, '[data-service-faq="tint"] button') >= 5)
    assert.equal(await count(page, '[data-service-packages]'), 0)
    assert.equal(await count(page, '[data-service-proof="tint"] [data-proof-clip]'), 3)
    assert.equal(await count(page, '[data-service-bottom-cta="tint"] a[href="/book"]'), 1)
  })
})

test('A proof clip opens in the one shared player, with AV1 and H.264 sources', async () => {
  await withPage('/services/ppf', async (page) => {
    const ids = await page.$$eval('[data-service-proof="ppf"] [data-proof-clip]', (nodes) => nodes.map((node) => node.dataset.proofClip))

    for (const id of ids.slice(0, 2)) {
      await page.click(`[data-proof-clip="${id}"]`)
      await page.waitForSelector('[role="dialog"][data-gallery-player]')
      assert.equal(await count(page, '[data-gallery-player] video'), 1)
      assert.equal(await count(page, '[data-gallery-player] video source[type*="av01"]'), 1)
      assert.equal(await count(page, '[data-gallery-player] video source[type="video/mp4"]'), 1)
      await page.click('[data-gallery-close]')
      await page.waitForSelector('[data-gallery-player]', { hidden: true })
    }
  })
})

test('Every service proof video exposes an audio track to the browser', async () => {
  for (const [service, expectedCount] of [['ppf', 12], ['ceramic', 9], ['tint', 3]]) {
    await withPage(`/services/${service}`, async (page) => {
      const ids = await page.$$eval(`[data-service-proof="${service}"] [data-proof-clip]`, (nodes) => nodes.map((node) => node.dataset.proofClip))
      const tracks = []

      for (const id of ids) {
        await page.$eval(`[data-proof-clip="${id}"]`, (node) => node.click())
        await page.waitForSelector('[data-gallery-player] video')
        tracks.push(await page.$eval('[data-gallery-player] video', (video) => new Promise((resolve, reject) => {
          const read = () => resolve(video.captureStream().getAudioTracks().length)
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            read()
            return
          }
          video.addEventListener('loadedmetadata', read, { once: true })
          video.addEventListener('error', () => reject(video.error || new Error('video metadata failed')), { once: true })
        })))
        await page.click('[data-gallery-close]')
        await page.waitForSelector('[data-gallery-player]', { hidden: true })
      }

      assert.equal(tracks.length, expectedCount)
      assert.deepEqual(tracks, Array(expectedCount).fill(1), `${service} contains a silent proof clip`)
    })
  }
})
