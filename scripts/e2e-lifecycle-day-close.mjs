import { existsSync, readFileSync } from 'node:fs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import puppeteer from 'puppeteer'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    if (!process.env[k]) process.env[k] = line.slice(i + 1)
  }
}
const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const boss = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'boss')
const today = '2026-09-23'

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 120000, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
if (cookie) await cookie.click().catch(() => null)
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
const email = await page.$('input[type="email"], input[name="email"]')
const pass = await page.$('input[type="password"]')
await email.type(boss.email, { delay: 4 })
await pass.type(boss.password, { delay: 4 })
await page.click('button[type="submit"]')
await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })
await page.goto(`${base}/operations/finance?tab=overview&period=custom&from=${today}&to=${today}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction(() => /Paid by kind|4,501|4501/.test(document.body.innerText), { timeout: 30000 })
const text = await page.evaluate(() => document.body.innerText)
await page.screenshot({ path: join(root, 'e2e-evidence', 'lifecycle-day', 'finance-today.png'), fullPage: false, timeout: 15000 })
await browser.close()
const hit = /4,501|4501/.test(text) && /Package|Packages/.test(text)
if (!hit) {
  console.error('✖ finance.screen', text.slice(text.indexOf('Paid by kind'), text.indexOf('Paid by kind') + 300))
  process.exit(1)
}
console.log('✔ finance.screen shows ₱4,501 and the package line')
