import assert from 'node:assert/strict'
import { test } from 'node:test'
import { launchPuppeteer } from './puppeteerLaunch.js'
const origin = process.env.PUBLIC_TEST_URL || 'http://127.0.0.1:5173'

for (const [width, height, scenes] of [
  [1440, 1000, [[1, true], [7, false], [14, true], [15, true], [0.1, true]]],
  [393, 852, [[1, false], [6, false], [8.6, true], [10, true], [0.1, false]]],
]) {
  test(`hero clears all copy and buttons from logo frames at ${width}px`, async () => {
    const browser = await launchPuppeteer()
    try {
      const page = await browser.newPage()
      await page.setViewport({ width, height })
      await page.goto(origin, { waitUntil: 'networkidle2' })
      const cookie = await page.$('.cookie-consent-secondary')
      if (cookie) await cookie.click()
      await page.waitForFunction(() => document.querySelector('.bd-hero-video')?.readyState >= 2)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      for (const [time, hidden] of scenes) {
        await page.evaluate(async time => {
          const video = document.querySelector('.bd-hero-video')
          video.pause()
          await new Promise(resolve => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = time })
          video.dispatchEvent(new Event('timeupdate'))
          video.dispatchEvent(new Event('playing'))
        }, time)
        await new Promise(resolve => setTimeout(resolve, 450))
        const state = await page.$eval('.bd-hero', hero => ({
          headlineOpacity: Number(getComputedStyle(hero.querySelector('h1')).opacity),
          paragraphOpacity: Number(getComputedStyle(hero.querySelector('.bd-hero-lede')).opacity),
          buttons: [...hero.querySelectorAll('.bd-hero-cta a')].map(a => ({ opacity: Number(getComputedStyle(a.parentElement).opacity), visibility: getComputedStyle(a.parentElement).visibility, visible: a.getBoundingClientRect().height > 0, bottom: a.getBoundingClientRect().bottom, href: a.getAttribute('href') })),
          overflow: document.documentElement.scrollWidth > innerWidth,
        }))
        assert.equal(state.headlineOpacity, hidden ? 0 : 1, `headline at ${time}s`)
        assert.equal(state.paragraphOpacity, hidden ? 0 : 1, `paragraph at ${time}s`)
        assert.ok(state.buttons.every(b => b.opacity === (hidden ? 0 : 1)), `buttons fade with copy at ${time}s`)
        assert.ok(state.buttons.every(b => b.visibility === (hidden ? 'hidden' : 'visible')), `hidden buttons cannot receive clicks at ${time}s`)
        if (!hidden) assert.ok(state.buttons.every(b => b.visible && b.bottom <= height), `buttons are available during footage at ${time}s`)
        assert.deepEqual(state.buttons.map(b => b.href), ['/services', '#origin'])
        assert.equal(state.overflow, false)
        const canFocus = await page.$eval('.bd-hero-cta a', link => { link.focus(); return document.activeElement === link })
        assert.equal(canFocus, !hidden, `only visible actions can receive keyboard focus at ${time}s`)
        if (time === 1 || time === 7 || time === 10) await page.screenshot({ path: `/tmp/hakum-hero-a-${width}-${time}.png` })
      }
      assert.deepEqual(errors, [])
    } finally { await browser.close() }
  })
}
