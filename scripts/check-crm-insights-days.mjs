/**
 * READ-ONLY: CRM Insights "Most profitable days" + Days / Date / Branch filters.
 * Numbers on screen are checked against paid POS sales read with the service role.
 * Fails on page exceptions, console errors, failed API / Supabase responses, or error toasts.
 *
 *   node scripts/check-crm-insights-days.mjs        (starts vite on :5199, or set BASE_URL)
 */
/* global document, location, window */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const shots = join(root, 'e2e-evidence', 'crm-insights-days')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const isWin = process.platform === 'win32'
  const port = process.env.DEV_PORT || '5199'
  const base = `http://127.0.0.1:${port}`
  const dev = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, env: process.env })
  let ready = false
  for (let i = 0; i < 120 && !ready; i++) {
    await sleep(500)
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      ready = res.ok || res.status === 404
    } catch { /* wait */ }
  }
  if (!ready) throw new Error('vite dev server did not become ready')
  return { base, stop: async () => { if (isWin && dev.pid) spawn('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore', shell: true }); else dev.kill('SIGTERM') } }
}

// Independent of src/lib/crmInsights: plain Intl weekday names in Asia/Manila.
const manilaKey = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso))
const manilaDow = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(new Date(iso))
const today = manilaKey(new Date())
const monthStart = `${today.slice(0, 8)}01`
const [ty, tm] = today.split('-').map(Number)
const lastMonthStart = new Date(Date.UTC(ty, tm - 2, 1)).toISOString().slice(0, 10)
const lastMonthEnd = new Date(Date.UTC(ty, tm - 1, 0)).toISOString().slice(0, 10)
const peso = (minor) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(minor / 100)

async function dbSales(start, end) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const q = db.from('sales').select('branch, total_minor, occurred_at')
      .gte('occurred_at', `${start}T00:00:00+08:00`).lte('occurred_at', `${end}T23:59:59.999+08:00`)
      .in('status', ['paid', 'completed']).order('id').range(from, from + 999)
    const { data, error } = await q
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const sum = (rows) => rows.reduce((s, r) => s + Number(r.total_minor || 0), 0)

let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

