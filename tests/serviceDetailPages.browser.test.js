import test from 'node:test'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

const count = (page, selector) => page.$$eval(selector, (nodes) => nodes.length)

async function withPage(path, run, viewport = { width: 1280, height: 900, deviceScaleFactor: 1 }) {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport(viewport)
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('main')
    await run(page)
  } finally {
    await browser.close()
  }
}

test('Mobile PPF hero keeps dark viewport chrome and strengthens only its two title lines', async () => {
  await withPage('/services/ppf', async (page) => {
    const result = await page.evaluate(() => {
      const hero = document.querySelector('.ppf-information-stage')
      const eyebrow = document.querySelector('.ppf-information-heading > p')
      const headline = document.querySelector('.ppf-information-heading > h2')
      const supportingCopy = document.querySelector('.ppf-information-heading > span')

      return {
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        heroWidth: hero.getBoundingClientRect().width,
        viewportWidth: document.documentElement.clientWidth,
        eyebrowShadow: getComputedStyle(eyebrow).textShadow,
        headlineShadow: getComputedStyle(headline).textShadow,
        supportingCopyShadow: getComputedStyle(supportingCopy).textShadow,
      }
    })

    assert.match(result.colorScheme, /dark/)
    assert.equal(result.heroWidth, result.viewportWidth)
    assert.notEqual(result.eyebrowShadow, 'none')
    assert.notEqual(result.headlineShadow, 'none')
    assert.equal(result.supportingCopyShadow, 'none')
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
    assert.equal(await count(page, '[data-service-proof="ppf"] video'), 6)
    assert.equal(await count(page, '[data-service-proof="ppf"] video[preload="metadata"][poster]'), 6)
    assert.equal(await count(page, '[data-service-proof="ppf"] video source[type*="av01"]'), 6)
    assert.equal(await count(page, '[data-service-proof="ppf"] video source[type="video/mp4"]'), 6)
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
    assert.equal(await count(page, '[data-service-proof="ceramic"] video'), 6)
    assert.ok(await count(page, '[data-service-faq="ceramic"] button') >= 5)
    assert.equal(await count(page, '[data-service-bottom-cta="ceramic"] a[href="/book"]'), 1)
  })
})

test('Tint page contains three tint proof videos, focused FAQs, and no protection packages', async () => {
  await withPage('/services/tint', async (page) => {
    assert.ok(await count(page, '[data-service-faq="tint"] button') >= 5)
    assert.equal(await count(page, '[data-service-packages]'), 0)
    assert.equal(await count(page, '[data-service-proof="tint"] video'), 3)
    assert.equal(await count(page, '[data-service-bottom-cta="tint"] a[href="/book"]'), 1)
  })
})

test('Starting a service proof video pauses the previously playing clip', async () => {
  await withPage('/services/ppf', async (page) => {
    await page.$$eval('[data-service-proof="ppf"] video', async ([first, second]) => {
      first.muted = true
      second.muted = true
      await first.play()
      await second.play()
    })

    const playback = await page.$$eval('[data-service-proof="ppf"] video', ([first, second]) => ({
      firstPaused: first.paused,
      secondPaused: second.paused,
    }))

    assert.deepEqual(playback, { firstPaused: true, secondPaused: false })
  })
})
