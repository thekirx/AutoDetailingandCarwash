import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { launchPuppeteer, newPreparedPage } from './puppeteerLaunch.js'

const ORIGIN = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:4173'

describe('public community and contact navigation', () => {
  let browser
  let page

  before(async () => {
    browser = await launchPuppeteer()
    page = await newPreparedPage(browser, { width: 1440, height: 900 })
  })

  after(async () => browser?.close())

  it('combines the event and blog listings behind one navigation link', async () => {
    await page.goto(`${ORIGIN}/events`, { waitUntil: 'networkidle0' })
    const content = await page.evaluate(() => ({
      nav: [...document.querySelectorAll('nav[aria-label="Primary navigation"] a')].map((link) => link.textContent.trim()),
      auth: [...document.querySelectorAll('.header-actions a')].map((link) => link.textContent.trim()),
      title: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(),
      events: document.querySelector('#events-list h2')?.textContent.trim(),
      blog: document.querySelector('#blog h2')?.textContent.trim(),
      rawError: [...document.querySelectorAll('[role="alert"]')].some((item) => /TypeError|Failed to fetch/i.test(item.textContent)),
    }))
    assert.deepEqual(content.nav, ['Home', 'Services', 'Branch', 'Live Queue', 'Events & Blogs'])
    assert.deepEqual(content.auth, ['Sign in', 'Sign up'])
    assert.ok(!content.nav.includes('Brand Collabs'))
    assert.ok(!content.nav.includes('Contact'))
    assert.match(content.title, /Events\s*&\s*blog/i)
    assert.match(content.events, /Events & meets/i)
    assert.match(content.blog, /Latest stories/i)
    assert.equal(content.rawError, false)
  })

  it('uses the same order in the phone menu without a Book now link', async () => {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${ORIGIN}/home`, { waitUntil: 'networkidle0' })
    await page.click('button[aria-label="Open menu"]')
    const links = await page.$$eval('#mobile-navigation a', (items) => items.map((item) => item.textContent.trim()))
    assert.deepEqual(links, ['Home', 'Services', 'Branch', 'Live Queue', 'Events & Blogs', 'Sign in', 'Sign up'])
    await page.setViewport({ width: 1440, height: 900 })
  })

  it('keeps old Blog links pointed at the blog section', async () => {
    await page.goto(`${ORIGIN}/blog`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => location.pathname === '/events' && location.hash === '#blog')
    await page.waitForFunction(() => {
      const top = document.querySelector('#blog')?.getBoundingClientRect().top
      return top !== undefined && top >= 0 && top < 130
    })
    assert.match(await page.$eval('#blog h2', (node) => node.textContent), /Latest stories/i)
  })

  it('offers Brand Collabs from Contact on desktop and phone', async () => {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${ORIGIN}/contact`, { waitUntil: 'networkidle0' })
      const result = await page.evaluate(() => ({
        href: document.querySelector('.contact-collab a')?.getAttribute('href'),
        heading: document.querySelector('.contact-collab h2')?.textContent.trim(),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }))
      assert.equal(result.href, '/partnerships')
      assert.match(result.heading, /Brand collaborations/i)
      assert.equal(result.overflow, false, `horizontal overflow at ${width}px`)
    }
  })
})
