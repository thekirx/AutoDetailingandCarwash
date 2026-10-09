import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { launchPuppeteer } from './puppeteerLaunch.js'

const origin = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:5173'
const defaults = JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json', import.meta.url)))
const expected = [
  { id: 'ceramic', codes: ['C70', 'C30', 'C20', 'C08'], shades: ['Clear Bluish', 'Light Black', 'Medium Black', 'Super Black'], specs: [['68%', '31%', '20%', '8%'], ['44%', '57%', '65%', '69%'], ['87%', '82%', '93%', '92%']], warranty: '7 years', prices: ['₱6,000', '₱8,000', '₱10,000'] },
  { id: 'pro', codes: ['HC35 Nano', 'HC25 Nano', 'HC15 Nano', 'HC05 Nano'], shades: ['Fair Black', 'Light Black', 'Medium Black', 'Super Black'], specs: [['35%', '25%', '15%', '5%'], ['58%', '63%', '66%', '71%'], ['92%', '92%', '92%', '94%']], warranty: 'Lifetime', prices: ['₱10,000', '₱12,000', '₱14,000'] },
]

for (const width of [1440, 393, 320]) {
  test(`tint comparison shows all reference data and scrolls at ${width}px`, async () => {
    const browser = await launchPuppeteer()
    try {
      const page = await browser.newPage()
      await page.setViewport({ width, height: 900 })
      const errors = []
      const config = structuredClone(defaults)
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.setRequestInterception(true)
      page.on('request', req => {
        if (req.url().includes('/rest/v1/tint_finder_settings')) {
          return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS' }, body: JSON.stringify({ config }) })
        }
        return req.continue()
      })
      await page.goto(`${origin}/services/tint`, { waitUntil: 'networkidle2' })
      const cookie = await page.$('.cookie-consent-secondary')
      if (cookie) await cookie.click()
      // Must be available before answering any quiz questions.
      assert.ok(await page.$('#tint-comparison'), 'Tint page must offer the full comparison before completing the quiz')
      assert.equal(await page.$$eval('#tint-comparison table', els => els.length), 2)
      assert.ok(await page.$('#tint-comparison #tint-certification'), 'Certification belongs with the comparison tables')
      // Every film carries the seal, so no per-film list; one link to the Foundation's listing.
      assert.equal(await page.$('#tint-certification .cert-films'), null)
      assert.deepEqual(await page.$$eval('#tint-certification a', els => els.map(e => e.href)), ['https://www.skincancer.org/recommended-products/'])
      assert.deepEqual(await page.$$eval('#tint-comparison [data-tint-package] h3', els => els.map(e => e.textContent)), ['Nano Ceramic Tint', 'Nano Ceramic Pro Tint'])
      assert.equal(await page.$eval('#tint-comparison .bd-cmp-toggle', e => e.getAttribute('aria-expanded')), 'true')
      await page.$eval('#tint-certification', el => el.scrollIntoView({ block: 'center' }))
      await page.waitForFunction(() => { const img = document.querySelector('#tint-certification img'); return img.complete && img.naturalWidth > 0 })
      // The certificate comes before the tables.
      assert.equal(await page.evaluate(() => document.querySelector('#tint-certification').getBoundingClientRect().bottom <= document.querySelector('[data-tint-package="ceramic"]').getBoundingClientRect().top), true)
      const certification = await page.$('#tint-certification .cert-card')
      const cardHeight = await certification.evaluate(el => Math.ceil(el.getBoundingClientRect().height))
      await page.setViewport({ width, height: Math.max(900, cardHeight + 220) })
      await page.$eval('#tint-certification', el => el.scrollIntoView({ block: 'start' }))
      await certification.screenshot({ path: `/tmp/hakum-tint-certification-${width}.png` })
      await page.setViewport({ width, height: 900 })

      for (const pkg of expected) {
        const selector = `[data-tint-package="${pkg.id}"]`
        assert.deepEqual(await page.$$eval(`${selector} thead th:not(:first-child) b`, els => els.map(e => e.textContent)), pkg.codes)
        assert.deepEqual(await page.$$eval(`${selector} thead th:not(:first-child) span`, els => els.map(e => e.textContent)), pkg.shades)
        for (const [i, metric] of ['vlt', 'tser', 'irr'].entries()) {
          assert.deepEqual(await page.$$eval(`${selector} [data-tint-metric="${metric}"] td`, els => els.map(e => e.textContent)), pkg.specs[i])
        }
        assert.deepEqual(await page.$$eval(`${selector} [data-tint-metric="uvr"] td`, els => els.map(e => e.textContent)), ['>99%', '>99%', '>99%', '>99%'])
        assert.deepEqual(await page.$$eval(`${selector} [data-tint-metric="warranty"] td`, els => els.map(e => e.textContent)), Array(4).fill(pkg.warranty))
        for (const [i, vehicle] of ['sedan', 'suv', 'van'].entries()) {
          assert.deepEqual(await page.$$eval(`${selector} [data-tint-price="${vehicle}"] td`, els => els.map(e => e.textContent)), Array(4).fill(pkg.prices[i]))
        }
      }
      assert.equal(new URL(page.url()).pathname, '/services/tint')
      assert.match(await page.title(), /Tint/)
      assert.equal(await page.$('vite-error-overlay'), null)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      if (width < 768) {
        const scroll = await page.$eval('[data-tint-package="ceramic"] .bd-cmp', el => {
          const label = el.querySelector('tbody th[scope="row"]')
          const before = label.getBoundingClientRect().left
          el.scrollLeft = el.scrollWidth
          return { scrollLeft: el.scrollLeft, labelShift: label.getBoundingClientRect().left - before }
        })
        assert.ok(scroll.scrollLeft > 0, 'Table must scroll horizontally')
        assert.ok(Math.abs(scroll.labelShift) < 2, 'Row labels must remain visible when scrolling')
        await page.$eval('[data-tint-package="ceramic"] .bd-cmp', el => { el.scrollLeft = 0 })
      }
      await page.$eval('#tint-comparison', el => el.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: `/tmp/hakum-tint-comparison-${width}.png` })
      if (width === 1440) {
        const comparison = await page.$('#tint-comparison')
        await comparison.screenshot({ path: '/tmp/hakum-tint-comparison-full.png' })
      }
      await page.$eval('.tf-choices button', el => el.click())
      await page.waitForFunction(() => !document.querySelector('.tf-actions .bd-btn').disabled)
      await page.$eval('.tf-actions .bd-btn', el => el.click())
      await page.waitForFunction(() => document.querySelector('.tf-progress').getAttribute('aria-valuenow') === '2')
      assert.ok(await page.$('#tint-comparison'), 'Comparison remains available while using the quiz')
      await page.click('#tint-comparison .bd-cmp-toggle')
      assert.equal(await page.$eval('#tint-compare-tables', e => e.hidden), true)
      await page.click('#tint-comparison .bd-cmp-toggle')
      assert.equal(await page.$eval('#tint-compare-tables', e => e.hidden), false)
      if (width === 1440) {
        config.packages.ceramic.prices.sedan = 6500
        config.packages.ceramic.warranty = '8 years'
        config.films.C30.tser = 59
        await page.reload({ waitUntil: 'networkidle2' })
        await page.waitForFunction(() => document.querySelector('[data-tint-package="ceramic"] [data-tint-price="sedan"] td')?.textContent === '₱6,500')
        assert.deepEqual(await page.$$eval('[data-tint-package="ceramic"] [data-tint-metric="warranty"] td', els => els.map(e => e.textContent)), ['8 years', '8 years', '8 years', '8 years'])
        assert.equal(await page.$eval('[data-tint-package="ceramic"] [data-tint-metric="tser"] td:nth-of-type(2)', el => el.textContent), '59%')
      }
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  })
}
