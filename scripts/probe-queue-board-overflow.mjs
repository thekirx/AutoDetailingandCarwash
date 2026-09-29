/**
 * Queue board overflow probe — no horizontal scroll at key viewports.
 * Usage: BASE_URL=http://127.0.0.1:5173 node scripts/probe-queue-board-overflow.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
const outDir = join(root, 'e2e-evidence', 'queue-board-responsive')
mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { id: 'mobile-375', width: 375, height: 667 },
  { id: 'mobile-landscape', width: 667, height: 375 },
  { id: 'tablet-768', width: 768, height: 1024 },
  { id: 'laptop-1280', width: 1280, height: 800 },
  { id: 'desktop-1440', width: 1440, height: 900 },
]

const admin = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'boss') || OPS_DEMO_ACCOUNTS[0]

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
const results = []

try {
  await page.goto(`${base}/operations/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  const cookieBtn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookieBtn) await cookieBtn.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"], input[name="password"]')
  if (!emailSel || !passSel) throw new Error('login fields missing')
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(admin.email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(admin.password, { delay: 5 })
  await Promise.all([
    page.click('button[type="submit"]'),
    page
      .waitForFunction(
        () => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'),
        { timeout: 60000 },
      )
      .catch(() => null),
  ])
  if (!page.url().includes('/operations') || page.url().includes('/login')) {
    throw new Error(`login failed: ${page.url()}`)
  }
  await page.goto(`${base}/operations/queue`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.queue-lane-board-fit', { timeout: 30000 })

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
    await new Promise((r) => setTimeout(r, 400))
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const board = document.querySelector('.queue-lane-board-fit')
      const chips = document.querySelector('.floor-status-chips')
      const boardRect = board?.getBoundingClientRect()
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflowX: doc.scrollWidth - doc.clientWidth,
        boardScrollWidth: board?.scrollWidth || 0,
        boardClientWidth: board?.clientWidth || 0,
        boardOverflow: board ? board.scrollWidth - board.clientWidth : null,
        boardHeight: boardRect?.height || 0,
        hasChips: Boolean(chips),
        laneCount: document.querySelectorAll('.queue-lane-board-fit .floor-lane').length,
      }
    })
    const shot = join(outDir, `${vp.id}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    const issues = []
    if (metrics.overflowX > 2) issues.push(`page-h-overflow:${metrics.overflowX}`)
    if (metrics.boardOverflow != null && metrics.boardOverflow > 2) issues.push(`board-h-overflow:${metrics.boardOverflow}`)
    if (metrics.hasChips) issues.push('status-chips-still-present')
    const verdict = issues.length ? 'FAIL' : 'PASS'
    results.push({ viewport: vp.id, ...metrics, issues, verdict, shot: `${vp.id}.png` })
    console.log(`${vp.id}: ${verdict} overflowX=${metrics.overflowX} boardOverflow=${metrics.boardOverflow} lanes=${metrics.laneCount}`)
  }
} finally {
  await browser.close()
}

const fails = results.filter((r) => r.verdict === 'FAIL')
const report = [
  '# Queue board responsive probe',
  '',
  `**Date:** ${new Date().toISOString()}`,
  `**Base:** ${base}`,
  `**Overall:** ${fails.length ? 'FAIL' : 'PASS'}`,
  '',
  '| Viewport | Page Δx | Board Δx | Lanes | Chips | Verdict |',
  '|----------|---------|----------|-------|-------|---------|',
  ...results.map(
    (r) =>
      `| ${r.viewport} | ${r.overflowX} | ${r.boardOverflow} | ${r.laneCount} | ${r.hasChips ? 'yes' : 'no'} | ${r.verdict} |`,
  ),
  '',
]
writeFileSync(join(outDir, 'report.md'), report.join('\n'))
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ fails: fails.length, results }, null, 2))
console.log(`\nOverall: ${fails.length ? 'FAIL' : 'PASS'} (${fails.length} fails)`)
process.exit(fails.length ? 1 : 0)
