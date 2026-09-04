import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import puppeteer from 'puppeteer'

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/home'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const hoverVisibleBrand = async (page) => {
  const marqueePoint = await page.$eval('.bd-marquee', (marquee) => {
    const rect = marquee.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  await page.mouse.move(marqueePoint.x, marqueePoint.y)

  const point = await page.$$eval('.bd-brand', (brands) => {
    const brand = brands.find((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight
    })
    const rect = brand.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  await page.mouse.move(point.x, point.y)
}

describe('BreDESIGN brand logo marquee', () => {
  let browser
  let page

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    })
    page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
  })

  beforeEach(async () => {
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.bd-marquee-track')
  })

  after(async () => {
    await browser?.close()
  })

  it('presents brand logos as a borderless navy rail that brightens on hover', async () => {
    const resting = await page.$eval('.bd-brand', (brand) => {
      const tile = getComputedStyle(brand)
      const logo = getComputedStyle(brand.querySelector('img'))
      const marquee = getComputedStyle(brand.closest('.bd-marquee'))
      const section = getComputedStyle(brand.closest('.bd-products'))
      return {
        borderTopWidth: tile.borderTopWidth,
        backgroundColor: tile.backgroundColor,
        filter: logo.filter,
        marqueeBackground: marquee.backgroundColor,
        sectionBackground: section.backgroundColor,
      }
    })

    assert.equal(resting.borderTopWidth, '0px')
    assert.equal(resting.backgroundColor, 'rgba(0, 0, 0, 0)')
    assert.equal(resting.marqueeBackground, resting.sectionBackground)
    assert.equal(await page.$('.bd-brand-note'), null)
    assert.match(resting.filter, /grayscale\(1\)/)

    await page.$eval('.bd-marquee', (marquee) => marquee.scrollIntoView({ block: 'center' }))
    await hoverVisibleBrand(page)
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.bd-brand:hover img')).opacity === '1',
      { timeout: 2000 },
    )

    const hovered = await page.$eval('.bd-brand:hover img', (logo) => ({
      filter: getComputedStyle(logo).filter,
      opacity: getComputedStyle(logo).opacity,
    }))
    assert.match(hovered.filter, /drop-shadow/)
    assert.equal(hovered.opacity, '1')
    await page.mouse.move(0, 0)
  })

  it('pauses the rail while a visitor hovers a supplier mark', async () => {
    await page.$eval('.bd-marquee', (marquee) => marquee.scrollIntoView({ block: 'center' }))
    const trackX = () => page.$eval('.bd-marquee-track', (track) => (
      new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
    ))
    await page.mouse.move(0, 0)
    const movingStart = await trackX()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const movingEnd = await trackX()
    assert.ok(Math.abs(movingEnd - movingStart) > 3, 'expected the unhovered rail to drift')

    await page.hover('.bd-marquee')
    const start = await trackX()
    await new Promise((resolve) => setTimeout(resolve, 180))
    const end = await trackX()

    assert.ok(Math.abs(end - start) < 1, `expected hover pause, moved ${Math.abs(end - start)}px`)
    await page.mouse.move(0, 0)
  })

  it('temporarily moves faster after the visitor scrolls', async () => {
    const trackX = () => page.$eval('.bd-marquee-track', (track) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform)
      return matrix.m41
    })
    const distanceOver = async (milliseconds) => {
      const start = await trackX()
      await new Promise((resolve) => setTimeout(resolve, milliseconds))
      const end = await trackX()
      return Math.abs(end - start)
    }

    const restingDistance = await distanceOver(180)
    await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'instant' }))
    const boostedDistance = await distanceOver(180)

    assert.ok(
      boostedDistance > restingDistance * 2,
      `expected scroll boost above ${restingDistance * 2}px, received ${boostedDistance}px`,
    )
  })
})
