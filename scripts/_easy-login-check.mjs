/* global document, location */
/**
 * Easy-login (demo cards) check — sign-in only, no data written.
 * Each card is clicked in a fresh browser profile and must land inside the app.
 *   node --env-file=.env scripts/_easy-login-check.mjs            (BASE_URL defaults to localhost:5173)
 * Needs DEMO_LOGIN_KEY in .env; the key is never printed.
 */
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const base = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const KEY = process.env.DEMO_LOGIN_KEY
if (!KEY) {
  console.error('DEMO_LOGIN_KEY missing from .env')
  process.exit(1)
}
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

async function fresh(path) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewport({ width: 1280, height: 860 })
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => localStorage.setItem('hakum-cookie-consent', 'essential'))
  return { ctx, page, errors }
}
const chipCount = (page) => page.$$eval('.hakum-demo-chip', (els) => els.length)

try {
  for (const [label, path] of [['no key', '/operations/login'], ['wrong key', '/operations/login?qa=not-the-key']]) {
    const { ctx, page } = await fresh(path)
    await page.waitForSelector('input[type="email"]', { timeout: 60000 })
    await sleep(3000)
    check(`${label}: no demo cards`, (await chipCount(page)) === 0)
    check(`${label}: key not left in the address bar`, !page.url().includes('qa='), page.url())
    await ctx.close()
  }

  for (const [i, acct] of OPS_DEMO_ACCOUNTS.entries()) {
    const { ctx, page, errors } = await fresh(`/operations/login?qa=${encodeURIComponent(KEY)}`)
    const shown = await page.waitForSelector('.hakum-demo-chip', { timeout: 60000 }).then(() => true, () => false)
    if (i === 0) {
      check('right key: cards shown for every team account', shown && (await chipCount(page)) === OPS_DEMO_ACCOUNTS.length, `${await chipCount(page)}/${OPS_DEMO_ACCOUNTS.length}`)
      check('right key: key not left in the address bar', !page.url().includes('qa='))
    }
    const chips = await page.$$('.hakum-demo-chip')
    await chips[i]?.click()
    const landed = await page
      .waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login') && !/Loading|VERIFYING/i.test(document.body.innerText.slice(0, 200)), { timeout: 45000 })
      .then(() => true, () => false)
    const alert = await page.$eval('[role="alert"]', (el) => el.innerText.trim()).catch(() => '')
    check(`${acct.label} (${acct.id}) signs in with one click`, landed && !errors.length, `${new URL(page.url()).pathname}${alert ? ` alert="${alert}"` : ''}${errors.length ? ` errors=${errors[0]}` : ''}`)
    await ctx.close()
    await sleep(300)
  }

  const { ctx, page, errors } = await fresh(`/signin?qa=${encodeURIComponent(KEY)}`)
  const chip = await page.waitForSelector('.hakum-demo-chip', { timeout: 60000 }).catch(() => null)
  check('customer sign-in: demo customer card shown', Boolean(chip))
  await chip?.click()
  const inAccount = await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 45000 }).then(() => true, () => false)
  check('demo customer signs in with one click', inAccount && !errors.length, new URL(page.url()).pathname)
  await ctx.close()
} catch (err) {
  check('script ran to completion', false, err.message)
} finally {
  await browser.close()
}
const failed = results.filter((ok) => !ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
