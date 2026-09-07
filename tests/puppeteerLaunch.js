import puppeteer from 'puppeteer'

/** Prefer env Chrome, else Puppeteer's bundled Chromium (cross-platform). */
export function puppeteerLaunchOptions(extra = {}) {
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  return {
    headless: true,
    args: ['--no-sandbox'],
    ...(executablePath ? { executablePath } : {}),
    ...extra,
  }
}

export async function launchPuppeteer(extra = {}) {
  return puppeteer.launch(puppeteerLaunchOptions(extra))
}

/**
 * Browser tests assert the motionful layout. Host OS "reduce motion" would
 * zero marquees and collapse the PPF pin hero — emulate no-preference.
 */
export async function prepareBrowserPage(page, viewport) {
  if (viewport) await page.setViewport(viewport)
  const client = await page.createCDPSession()
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  })
  return page
}

export async function newPreparedPage(browser, viewport) {
  const page = await browser.newPage()
  return prepareBrowserPage(page, viewport)
}
