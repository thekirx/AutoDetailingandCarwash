/* global document, window, location, HTMLInputElement */
/**
 * Read-only browser walk of the September 2026 seed per role. Asserts the numbers on screen equal the database
 * (all-branch net sales, sheet statuses, return note) and screenshots 375 + 1440. Blocks every write.
 *   BASE_URL=http://localhost:4173 node scripts/_september-shots.mjs
 * Evidence: e2e-evidence/september-2026/
 */
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../src/lib/cookieConsent.js'
import { DISMISS_KEY as INSTALL_DISMISS_KEY } from '../src/lib/installApp.js'
import { formatAccounting } from '../src/lib/dailySheet.js'
import { BATANGAS_SEED_STAFF, SEED_PASSWORD, admin, pageAll } from './seed/september2026Db.mjs'

const base = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e-evidence', 'september-2026')
mkdirSync(outDir, { recursive: true })
const SEP = 'period=custom&from=2026-09-01&to=2026-09-30'

const paid = await pageAll(() => admin.from('sales').select('total_minor').eq('status', 'paid').gte('occurred_at', '2026-09-01T00:00:00+08:00').lte('occurred_at', '2026-09-30T23:59:59.999+08:00').order('id'))
const NET = formatAccounting(paid.reduce((t, s) => t + s.total_minor, 0))
console.log('expected September net (all branches):', NET)

const acct = (id) => OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
const ROLES = [
  {
    id: 'boss',
    login: acct('boss'),
    pages: [
      { name: 'floor-board-sep', url: '/operations/dashboard', custom: true, expect: [NET, 'Sales and profit', 'By branch'] },
      { name: 'finance-sheets-sep', url: `/operations/finance?tab=sheets&${SEP}&status=all`, expect: ['Approved', 'Returned', 'Waiting for approval'] },
      { name: 'finance-sales-sep', url: `/operations/finance?tab=sales&${SEP}`, expect: [NET] },
      { name: 'finance-pl-sep', url: `/operations/finance?tab=pl&${SEP}` },
      { name: 'bookings-maintenance', url: '/operations/bookings?tab=maintenance', expect: ['ZZ'] },
    ],
  },
  {
    id: 'asa',
    login: acct('asa'),
    pages: [
      { name: 'floor-board-sep', url: '/operations/dashboard', custom: true, expect: [NET] },
      { name: 'finance-sheets-sep', url: `/operations/finance?tab=sheets&${SEP}&status=submitted`, expect: ['Waiting for approval'] },
    ],
  },
  {
    id: 'admin',
    login: acct('admin'),
    pages: [
      { name: 'pos-sheet-returned-0929', url: '/operations/pos?tab=sheet&date=2026-09-29', expect: ['Returned', 'Lunch amount looks high'] },
      { name: 'pos-sheet-reopened-0912', url: '/operations/pos?tab=sheet&date=2026-09-12', expect: ['Approved'] },
    ],
  },
  {
    id: 'batangas-ba',
    login: { email: BATANGAS_SEED_STAFF[0].email, password: SEED_PASSWORD },
    pages: [{ name: 'pos-sheet-waiting-0930', url: '/operations/pos?tab=sheet&date=2026-09-30', expect: ['Waiting for approval'] }],
  },
  {
    id: 'tl',
    login: acct('tl'),
    pages: [{ name: 'bookings', url: '/operations/bookings' }],
  },
]
const VIEWPORTS = [1440, 375]

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
const stillLoading = () =>
  !document.querySelector('main h1, main h2') ||
  Boolean(document.querySelector('[aria-busy="true"]')) ||
  [...document.querySelectorAll('main .animate-pulse')].some((el) => el.getBoundingClientRect().width > 24) ||
  /•••|…|Loading/.test(document.querySelector('main')?.innerText || document.body.innerText)

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 })
try {
  for (const role of ROLES) {
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
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v, ik) => {
      localStorage.setItem(k, v)
      localStorage.setItem(ik, String(Date.now()))
    }, COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, choice: 'necessary', at: new Date().toISOString() }), INSTALL_DISMISS_KEY)
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', role.login.email)
    await page.type('input[type="password"]', role.login.password)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })

    for (const p of role.pages) {
      for (const width of VIEWPORTS) {
        problems.length = 0
        await page.setViewport({ width, height: width < 768 ? 812 : 900 })
        await page.goto(`${base}${p.url}`, { waitUntil: 'networkidle2' }).catch(() => null)
        await page.waitForFunction(`!(${stillLoading})()`, { timeout: 30000 }).catch(() => null)
        if (p.custom) {
          await page.select('select:has(option[value="custom"])', 'custom')
          await page.waitForSelector('main input[type="date"]')
          await page.evaluate(() => {
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
            const [from, to] = document.querySelectorAll('main input[type="date"]')
            for (const [el, v] of [[from, '2026-09-01'], [to, '2026-09-30']]) {
              set.call(el, v)
              el.dispatchEvent(new Event('input', { bubbles: true }))
            }
          })
          await new Promise((r) => setTimeout(r, 500))
          await page.waitForFunction(`!(${stillLoading})()`, { timeout: 45000 }).catch(() => null)
        }
        await new Promise((r) => setTimeout(r, 800))
        const state = await page.evaluate((src) => ({
          text: document.querySelector('main')?.innerText || '',
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          loading: new Function(`return (${src})()`)(),
          denied: /access-denied/.test(location.pathname),
        }), String(stillLoading))
        await page.screenshot({ path: join(outDir, `${role.id}-${p.name}-${width}.png`), fullPage: true })
        const issues = [...problems]
        if (state.overflow > 2) issues.push(`overflow ${state.overflow}px`)
        if (state.loading) issues.push('still loading')
        if (state.denied) issues.push('access denied')
        for (const want of p.expect || []) if (!state.text.includes(want)) issues.push(`missing "${want}"`)
        check(`${role.id} ${p.name} @${width}`, !issues.length, issues.join(' | '))
      }
    }
    await ctx.close()
  }
} catch (err) {
  check('walk finished', false, err.stack?.split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close().catch(() => null)
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`)
process.exit(failed.length ? 1 : 0)
