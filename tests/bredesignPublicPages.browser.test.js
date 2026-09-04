import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import puppeteer from 'puppeteer'

const PREVIEW_ORIGIN = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4173'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

describe('BreDESIGN public page fallbacks', () => {
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
    assert.equal(result.cards.length, 7)
    assert.ok(result.cards.includes('Paint Protection Film'))
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
})