let server
let browser
try {
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const monthSales = await dbSales(monthStart, today)
  // Seed data may not reach the current month yet; the deep checks run on Last month.
  const lastSales = await dbSales(lastMonthStart, lastMonthEnd)
  check(lastSales.length > 0, `database has paid sales last month (${lastMonthStart} to ${lastMonthEnd})`, `${lastSales.length} sales`)
  const { data: branchRows } = await db.from('branches').select('slug, name').eq('is_archived', false)
  const nameOf = (slug) => branchRows.find((b) => b.slug === slug)?.name || slug

  for (const id of ['boss', 'marketing']) {
    const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(120000)
    await page.setViewport({ width: 1440, height: 1000 })
    const problems = []
    page.on('pageerror', (e) => problems.push(`exception: ${String(e.message).slice(0, 200)}`))
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`) })
    page.on('response', (r) => {
      const url = r.url()
      if (r.status() >= 400 && (url.includes('supabase.co') || url.includes('/api/'))) problems.push(`http ${r.status()}: ${r.request().method()} ${url.split('?')[0].slice(-80)}`)
    })
    const stat = (label) => page.evaluate((l) => {
      const p = [...document.querySelectorAll('p')].find((n) => n.textContent.trim().toLowerCase() === l.toLowerCase() && n.nextElementSibling)
      return p?.nextElementSibling?.textContent.trim() || ''
    }, label)
    const settle = async () => {
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 60000 }).catch(() => null)
      await sleep(600)
      // The install-app prompt can open late and cover the evidence.
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
      await sleep(200)
    }
    const shot = async (name) => {
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
      await sleep(300)
      await page.screenshot({ path: join(shots, name), fullPage: false })
    }
    const clickButton = (text, scope = 'body') => page.evaluate((t, s) => {
      const b = [...document.querySelector(s).querySelectorAll('button')].find((x) => x.textContent.trim() === t || x.getAttribute('aria-label') === t)
      b?.click()
      return !!b
    }, text, scope)
    const weekdayList = () => page.$$eval('ol[aria-label="Average revenue by weekday"] li > span:first-child', (n) => n.map((s) => s.childNodes[0].textContent.trim()))
    const branchRowsOnScreen = () => page.$$eval('section[aria-labelledby="crm-days-by-branch"] tbody tr td:first-child', (n) => n.map((t) => t.textContent.trim()))

    await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded' })
    const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
    if (cookie) await cookie.click().catch(() => null)
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 90000 })
    await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
    await page.type('input[type="password"]', persona.password, { delay: 5 })
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })

    await page.goto(`${server.base}/operations/crm?tab=insights`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role="group"][aria-label="Days of the week"]', { timeout: 60000 })
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
    await settle()

    const dayButtons = await page.$$eval('[role="group"][aria-label="Days of the week"] button', (n) => n.map((b) => `${b.textContent.trim()}:${b.getAttribute('aria-pressed')}`))
    check(dayButtons.length === 7 && dayButtons.every((d) => d.endsWith(':true')), `${id}: Days filter has Mon to Sun, all on`, dayButtons.join(' '))
    check(Boolean(await page.$('[aria-label="Date range"]')), `${id}: Date filter present`)
    const dateText = () => page.$eval('[aria-label="Date range"]', (n) => n.textContent.replace(/[^\w)]+$/, '').trim())
    check(await dateText() === 'This month', `${id}: Date filter shows its label`, await dateText())
    check(await stat('Revenue') === peso(sum(monthSales)), `${id}: This month revenue matches paid POS sales`, `${await stat('Revenue')} vs db ${peso(sum(monthSales))}`)

    if (id === 'boss') {
      await page.waitForSelector('[role="group"][aria-label="Branches"]', { timeout: 15000 }).catch(() => null)
      const branchChips = await page.$$eval('[role="group"][aria-label="Branches"] button', (n) => n.map((b) => b.textContent.trim())).catch(() => [])
      const diag = branchChips.length ? '' : await page.evaluate(() => import('/src/lib/adminApi.js').then((m) => m.listBranches()).then((r) => `listBranches() -> ${r.length} rows`).catch((e) => `listBranches() threw: ${e.message}`))
      check(branchChips.length > 2, 'boss: Branch filter lists All branches + each branch', branchChips.join(', ') || diag)

      await page.click('[aria-label="Date range"]')
      await page.waitForSelector('[role="option"]', { timeout: 10000 })
      await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Last month')?.click())
      await settle()
      check(await dateText() === 'Last month', 'boss: Last month preset is selected', await dateText())
      const expectTotal = sum(lastSales)
      check(await stat('Revenue') === peso(expectTotal), 'boss: Last month revenue matches paid POS sales', `${await stat('Revenue')} vs db ${peso(expectTotal)}`)
      const byDow = {}
      for (const s of lastSales) byDow[manilaDow(s.occurred_at)] = (byDow[manilaDow(s.occurred_at)] || 0) + Number(s.total_minor || 0)
      const bestShown = await stat('Best day')
      check(Boolean(byDow[bestShown]), 'boss: Best day is a weekday that sold last month', `${bestShown} (${peso(byDow[bestShown] || 0)} total)`)
      check((await weekdayList()).length === 7, 'boss: weekday ranking lists all 7 days')
      const shownBranches = await branchRowsOnScreen()
      const dbBranches = [...new Set(lastSales.map((s) => s.branch))].map(nameOf)
      check(shownBranches.length === dbBranches.length && dbBranches.every((n) => shownBranches.includes(n)), 'boss: By branch breakdown has every branch that sold', shownBranches.join(', '))
      await shot('boss-last-month.png')
      const card = await page.$('section[aria-labelledby="crm-days-by-branch"]')
      await card?.evaluate((n) => n.closest('[data-slot="card"]')?.scrollIntoView({ block: 'start' }))
      await sleep(400)
      await shot('boss-profitable-days.png')

      // Weekends + one branch
      await page.evaluate(() => window.scrollTo(0, 0))
      await clickButton('Weekends')
      await settle()
      check(JSON.stringify(await weekdayList()) === JSON.stringify(['Saturday', 'Sunday']), 'boss: Weekends shows only Saturday and Sunday', (await weekdayList()).join(', '))
      const weekend = lastSales.filter((s) => ['Saturday', 'Sunday'].includes(manilaDow(s.occurred_at)))
      check(await stat('Revenue') === peso(sum(weekend)), 'boss: Weekends revenue matches the database', `${await stat('Revenue')} vs ${peso(sum(weekend))}`)
      const topBranch = [...new Set(lastSales.map((s) => s.branch))][0]
      await clickButton(nameOf(topBranch), '[role="group"][aria-label="Branches"]')
      await settle()
      const oneBranch = weekend.filter((s) => s.branch === topBranch)
      check(await stat('Revenue') === peso(sum(oneBranch)), `boss: Weekends + ${nameOf(topBranch)} revenue matches`, `${await stat('Revenue')} vs ${peso(sum(oneBranch))}`)
      check(JSON.stringify(await branchRowsOnScreen()) === JSON.stringify([nameOf(topBranch)]), 'boss: By branch shows only the chosen branch', (await branchRowsOnScreen()).join(', '))
      const summary = await page.$eval('[aria-live="polite"]', (n) => n.textContent.trim())
      check(/Weekends/.test(summary) && summary.includes(nameOf(topBranch)), 'boss: filter summary reads back the choices', summary)
      await shot('boss-weekends-one-branch.png')

      check(await clickButton('Reset filters'), 'boss: Reset filters is offered once a filter changes')
      await settle()
      check(await dateText() === 'This month' && await stat('Revenue') === peso(sum(monthSales)), 'boss: Reset returns to This month, every day, all branches', `${await dateText()} ${await stat('Revenue')}`)

      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
      await page.waitForSelector('[role="group"][aria-label="Days of the week"]', { timeout: 60000 })
      await settle()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(overflow <= 1, 'boss: phone width has no sideways page scroll', `overflow ${overflow}px`)
      await shot('boss-phone-filters.png')
    } else {
      check((await weekdayList()).length === 7 || /No paid sales/.test(await page.evaluate(() => document.body.innerText)), `${id}: Most profitable days renders`)
      await shot(`${id}-insights.png`)
    }

    const errs = await page.$$eval('[data-sonner-toast][data-type="error"]', (n) => n.map((t) => t.textContent.trim()))
    check(!problems.length && !errs.length, `${id}: no exceptions, console errors, failed requests, or error toasts`, [...problems, ...errs.map((t) => `toast: ${t}`)].slice(0, 6).join(' | '))
    await context.close()
  }
} catch (err) {
  check(false, 'run', String(err.message).slice(0, 300))
} finally {
  await browser?.close()
  await server?.stop()
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed')
process.exit(failed ? 1 : 0)
