import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import puppeteer from 'puppeteer'

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/home'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

describe('BreDESIGN hero video fallback', () => {
  let browser
  let page

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    })
    page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value() {
          this.pause()
          return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'))
        },
      })
    })
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle0' })
  })

  after(async () => {
    await browser?.close()
  })

  it('covers a browser-blocked video with the clean hero poster', async () => {
    const state = await page.$eval('#top', (hero) => {
      const video = hero.querySelector('video')
      const poster = hero.querySelector('.bd-hero-poster')
      return {
        paused: video?.paused,
        controls: video?.controls,
        posterVisible: poster ? Number.parseFloat(getComputedStyle(poster).opacity) === 1 : false,
        posterAboveVideo: poster && video ? poster.compareDocumentPosition(video) === Node.DOCUMENT_POSITION_PRECEDING : false,
      }
    })

    assert.equal(state.paused, true)
    assert.equal(state.controls, false)
    assert.equal(state.posterVisible, true)
    assert.equal(state.posterAboveVideo, true)
  })
})
