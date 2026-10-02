/* global document, window, location */
/**
 * POS "ready for payment" voice check — non-destructive.
 * The waiting ticket is injected by intercepting the pos_handoffs read and the realtime
 * INSERT is a synthetic socket message, so no production rows are created.
 * speechSynthesis is stubbed to record what would be said.
 *   BASE_URL=http://127.0.0.1:5174 node scripts/_pos-voice-check.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'pos-voice')
mkdirSync(outDir, { recursive: true })
const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

const SENTENCE = 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.'
const TICKET = {
  id: '00000000-0000-4000-8000-0000000000a8',
  booking_id: '00000000-0000-4000-8000-0000000000b8',
  branch: 'bacoor',
  status: 'pending',
  amount_minor: 35000,
  created_at: new Date().toISOString(),
  bookings: {
    id: '00000000-0000-4000-8000-0000000000b8',
    customer_id: null,
    customer_name: 'Rhea Manalo',
    vehicle_plate: 'NBC 4821',
    vehicle_make: 'Toyota',
    vehicle_model: 'Vios',
    service_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    final_price_minor: 35000,
    price_minor: 35000,
    vehicle_type: 'medium',
    status: 'for_payment',
    queue_number: 8,
    visit_group_id: null,
  },
}
let serveTicket = false
const announceCalls = []

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

await page.evaluateOnNewDocument(() => {
  window.__spoken = []
  window.speechSynthesis.speak = (u) => {
    window.__spoken.push(u.text)
    setTimeout(() => u.onend?.(), 10)
  }
  window.speechSynthesis.cancel = () => {}
  const Native = WebSocket
  window.__sockets = []
  window.__pgIds = {}
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args)
      window.__sockets.push(this)
      this.addEventListener('message', (ev) => {
        try {
          const [, , topic, event, payload] = JSON.parse(ev.data)
          if (event === 'phx_reply' && payload?.response?.postgres_changes) {
            for (const pc of payload.response.postgres_changes) window.__pgIds[`${topic}|${pc.table}`] = pc.id
          }
        } catch { /* binary frames */ }
      })
    }
  }
})

await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = req.url()
  if (req.method() === 'GET' && url.includes('/rest/v1/pos_handoffs')) {
    return req.respond({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify(serveTicket ? [TICKET] : []),
    })
  }
  if (url.includes('/api/pos-announce')) announceCalls.push(req.method())
  if (req.method() === 'POST' && url.includes('complete_pos_sale')) {
    check('never posts a sale', false, url)
    return req.abort()
  }
  return req.continue()
})

const spoken = () => page.evaluate(() => window.__spoken.slice())
const settle = async () => {
  await page.waitForFunction(() => !/VERIFYING ACCESS/i.test(document.body?.innerText || ''), { timeout: 30000 }).catch(() => null)
  await page.waitForSelector('button[aria-label^="Add "]', { timeout: 30000 }).catch(() => null)
  await sleep(1200)
}

try {
  await page.setViewport({ width: 1440, height: 900 })
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'admin')
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.setItem('hakum-cookie-consent', 'essential'); localStorage.removeItem('hakum.pos.announcer'); sessionStorage.clear() })
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', acct.email)
  await page.type('input[type="password"]', acct.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })

  await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded' })
  await settle()
  await page.$eval('.cookie-consent-secondary', (b) => b.click()).catch(() => null)

  const toggle = await page.waitForSelector('button[aria-pressed][title^="Say each car"]', { timeout: 10000 })
  check('voice switch starts off', (await toggle.evaluate((b) => b.textContent.trim())) === 'Voice off')
  await toggle.click()
  await sleep(1500)
  check('switch turns on and remembers it', (await page.evaluate(() => localStorage.getItem('hakum.pos.announcer'))) === '1')
  check('turning on speaks a test line', (await spoken()).includes('Payment announcements are on.'), JSON.stringify(await spoken()))
  await page.screenshot({ path: join(outDir, 'admin-1440-voice-on.png') })

  // Floor marks the car for payment → realtime INSERT on pos_handoffs.
  serveTicket = true
  const pushed = await page.evaluate((ticket) => {
    const key = Object.keys(window.__pgIds).find((k) => k.endsWith('|pos_handoffs'))
    const ws = window.__sockets.find((s) => s.readyState === 1 && /realtime/.test(s.url))
    if (!key || !ws) return false
    const topic = key.split('|')[0]
    const payload = {
      ids: [window.__pgIds[key]],
      data: { schema: 'public', table: 'pos_handoffs', type: 'INSERT', commit_timestamp: new Date().toISOString(), columns: [], record: { id: ticket.id, branch: ticket.branch, status: 'pending' }, errors: null },
    }
    ws.dispatchEvent(new MessageEvent('message', { data: JSON.stringify([null, null, topic, 'postgres_changes', payload]) }))
    return true
  }, TICKET)
  check('realtime subscription joined (synthetic INSERT delivered)', pushed)
  await page.waitForFunction((s) => window.__spoken.includes(s), { timeout: 12000 }, SENTENCE).catch(() => null)
  const afterInsert = await spoken()
  check('new ticket is announced with make, model and spelled plate', afterInsert.includes(SENTENCE), JSON.stringify(afterInsert))
  check('AI voice asked first, browser voice used as fallback', announceCalls.includes('POST'), announceCalls.join(','))
  check('announced once', afterInsert.filter((t) => t === SENTENCE).length === 1)

  const replay = await page.$('button[aria-label="Announce NBC 4821 again"]')
  check('ticket has a replay button', Boolean(replay))
  // The app-wide "Install Hakum" prompt can pop over the page; close it like a user would.
  if (await page.$('[data-slot="dialog-overlay"]')) {
    await page.keyboard.press('Escape')
    await sleep(500)
  }
  await replay?.click()
  await page.waitForFunction((s) => window.__spoken.filter((t) => t === s).length >= 2, { timeout: 12000 }, SENTENCE).catch(() => null)
  check('replay says it again', (await spoken()).filter((t) => t === SENTENCE).length >= 2)
  await page.screenshot({ path: join(outDir, 'admin-1440-ticket-replay.png') })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle()
  const afterReload = await spoken()
  check('reload keeps the switch on without re-announcing waiting cars', afterReload.length === 0, JSON.stringify(afterReload))
  check('switch still shows Voice on', /Voice on/.test(await page.evaluate(() => document.body.innerText)))

  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle()
  check('375: no horizontal scroll', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
  await page.screenshot({ path: join(outDir, 'admin-375-voice.png') })

  const relevantErrors = consoleErrors.filter((e) => !/favicon|ERR_BLOCKED|websocket|realtime|pos-announce|40[14]|501/i.test(e))
  check('no page/console errors', relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' || '))
} catch (err) {
  check('script ran to completion', false, err.message)
} finally {
  await page.evaluate(() => { localStorage.removeItem('hakum.pos.announcer'); sessionStorage.clear() }).catch(() => null)
  await browser.close()
}
const failed = results.filter((r) => !r.ok).length
console.log(`${results.length - failed}/${results.length} PASS`)
process.exit(failed ? 1 : 0)
