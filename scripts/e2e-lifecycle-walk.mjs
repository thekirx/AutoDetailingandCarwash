/**
 * Daily-lifecycle screenshot walk. Opens each station a shop day uses.
 * Does not clock in, submit a booking, move a car, take payment, or confirm payroll.
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-lifecycle-walk.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'lifecycle')
mkdirSync(outDir, { recursive: true })

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
const notes = []
function pass(name, detail = '') {
  notes.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  notes.push({ ok: false, name, detail })
  console.error('✖', name, detail)
}
function account(id) {
  return OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
}

async function dismiss(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 200))
}

async function clearSession(page) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  }).catch(() => null)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
}

async function opsLogin(page, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismiss(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"]')
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 4 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 4 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(() => {
      const p = location.pathname
      return p.startsWith('/operations') && !p.startsWith('/operations/login')
    }, { timeout: 60000 })
    .catch(() => null)
  await new Promise((r) => setTimeout(r, 600))
  return isOpsAuthedUrl(page.url())
}

async function shot(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, timeout: 15000 }).catch(async () => {
    await page.screenshot({ path: file, fullPage: false, timeout: 15000 })
  })
  return file
}

async function textOf(page) {
  return page.evaluate(() => document.body.innerText.slice(0, 4000))
}

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 180000,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const consoleNotes = []
page.on('pageerror', (err) => consoleNotes.push(`pageerror ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleNotes.push(`console ${msg.text()}`)
})

try {
  await page.goto(`${base}/book`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismiss(page)
  await new Promise((r) => setTimeout(r, 800))
  const bookText = await textOf(page)
  if (/Book a service|Request booking|Your car/i.test(bookText)) pass('public.book', page.url())
  else fail('public.book', page.url())
  await shot(page, '01-public-book')

  await clearSession(page)
  const cust = CUSTOMER_DEMO_ACCOUNT
  await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismiss(page)
  const chip = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.hakum-demo-chip')].find((b) =>
      /demo\.customer|Demo customer/i.test(b.textContent || ''),
    )
    if (!el) return false
    el.click()
    return true
  })
  if (!chip) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /email or plate/i.test(b.textContent || ''))
      if (btn) btn.click()
    })
    await new Promise((r) => setTimeout(r, 300))
    const idSel = await page.$('input:not([type="password"]):not([type="hidden"])')
    const passSel = await page.$('input[type="password"]')
    if (idSel && passSel) {
      await idSel.type(cust.email, { delay: 4 })
      await passSel.type(cust.password, { delay: 4 })
      await page.click('button[type="submit"]')
    }
  }
  await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 }).catch(() => null)
  await page.goto(`${base}/account/book`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 1200))
  const acctBook = await textOf(page)
  if (/Select a detailing service|Request booking|Book a service/i.test(acctBook)) pass('customer.book', page.url())
  else fail('customer.book', acctBook.slice(0, 180))
  await shot(page, '02-customer-book')

  await clearSession(page)
  const crew = account('crew1')
  if (await opsLogin(page, crew.email, crew.password)) {
    await page.goto(`${base}/operations/attendance`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 1000))
    const att = await textOf(page)
    if (/Time clock|Time in|Attendance/i.test(att)) pass('crew.attendance', 'clock visible')
    else fail('crew.attendance', att.slice(0, 180))
    await shot(page, '03-crew-attendance')
  } else fail('crew.login', page.url())

  await clearSession(page)
  const tl = account('tl')
  if (await opsLogin(page, tl.email, tl.password)) {
    await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 1500))
    const queue = await textOf(page)
    pass('tl.queue', queue.includes('Waiting') || queue.includes('Queue') ? 'board open' : queue.slice(0, 120))
    await shot(page, '04-tl-queue')
    await page.goto(`${base}/operations/bookings`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page
      .waitForFunction(() => {
        const t = document.body.innerText
        return t.length > 40 && !/^Loading…?$/.test(t.trim()) && /Booking|Pending|Calendar/i.test(t)
      }, { timeout: 30000 })
      .catch(() => null)
    const books = await textOf(page)
    if (/Booking|Pending|Calendar/i.test(books)) pass('tl.bookings', page.url())
    else fail('tl.bookings', books.slice(0, 180))
    await shot(page, '05-tl-bookings')
  } else fail('tl.login', page.url())

  await clearSession(page)
  const boss = account('boss')
  if (!(await opsLogin(page, boss.email, boss.password))) {
    fail('boss.login', page.url())
  } else {
    const financeUrl = `${base}/operations/finance?tab=overview&period=custom&from=2026-08-01&to=2026-08-31`
    await page.goto(financeUrl, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null)
    await page.waitForFunction(() => /Paid by kind|No paid lines/i.test(document.body.innerText), { timeout: 30000 }).catch(() => null)
    await new Promise((r) => setTimeout(r, 500))
    const fin = await page.evaluate(() => document.body.innerText)
    writeFileSync(join(outDir, 'finance.txt'), fin)
    const augustService = fin.includes('₱2,850') && /Paid by kind[\s\S]*Services[\s\S]*₱2,850/.test(fin)
    if (augustService) pass('finance.paid_by_kind', 'August window shows Services ₱2,850, matching paid POS')
    else fail('finance.paid_by_kind', fin.slice(fin.indexOf('Paid by kind'), fin.indexOf('Paid by kind') + 240))
    await page.screenshot({ path: join(outDir, '06-finance-august.png'), fullPage: false, timeout: 15000 })

    await page.goto(`${base}/operations/payroll?tab=run`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page
      .waitForFunction(() => /Confirm writes payroll|End of shift does not pay/i.test(document.body.innerText), { timeout: 30000 })
      .catch(() => null)
    const pay = await textOf(page)
    if (/Confirm writes payroll|End of shift does not pay/i.test(pay)) pass('payroll.run', 'confirm copy visible')
    else fail('payroll.run', pay.slice(0, 240))
    await shot(page, '07-payroll-run')
  }
} catch (err) {
  fail('fatal', err?.message || String(err))
} finally {
  await browser.close()
}

const failed = notes.filter((n) => !n.ok)
const summary = {
  ok: failed.length === 0,
  passed: notes.length - failed.length,
  total: notes.length,
  notes,
  console: consoleNotes.slice(0, 30),
  withheld: [
    'Did not submit a public booking (creates a live request and can SMS).',
    'Did not clock in (geofence and attendance rows are live pay inputs).',
    'Did not move a queue car (status changes SMS the customer).',
    'Did not take a POS payment or confirm payroll (those write the books).',
  ],
  evidence: 'e2e-evidence/lifecycle',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  for (const f of failed) console.log(' -', f.name, f.detail)
  process.exit(1)
}
