import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import puppeteer from 'puppeteer'

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/home'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

describe('BreDESIGN homepage fallback sections', () => {
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

  it('shows membership rewards and points in the customer app preview', async () => {
    const appCopy = await page.$eval('#app-preview', (section) => section.textContent.replace(/\s+/g, ' ').trim())
    assert.match(appCopy, /Membership rewards/i)
    assert.match(appCopy, /points/i)
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
})
