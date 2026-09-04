import test from 'node:test'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

const count = (page, selector) => page.$$eval(selector, (nodes) => nodes.length)

async function withPage(path, run) {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('main')
    await run(page)
  } finally {
    await browser.close()
  }
}

test('PPF page contains ClearPro, packages, proof, focused FAQs, and bottom booking', async () => {
  await withPage('/services/ppf', async (page) => {
    const firstSection = await page.$eval('main > section', (node) => node.id)

    assert.equal(firstSection, 'ppf-information')
    assert.equal(await count(page, 'main > #ppf-information .ppf-sequence canvas'), 1)
    assert.equal(await count(page, 'main > .bd-page-hero'), 0)
    assert.equal(await count(page, '[data-service-brand="clearpro"]'), 1)
    assert.equal(await count(page, '[data-service-packages="ppf"]'), 1)
    assert.equal(await count(page, '[data-service-proof="ppf"] video'), 1)
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
    assert.equal(await count(page, '[data-service-proof="ceramic"] video'), 1)
    assert.ok(await count(page, '[data-service-faq="ceramic"] button') >= 5)
    assert.equal(await count(page, '[data-service-bottom-cta="ceramic"] a[href="/book"]'), 1)
  })
})

test('Tint page contains only tint FAQs and no protection packages or proof video', async () => {
  await withPage('/services/tint', async (page) => {
    assert.ok(await count(page, '[data-service-faq="tint"] button') >= 5)
    assert.equal(await count(page, '[data-service-packages]'), 0)
    assert.equal(await count(page, '[data-service-proof]'), 0)
    assert.equal(await count(page, '[data-service-bottom-cta="tint"] a[href="/book"]'), 1)
  })
})
