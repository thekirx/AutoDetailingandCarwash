import test from 'node:test'
import assert from 'node:assert/strict'
import { launchPuppeteer, prepareBrowserPage } from './puppeteerLaunch.js'

const BASE_URL = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

async function withPage(path, run, viewport = { width: 1440, height: 960, deviceScaleFactor: 1 }) {
  const browser = await launchPuppeteer()
  try {
    const page = await browser.newPage()
    await prepareBrowserPage(page, viewport)
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('main, .lq-board, .hakum-auth')
    await run(page)
  } finally {
    await browser.close()
  }
}

test('branch queue uses a photographic header that advances through the site photography', async () => {
  await withPage('/queue/bacoor', async (page) => {
    await page.waitForSelector('.lq-board-media-slide.is-active')

    const before = await page.$eval('.lq-board-media-slide.is-active', (node) => node.currentSrc || node.src)
    const slideCount = await page.$$eval('.lq-board-media-slide', (nodes) => nodes.length)
    const brandName = await page.$eval('.lq-brand-copy', (node) =>
      Array.from(node.children, (child) => child.textContent.trim()).join(' '),
    )
    await new Promise((resolve) => setTimeout(resolve, 6500))
    const after = await page.$eval('.lq-board-media-slide.is-active', (node) => node.currentSrc || node.src)

    assert.ok(slideCount >= 8, `expected the queue to reuse the site's photographic library, found ${slideCount}`)
    assert.equal(brandName, 'HAKUM AUTO CARE')
    assert.notEqual(after, before)
  })
})

test('branch queue and sign-in headings use the homepage display treatment', async () => {
  await withPage('/queue/bacoor', async (page) => {
    await page.waitForSelector('.lq-board-title')
    const queueHeading = await page.$eval('.lq-board-title', (node) => {
      const style = getComputedStyle(node)
      return [style.fontFamily, style.fontWeight, style.fontStyle, style.textTransform]
    })
    assert.match(queueHeading[0], /Benzin/)
    assert.deepEqual(queueHeading.slice(1), ['800', 'italic', 'uppercase'])
  })

  await withPage('/signin', async (page) => {
    await page.waitForSelector('.hakum-auth-brand-body h1')
    const headings = await page.$$eval('.hakum-auth-brand-body h1, .hakum-auth-panel h2', (nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node)
        return [style.fontFamily, style.fontWeight, style.fontStyle, style.textTransform]
      }),
    )

    assert.equal(headings.length, 2)
    for (const heading of headings) {
      assert.match(heading[0], /Benzin/)
      assert.deepEqual(heading.slice(1), ['800', 'italic', 'uppercase'])
    }
  })
})
