/* global document, window, location */
/**
 * Read-only full-page screenshots of the money dashboards at 375 / 768 / 1440 (real logins, real data).
 * Fails on: blocked write, page error, Supabase 5xx, horizontal overflow, loading dots still showing.
 *   BASE_URL=http://localhost:4173 node scripts/_ops-pages-shots.mjs
 *   SHOTS_ONLY=boss node scripts/_ops-pages-shots.mjs
 * Evidence: e2e-evidence/ops-pages/
 */
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../src/lib/cookieConsent.js'
import { DISMISS_KEY as INSTALL_DISMISS_KEY } from '../src/lib/installApp.js'

const base = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e-evidence', 'ops-pages')
mkdirSync(outDir, { recursive: true })

const PAGES = {
  boss: [
    ['floor-board', '/operations/dashboard'],
    ['finance-home', '/operations/finance'],
    ['finance-sheets', '/operations/finance?tab=sheets&status=all'],
    ['finance-sales', '/operations/finance?tab=sales'],
    ['finance-bills', '/operations/finance?tab=bills'],
    ['finance-pl', '/operations/finance?tab=pl'],
    ['finance-reports', '/operations/finance?tab=reports'],
  ],
  asa: [['floor-board', '/operations/dashboard']],
  admin: [
    ['queue-view', '/operations/dashboard'],
    ['pos-today', '/operations/pos?tab=dashboard'],
    ['pos-sheet', '/operations/pos?tab=sheet'],
  ],
  crew1: [['attendance', '/operations/attendance']],
}
const VIEWPORTS = [375, 768, 1440]
const only = process.env.SHOTS_ONLY ? new Set(process.env.SHOTS_ONLY.split(',')) : null

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

function isWrite(req) {
  const u = req.url()
  const m = req.method()
  if (/\/api\/notify/.test(u)) return true
  if (/\/storage\/v1\/object\//.test(u) && m !== 'GET' && !/\/object\/sign\//.test(u)) return true
  if (/\/rest\/v1\/rpc\/(save|submit|review|reopen)_daily_sheet|\/rest\/v1\/rpc\/complete_pos_sale/.test(u)) return true
  return /\/rest\/v1\/(?!rpc\/)/.test(u) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(m)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 })
try {
  for (const [id, pages] of Object.entries(PAGES)) {
    if (only && !only.has(id)) continue
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.setDefaultNavigationTimeout(90000)
    const problems = []
    page.on('pageerror', (e) => problems.push(`pageerror ${e.message.slice(0, 120)}`))
    page.on('response', (r) => {
      if (/supabase\.co\//.test(r.url()) && r.status() >= 500) problems.push(`${r.status()} ${r.url().slice(-80)}`)
    })
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (isWrite(req)) {
        problems.push(`write ${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)}`)
        return req.abort()
      }
      return req.continue()
    })
    await page.setViewport({ width: 1440, height: 900 })
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v, ik) => {
      localStorage.setItem(k, v)
      localStorage.setItem(ik, String(Date.now()))
    }, COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, choice: 'necessary', at: new Date().toISOString() }), INSTALL_DISMISS_KEY)
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', acct.email)
    await page.type('input[type="password"]', acct.password)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })

    for (const [name, url] of pages) {
      for (const width of VIEWPORTS) {
        problems.length = 0
        await page.setViewport({ width, height: width < 768 ? 812 : 900 })
        const started = Date.now()
        await page.goto(`${base}${url}`, { waitUntil: 'networkidle2' }).catch(() => null)
        const stillLoading = () => /•••|…|Loading/.test(document.querySelector('main')?.innerText || document.body.innerText)
        await page.waitForFunction(`!(${stillLoading})()`, { timeout: 30000 }).catch(() => null)
        const readyMs = Date.now() - started
        await new Promise((r) => setTimeout(r, 800))
        const state = await page.evaluate((src) => ({
          url: location.pathname + location.search,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          loading: new Function(`return (${src})()`)(),
          denied: /access-denied/.test(location.pathname),
        }), String(stillLoading))
        await page.screenshot({ path: join(outDir, `${id}-${name}-${width}.png`), fullPage: true })
        const issues = [...problems]
        if (state.overflow > 2) issues.push(`overflow ${state.overflow}px`)
        if (state.loading) issues.push('still loading')
        if (state.denied) issues.push('access denied')
        check(`${id} ${name} @${width}`, !issues.length, [`ready ${readyMs}ms`, ...issues].join(' | '))
      }
    }
    await ctx.close()
  }
} catch (err) {
  check('shots finished', false, err.stack?.split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close().catch(() => null)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`)
process.exit(failed.length ? 1 : 0)
