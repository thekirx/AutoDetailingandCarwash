/**
 * Public shop TV probe — no login. Landscape overflow + lane count.
 * Usage: BASE_URL=http://localhost:5173 node scripts/probe-shop-tv.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

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

const base = process.env.BASE_URL || 'http://localhost:5173'
const slug = process.env.TV_BRANCH || 'bacoor'
const outDir = join(root, 'e2e-evidence', 'shop-tv')
mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { id: 'tv-1920', width: 1920, height: 1080 },
  { id: 'tv-1280', width: 1280, height: 720 },
  { id: 'tv-landscape-phone', width: 844, height: 390 },
]

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
const results = []

try {
  await page.goto(`${base}/queue/${slug}/tv`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.tv-board, .lq-board', { timeout: 30000 })

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
    await new Promise((r) => setTimeout(r, 500))
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const board = document.querySelector('.tv-board')
      const lanes = [...document.querySelectorAll('.tv-lane')]
      return {
        path: location.pathname,
        hasLogin: Boolean(document.querySelector('input[type="password"]')),
        hasCookie: Boolean(document.querySelector('.cookie-consent')),
        hasBoard: Boolean(board),
        title: document.querySelector('.tv-brand')?.textContent || '',
        live: document.querySelector('.tv-live')?.textContent || '',
        clock: document.querySelector('.tv-clock')?.textContent || '',
        density: board?.getAttribute('data-density') || '',
        laneCount: lanes.length,
        laneLabels: lanes.map((el) => el.querySelector('h2')?.textContent || ''),
        laneCounts: lanes.map((el) => el.querySelector('.tv-lane-count')?.textContent || ''),
        plates: [...document.querySelectorAll('.tv-card-plate')].map((el) => el.textContent.trim()),
        services: [...document.querySelectorAll('.tv-card-services li')].map((el) => el.textContent.trim()),
        overflowX: doc.scrollWidth - doc.clientWidth,
        overflowY: doc.scrollHeight - window.innerHeight,
      }
    })
    const shot = `${vp.id}.png`
    await page.screenshot({ path: join(outDir, shot), fullPage: false })
    const issues = []
    if (metrics.hasLogin) issues.push('login-wall')
    if (metrics.hasCookie) issues.push('cookie-banner')
    if (!metrics.hasBoard) issues.push('missing-tv-board')
    if (metrics.laneCount !== 3) issues.push(`lanes:${metrics.laneCount}`)
    if (!/waiting/i.test(metrics.laneLabels.join(' '))) issues.push('missing-waiting')
    if (!/progress/i.test(metrics.laneLabels.join(' '))) issues.push('missing-progress')
    if (!/payment/i.test(metrics.laneLabels.join(' '))) issues.push('missing-payment')
    if (!/live queue/i.test(metrics.live)) issues.push('missing-live')
    if (!metrics.clock) issues.push('missing-clock')
    if (metrics.overflowX > 2) issues.push(`h-overflow:${metrics.overflowX}`)
    const verdict = issues.length ? 'FAIL' : 'PASS'
    results.push({ viewport: vp.id, ...metrics, issues, verdict, shot })
    console.log(`${vp.id}: ${verdict} overflowX=${metrics.overflowX} lanes=${metrics.laneCount} login=${metrics.hasLogin} cookie=${metrics.hasCookie}`)
  }

  await page.goto(`${base}/queue/new-site-preview/tv`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.tv-board, .lq-board', { timeout: 30000 })
  const isolated = await page.evaluate(() => ({
    path: location.pathname,
    hasBoard: Boolean(document.querySelector('.tv-board')),
    hasLogin: Boolean(document.querySelector('input[type="password"]')),
  }))
  const isolatedIssues = []
  if (isolated.hasLogin) isolatedIssues.push('login-wall')
  if (!isolated.hasBoard) isolatedIssues.push('missing-tv-board')
  if (isolated.path !== '/queue/new-site-preview/tv') isolatedIssues.push(`redirected:${isolated.path}`)
  results.push({
    viewport: 'new-branch-slug',
    ...isolated,
    issues: isolatedIssues,
    verdict: isolatedIssues.length ? 'FAIL' : 'PASS',
    shot: null,
  })
  console.log(`new-branch-slug: ${isolatedIssues.length ? 'FAIL' : 'PASS'} path=${isolated.path}`)

  await page.goto(`${base}/queue/${slug}/tv`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.tv-board', { timeout: 30000 })
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  const stress = await page.evaluate(() => {
    const board = document.querySelector('.tv-board')
    const body = document.querySelector('.tv-lane-body')
    const card = document.querySelector('.tv-card')
    if (!board || !body || !card) return { ok: false }
    for (let i = 0; i < 16; i += 1) body.appendChild(card.cloneNode(true))
    board.setAttribute('data-density', '5')
    const plate = document.querySelector('.tv-card-plate')
    const platePx = plate ? Number.parseFloat(getComputedStyle(plate).fontSize) : 0
    return {
      ok: true,
      count: document.querySelectorAll('.tv-card').length,
      platePx,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  await page.screenshot({ path: join(outDir, 'tv-1920-dense.png'), fullPage: false })
  const stressIssues = []
  if (!stress.ok) stressIssues.push('no-card-to-clone')
  if (stress.platePx && stress.platePx < 14) stressIssues.push(`plate-too-small:${stress.platePx}`)
  if (stress.overflowX > 2) stressIssues.push(`dense-h-overflow:${stress.overflowX}`)
  results.push({
    viewport: 'tv-1920-dense',
    ...stress,
    issues: stressIssues,
    verdict: stressIssues.length ? 'FAIL' : 'PASS',
    shot: 'tv-1920-dense.png',
  })
  console.log(`tv-1920-dense: ${stressIssues.length ? 'FAIL' : 'PASS'} cards=${stress.count} platePx=${stress.platePx}`)
} finally {
  await browser.close()
}

const fails = results.filter((r) => r.verdict === 'FAIL')
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ fails: fails.length, results }, null, 2))
console.log(`\nOverall: ${fails.length ? 'FAIL' : 'PASS'}`)
process.exit(fails.length ? 1 : 0)
