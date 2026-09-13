import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { launchPuppeteer, newPreparedPage } from './puppeteerLaunch.js'

const PREVIEW_ORIGIN = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'
const PREVIEW_URL = process.env.PREVIEW_URL || new URL('/home', PREVIEW_ORIGIN).href

describe('BreDESIGN homepage fallback sections', () => {
  let browser
  let page

  before(async () => {
    browser = await launchPuppeteer()
    page = await newPreparedPage(browser, { width: 1440, height: 900 })
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0' })
  })

  after(async () => {
    await browser?.close()
  })

  it('keeps Events & Meets and Live Queue visible without live backend rows', async () => {
    const sections = await page.evaluate(() => ({
      events: document.querySelector('#events h2')?.textContent.replace(/\s+/g, ' ').trim(),
      queue: document.querySelector('#branches h2')?.textContent.replace(/\s+/g, ' ').trim(),
      queueSubtext: document.querySelector('#branches .bd-head > p')?.textContent.replace(/\s+/g, ' ').trim(),
      eventImage: document.querySelector('#events img')?.getAttribute('src'),
      branchCards: [...document.querySelectorAll('#branches .bd-branch h3')].map((item) => item.textContent.trim()),
    }))

    assert.equal(sections.events, 'Events & meets.')
    assert.equal(sections.queue, 'Know the queue before you go.')
    assert.match(sections.queueSubtext, /live total/i)
    assert.match(sections.eventImage, /events-stay-tuned\.webp/)
    assert.deepEqual(sections.branchCards, ['Bacoor', 'Batangas', 'Dasmariñas'])
  })

  it('shows the real stamp-card rewards model instead of obsolete membership points', async () => {
    const appCopy = await page.$eval('#app-preview', (section) => section.textContent.replace(/\s+/g, ' ').trim())
    assert.match(appCopy, /Hakum rewards/i)
    assert.match(appCopy, /4 stamps from a free wash/i)
    assert.match(appCopy, /Stamp rewards/i)
    assert.doesNotMatch(appCopy, /points/i)
  })

  it('keeps section spacing compact and exposes the TikTok channel', async () => {
    const result = await page.evaluate(() => ({
      sectionPadding: [...document.querySelectorAll('main > section')].map((section) => ({
        id: section.id,
        top: Number.parseFloat(getComputedStyle(section).paddingTop),
        bottom: Number.parseFloat(getComputedStyle(section).paddingBottom),
      })),
      tiktokHref: document.querySelector('footer a[aria-label="Hakum on TikTok"]')?.href,
    }))

    assert.ok(result.sectionPadding.every(({ top, bottom }) => top <= 72 && bottom <= 72))
    assert.equal(result.tiktokHref, 'https://www.tiktok.com/@hakum_autocare')
  })

  it('presents featured service videos as playable gallery items', async () => {
    const heading = await page.$eval('#photos h2', (node) => node.textContent.replace(/\s+/g, ' ').trim())
    const videoTiles = await page.$$('#photos button[data-gallery-video]')
    const mediaSequence = await page.$$eval('#photos .bd-mosaic > *', (nodes) =>
      nodes.map((node) => node.tagName),
    )
    const galleryLayout = await page.$eval('#photos .bd-mosaic', (grid) => {
      const ppf = grid.querySelector('[data-gallery-video="ppf"]').getBoundingClientRect()
      const ceramic = grid.querySelector('[data-gallery-video="ceramic"]').getBoundingClientRect()
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        ppfHeight: ppf.height,
        ceramicHeight: ceramic.height,
      }
    })

    assert.equal(heading, 'Photos & Videos.')
    assert.equal(videoTiles.length, 3)
    assert.deepEqual(mediaSequence, [
      'FIGURE',
      'FIGURE',
      'BUTTON',
      'BUTTON',
      'FIGURE',
      'FIGURE',
      'FIGURE',
      'BUTTON',
      'FIGURE',
    ])
    assert.equal(galleryLayout.columns, 4)
    assert.ok(galleryLayout.ceramicHeight > galleryLayout.ppfHeight * 1.8)

    await page.click('#photos [data-gallery-video="ppf"]')
    await page.waitForSelector('[role="dialog"][data-gallery-player]')
    assert.equal(await page.$eval('[data-gallery-player] video', (node) => node.getAttribute('aria-label')), 'Hakum full-body PPF installation on a Toyota Fortuner')

    await page.click('[data-gallery-close]')
    await page.waitForSelector('[data-gallery-player]', { hidden: true })
  })

  it('keeps the mixed gallery usable from small phones through large desktops', async () => {
    const viewports = [
      { width: 320, height: 568, columns: 2 },
      { width: 768, height: 1024, columns: 2 },
      { width: 860, height: 720, columns: 4 },
      { width: 1920, height: 1080, columns: 4 },
    ]

    for (const viewport of viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height })

      const layout = await page.$eval('#photos .bd-mosaic', (grid) => ({
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasCollapsedTile: [...grid.children].some((tile) => {
          const rect = tile.getBoundingClientRect()
          return rect.width <= 0 || rect.height <= 0
        }),
      }))

      assert.equal(layout.columns, viewport.columns)
      assert.equal(layout.hasHorizontalOverflow, false)
      assert.equal(layout.hasCollapsedTile, false)
    }

    await page.click('#photos [data-gallery-video="ceramic"]')
    await page.waitForSelector('[data-gallery-player]')

    const modal = await page.$eval('[data-gallery-player] .bd-gallery-player', (player) => {
      const rect = player.getBoundingClientRect()
      return {
        fitsViewport:
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= window.innerWidth &&
          rect.bottom <= window.innerHeight,
        bodyLocked: getComputedStyle(document.body).overflow === 'hidden',
      }
    })

    assert.equal(modal.fitsViewport, true)
    assert.equal(modal.bodyLocked, true)

    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-gallery-player]', { hidden: true })
  })
})
