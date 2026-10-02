/* global document, window, location */
/**
 * Branch Admin combined POS check — non-destructive (never presses Charge).
 * The pending ticket is injected by intercepting the pos_handoffs read, so no
 * production rows are created.  BASE_URL=http://127.0.0.1:5174 node scripts/_pos-combined-check.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'pos-combined')
mkdirSync(outDir, { recursive: true })
const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

const TICKET = {
  id: '00000000-0000-4000-8000-0000000000a7',
  booking_id: '00000000-0000-4000-8000-0000000000b7',
  branch: 'bacoor',
  status: 'pending',
  amount_minor: 35000,
  created_at: new Date().toISOString(),
  bookings: {
    id: '00000000-0000-4000-8000-0000000000b7',
    customer_id: '00000000-0000-4000-8000-0000000000c7',
    customer_name: 'Rhea Manalo',
    vehicle_plate: 'NBC 4821',
    service_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    final_price_minor: 35000,
    price_minor: 35000,
    vehicle_type: 'medium',
    status: 'for_payment',
    queue_number: 7,
    visit_group_id: null,
  },
}
let serveTicket = true

const text = (page) => page.evaluate(() => document.body.innerText)
const settle = async (page) => {
  await page.waitForFunction(() => !/VERIFYING ACCESS/i.test(document.body?.innerText || ''), { timeout: 30000 }).catch(() => null)
  await page.waitForSelector('button[aria-label^="Add "]', { timeout: 30000 }).catch(() => null)
  await sleep(1000)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'GET' && req.url().includes('/rest/v1/pos_handoffs')) {
    return req.respond({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify(serveTicket ? [TICKET] : []),
    })
  }
  if (req.method() === 'POST' && req.url().includes('complete_pos_sale')) {
    check('never posts a sale', false, req.url())
    return req.abort()
  }
  return req.continue()
})

try {
  await page.setViewport({ width: 1440, height: 900 })
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'admin')
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.setItem('hakum-cookie-consent', 'essential'); sessionStorage.clear() })
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', acct.email)
  await page.type('input[type="password"]', acct.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })

  await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.$eval('.cookie-consent-secondary', (b) => b.click()).catch(() => null)
  const tabs = await page.$$eval('[role="tab"]', (els) => els.map((e) => e.textContent.trim()))
  check('no separate Pay queue tab', !tabs.some((t) => /pay queue/i.test(t)), tabs.join(' | '))
  check('discount controls hidden for Branch Admin', !/Apply discount/.test(await text(page)))

  const added = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="Add "]')
    b?.click()
    return b?.getAttribute('aria-label') || null
  })
  const merchName = added?.replace(/^Add /, '') || ''
  check('merch tile rings up', Boolean(added), added || '')
  await sleep(400)

  await page.click('button[aria-label^="Q-007"]')
  await sleep(1500)
  const body = await text(page)
  check('ticket opens on the order', /Ticket Q-007/i.test(body) && /NBC 4821/.test(body))
  check('merch rung up earlier stays as an add-on', /Add-ons on this ticket/i.test(body) && body.includes(merchName))
  check('ticket line locked (no stepper)', !(await page.$('button[aria-label="One more Carwash"]')))
  check('add-on keeps its stepper', Boolean(await page.$(`button[aria-label="One more ${merchName}"]`)))
  check('summary splits ticket and add-ons', /Queue ticket\s*₱350\b/.test(body) && /Add-ons · 1/.test(body))
  check('customer locked to booking (no walk-in picker)', !/Walk-in · optional/.test(body))
  check('ticket stub shows On order', /On order/i.test(body))
  check('no membership lookup crash toast', !/Cannot read properties/.test(body))
  await page.screenshot({ path: join(outDir, 'admin-1440-ticket-with-addon.png'), fullPage: true })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle(page)
  const afterReload = await text(page)
  check('reload keeps the ticket linked', /Ticket Q-007/i.test(afterReload) && afterReload.includes(merchName))

  serveTicket = false
  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle(page)
  const settled = await text(page)
  check('ticket settled elsewhere is dropped, merch kept', !/Ticket Q-007/i.test(settled) && /Walk-in order/i.test(settled) && settled.includes(merchName))
  await page.screenshot({ path: join(outDir, 'admin-1440-ticket-settled-elsewhere.png') })
  check('explains the dropped ticket', /already settled/i.test(settled))

  serveTicket = true
  await page.goto(`${base}/operations/pos?tab=pending`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  check('old ?tab=pending link lands on the combined page', /Waiting to pay/.test(await text(page)))

  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true })
  await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  check('375: no horizontal scroll', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
  await page.screenshot({ path: join(outDir, 'admin-375-counter.png') })
  await page.click('button[aria-label^="Q-007"]')
  await sleep(1500)
  const sheet = await text(page)
  check('375: ticket opens in the checkout sheet', /Ticket Q-007/i.test(sheet) && /Charge ₱/.test(sheet))
  const ticketCardHeight = await page.$eval('[role="dialog"] section[aria-label="Queue ticket"]', (el) => el.getBoundingClientRect().height).catch(() => 0)
  check('375: ticket card is not collapsed', ticketCardHeight > 100, `${Math.round(ticketCardHeight)}px`)
  await page.screenshot({ path: join(outDir, 'admin-375-ticket-sheet.png') })

  const relevantErrors = consoleErrors.filter((e) => !/favicon|ERR_BLOCKED|websocket|realtime/i.test(e))
  check('no page/console errors', relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' || '))
} catch (err) {
  check('script ran to completion', false, err.message)
} finally {
  await page.evaluate(() => sessionStorage.clear()).catch(() => null)
  await browser.close()
}
const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
