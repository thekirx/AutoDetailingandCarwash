/* global document, location */
/**
 * Read-only browser smoke of the deployed Daily Sheet (real data, real logins, no writes).
 * BA opens POS › Daily sheet; SA opens Finance › Daily sheets, P&L, old shift closes and Settings › Daily sheet;
 * retired Payroll / My pay URLs redirect. Every table write, Daily Sheet RPC, storage write and /api/notify call
 * is aborted and fails the run, so it is safe against production.
 *   BASE_URL=https://auto-detailingand-carwash.vercel.app node scripts/_daily-sheet-live-smoke.mjs
 */
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../src/lib/cookieConsent.js'
import { DISMISS_KEY as INSTALL_DISMISS_KEY } from '../src/lib/installApp.js'

const base = (process.env.BASE_URL || 'https://auto-detailingand-carwash.vercel.app').replace(/\/$/, '')
const results = []
const blockedWrites = []
const badResponses = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 30000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout }, re.source).catch(() => null)

function isWrite(req) {
  const u = req.url()
  const m = req.method()
  if (/\/api\/notify/.test(u)) return true
  if (/\/storage\/v1\/object\//.test(u) && m !== 'GET' && !/\/object\/sign\//.test(u)) return true
  if (/\/rest\/v1\/rpc\/(save|submit|review|reopen)_daily_sheet/.test(u)) return true
  return /\/rest\/v1\/(?!rpc\/)/.test(u) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(m)
}

async function login(browser, id) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(90000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => {
    if (/supabase\.co\/(rest|storage)\//.test(r.url()) && r.status() >= 400) {
      badResponses.push(`${id} ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 100)}`)
    }
  })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (isWrite(req)) {
      blockedWrites.push(`${id} ${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 100)}`)
      return req.abort()
    }
    return req.continue()
  })
  await page.setViewport({ width: 1440, height: 900 })
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((consentKey, consent, installKey) => {
    localStorage.setItem(consentKey, consent)
    localStorage.setItem(installKey, String(Date.now()))
  }, COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, choice: 'necessary', at: new Date().toISOString() }), INSTALL_DISMISS_KEY)
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', acct.email)
  await page.type('input[type="password"]', acct.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })
  return { page, errors }
}

const NEEDS_MIGRATION = /needs its database update/

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 60000 })
try {
  const ba = await login(browser, 'admin')
  await ba.page.goto(`${base}/operations/pos?tab=sheet`, { waitUntil: 'domcontentloaded' })
  await waitText(ba.page, /Cash in drawer/)
  let body = await text(ba.page)
  check('BA: POS › Daily sheet loads on live data', /Money out/.test(body) && /Cash in drawer/.test(body) && !NEEDS_MIGRATION.test(body), body.match(/Daily sheet[^\n]*/)?.[0] || '')

  await ba.page.goto(`${base}/operations/payroll`, { waitUntil: 'domcontentloaded' })
  await ba.page.waitForFunction(() => !location.pathname.includes('/payroll'), { timeout: 15000 }).catch(() => null)
  check('Retired /operations/payroll redirects', !ba.page.url().includes('/operations/payroll'), ba.page.url().replace(base, ''))
  await ba.page.goto(`${base}/operations/my-pay`, { waitUntil: 'domcontentloaded' })
  await ba.page.waitForFunction(() => !location.pathname.includes('my-pay'), { timeout: 15000 }).catch(() => null)
  check('Retired /operations/my-pay redirects', !ba.page.url().includes('my-pay'), ba.page.url().replace(base, ''))

  const sa = await login(browser, 'boss')
  await sa.page.goto(`${base}/operations/finance?tab=sheets&period=month`, { waitUntil: 'domcontentloaded' })
  await waitText(sa.page, /One sheet per branch per day/)
  body = await text(sa.page)
  check('SA: Finance › Daily sheets inbox loads', /One sheet per branch per day/.test(body) && !NEEDS_MIGRATION.test(body))

  await sa.page.goto(`${base}/operations/finance?tab=pl&period=month`, { waitUntil: 'domcontentloaded' })
  await waitText(sa.page, /Total operating expenses|No income or expenses in this window/)
  body = await text(sa.page)
  check(
    'SA: Finance › P&L loads',
    /Total operating expenses|No income or expenses in this window/.test(body),
    /Total operating expenses/.test(body) ? 'statement' : /No income or expenses/.test(body) ? 'empty month' : body.slice(0, 600).replace(/\s+/g, ' '),
  )

  await sa.page.goto(`${base}/operations/finance?tab=shift-close&period=month`, { waitUntil: 'domcontentloaded' })
  await waitText(sa.page, /Read-only history/)
  const shiftButtons = await sa.page.$$eval('button', (els) => els.map((e) => e.textContent.trim()).filter((t) => /^(Accept|Reject|Lock day|Reopen for a new count)$/.test(t)))
  check('SA: old shift closes are read-only', /Read-only history/.test(await text(sa.page)) && shiftButtons.length === 0, shiftButtons.join(','))

  await sa.page.goto(`${base}/operations/settings/daily-sheet`, { waitUntil: 'domcontentloaded' })
  await waitText(sa.page, /Daily sheet/)
  body = await text(sa.page)
  check('SA: Settings › Daily sheet loads', /Daily sheet/i.test(body) && !/Something went wrong/i.test(body))

  check('no writes attempted', blockedWrites.length === 0, blockedWrites.join(' | '))
  check('no Supabase 4xx/5xx', badResponses.length === 0, badResponses.join(' | ').slice(0, 400))
  check('no page errors', !ba.errors.length && !sa.errors.length, [...ba.errors, ...sa.errors].join(' | ').slice(0, 300))
} catch (err) {
  check('smoke finished', false, err.stack?.split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close().catch(() => null)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`)
process.exit(failed.length ? 1 : 0)
