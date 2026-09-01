/**
 * Smoke-check: reopen slim HTML, confirm Mermaid produced SVGs (same gate as PDF).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

const root = fileURLToPath(new URL('../', import.meta.url))
const samples = [
  'docs/user-stories/USER-STORIES-OWNER.html',
  'docs/user-stories/pdf/process-pay.html',
  'docs/user-stories/pdf/charts.html',
  'docs/user-stories/pdf/role-ba.html',
]

const browser = await puppeteer.launch({ headless: true })
try {
  for (const rel of samples) {
    const file = path.join(root, rel)
    const page = await browser.newPage()
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle0', timeout: 120000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.mermaid svg').length >= 1,
      { timeout: 60000 },
    )
    const counts = await page.evaluate(() => ({
      mermaid: document.querySelectorAll('.mermaid').length,
      svg: document.querySelectorAll('.mermaid svg').length,
      stories: document.querySelectorAll('.story').length,
    }))
    console.log(rel, counts)
    await page.close()
  }
} finally {
  await browser.close()
}
console.log('OK — Mermaid SVGs render for PDF samples')
