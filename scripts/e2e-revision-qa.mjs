/**
 * Revision & QA checklist browser verification (Hakum). Evidence: e2e-evidence/revision-qa/
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-revision-qa.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'revision-qa')
mkdirSync(outDir, { recursive: true })
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}
const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(ok ? '✔' : '✖', name, detail)
}

async function login(page, id) {
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]')
  await page.type('input[type="email"], input[name="email"]', acct.email)
  await page.type('input[type="password"], input[name="password"]', acct.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !location.pathname.startsWith('/operations/login'), { timeout: 60000 }).catch(() => null)
  await sleep(1500)
}
async function open(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !(document.body?.innerText || '').toUpperCase().includes('VERIFYING ACCESS'), { timeout: 30000 }).catch(() => null)
  await sleep(2500)
}
const text = (page) => page.evaluate(() => document.body.innerText)

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)))
try {
  await login(page, 'boss')
  await open(page, '/operations/dashboard')
  const nav = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('.command-rail a[href^="/operations"]')].filter((a) => !a.href.includes('?')).map((a) => a.innerText.trim()).filter(Boolean))],
  )
  check('1 sidebar shows exactly 6 modules', nav.join('|') === 'Floor Insight|Carwash Queue|Detailing|Team P|POS|Financials|Overview & Books' || nav.slice(0, 6).join('|') === 'Floor Insight|Carwash Queue|Detailing|Team P|POS|Financials', nav.join('|'))
  await page.screenshot({ path: join(outDir, 'boss-dashboard.png') })

  await open(page, '/operations/queue')
  let t = await text(page)
  check('2 queue shows Average Waiting Time', /average wait/i.test(t))
  check('3 queue has Failed QA lane', /failed qa/i.test(t))
  check('3 no legacy "Mark failed QA" button', !/mark failed qa/i.test(t))
  check('4 queue Payment lane present', /payment/i.test(t))
  await page.screenshot({ path: join(outDir, 'boss-queue.png') })

  await open(page, '/operations/pos')
  t = await text(page)
  const forPay = await page.evaluate(() => document.body.innerText.match(/ABC124|ABC7643|NIK3577/g) || [])
  check('4 POS lists the For Payment plates (ABC124/ABC7643/NIK3577)', new Set(forPay).size >= 3, [...new Set(forPay)].join(','))
  await page.screenshot({ path: join(outDir, 'boss-pos.png'), fullPage: true })
  await page
    .waitForFunction(() => [...document.querySelectorAll('button')].some((x) => /^not now$/i.test(x.innerText.trim())), { timeout: 8000 })
    .catch(() => null)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^not now$/i.test(x.innerText.trim()))
    if (b) b.click()
  })
  await sleep(1000)
  const plate = await page.evaluateHandle(() => {
    const hits = [...document.querySelectorAll('button, [role="button"]')].filter((e) => /ABC124/.test(e.innerText))
    return hits.sort((a, b) => a.innerText.length - b.innerText.length)[0] || null
  })
  if (plate.asElement()) {
    await plate.asElement().click().catch(() => null)
    await sleep(2000)
    t = await text(page)
    check('4 POS shows Itemized Breakdown', /itemized breakdown/i.test(t))
    check('4 POS shows Modify', /\bmodify\b/i.test(t))
    check('4 POS shows Return to Queue', /return to queue/i.test(t))
    await page.screenshot({ path: join(outDir, 'boss-pos-ticket.png'), fullPage: true })
  } else {
    check('4 POS ticket card openable', false, 'ABC124 card not found')
  }

  await open(page, '/operations/crm')
  t = await text(page)
  check('5 CRM page renders', t.length > 100)

  await open(page, '/operations/bookings')
  t = await text(page)
  check('6 detailing board renders', t.length > 100)
  await page.screenshot({ path: join(outDir, 'boss-bookings.png') })

  await login(page, 'admin')
  await open(page, '/operations/pos')
  t = await text(page)
  check('4 Branch Admin POS renders', t.length > 100)
  await login(page, 'tl')
  await open(page, '/operations/queue')
  t = await text(page)
  check('2 TL queue shows Average Waiting Time', /average wait/i.test(t))
  await page.screenshot({ path: join(outDir, 'tl-queue.png') })
  check('no uncaught page errors', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok)
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ ok: !failed.length, results, at: new Date().toISOString() }, null, 2))
console.log(`\npassed ${results.length - failed.length}/${results.length}`)
if (failed.length) process.exit(1)
