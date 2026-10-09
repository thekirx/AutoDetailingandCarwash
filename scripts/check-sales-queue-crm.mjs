/**
 * READ-ONLY: Sales persona on Queue + CRM.
 * Queue shows all branches with a branch filter, wash rows are view only, detailing rows open the
 * Bookings editor (closing returns to Queue). CRM is view only (no SMS tab, no edit / message / add vehicle).
 * Fails on page exceptions, console errors, failed API / Supabase responses, or error toasts.
 *
 *   node scripts/check-sales-queue-crm.mjs        (starts vite on :5199, or set BASE_URL)
 */
/* global document, location */
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
const shots = join(root, 'e2e-evidence', 'sales-queue-crm')
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

let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

let server
let browser
try {
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'sales')
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.setViewport({ width: 1440, height: 1000 })
  const problems = []
  page.on('pageerror', (e) => problems.push(`exception: ${String(e.message).slice(0, 200)}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`) })
  page.on('response', (r) => {
    const url = r.url()
    if (r.status() >= 400 && (url.includes('supabase.co') || url.includes('/api/'))) problems.push(`http ${r.status()}: ${r.request().method()} ${url.split('?')[0].slice(-80)}`)
  })
  const toasts = () => page.$$eval('[data-sonner-toast][data-type="error"]', (n) => n.map((t) => t.textContent.trim()))
  const dismissInstall = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
  const path = () => page.evaluate(() => location.pathname)

  await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded' })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 90000 })
  await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
  await page.type('input[type="password"]', persona.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })
  await sleep(1000)
  check(await path() === '/operations/bookings', 'sales: still lands on Bookings', await path())
  await page.waitForSelector('a[href="/operations/crm"]', { timeout: 30000 }).catch(() => null)
  const navHrefs = await page.$$eval('a[href^="/operations/"]', (n) => [...new Set(n.map((a) => a.getAttribute('href')))])
  check(navHrefs.includes('/operations/queue') && navHrefs.includes('/operations/crm'), 'sales: shell links to Queue and CRM', navHrefs.join(', '))

  // ── Queue: all branches, table view ─────────────────────────────────
  await page.goto(`${server.base}/operations/queue?view=table`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.queue-board-toolbar select', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.bk-data-grid .animate-pulse'), { timeout: 30000 })
  await sleep(1200)
  await dismissInstall()
  check(await path() === '/operations/queue', 'sales: Queue opens (not access denied)', await path())
  const branchOpts = await page.$$eval('.queue-board-toolbar select option', (n) => n.map((o) => ({ value: o.value, text: o.textContent.trim() })))
  check(branchOpts[0]?.value === 'all' && branchOpts.length > 2, 'sales: branch filter offers All branches + every branch', branchOpts.map((o) => o.text).join(', '))
  check(!(await page.$('a[href="/operations/queue/new"]')), 'sales: no New ticket action')

  const { data: board, error: boardErr } = await db.from('operations_queue_board')
    .select('booking_id, vehicle_plate, branch, status, service_pay_category')
    .in('status', ['confirmed', 'waiting', 'in_progress', 'final_checking'])
  if (boardErr) throw boardErr
  const isDetailing = (r) => r.service_pay_category === 'detailing'
  const expectedAll = board.filter((r) => r.status !== 'confirmed' || isDetailing(r))
  const branchesWithCars = new Set(expectedAll.map((r) => r.branch))
  const readRows = () => page.$$eval('.bk-data-grid tbody tr', (rows) => rows.map((tr) => {
    const td = tr.querySelectorAll('td')
    if (td.length < 8) return null
    return { plate: td[0].querySelector('div')?.textContent.trim(), branch: td[5].textContent.trim(), open: td[7].textContent.trim() }
  }).filter(Boolean))
  const rangeText = () => page.$eval('.bk-table-range', (n) => n.textContent.trim()).catch(() => '')
  const allRows = await readRows()
  check(allRows.length > 0, 'sales: Queue table lists active cars', `${await rangeText()} (db active=${expectedAll.length}, branches=${[...branchesWithCars].join('/')})`)
  const plateKind = new Map()
  for (const r of expectedAll) {
    const plate = String(r.vehicle_plate || 'No plate').toUpperCase()
    plateKind.set(plate, (plateKind.get(plate) || false) || isDetailing(r))
  }
  const wrong = allRows.filter((r) => {
    const det = plateKind.get(String(r.plate).toUpperCase())
    if (det === undefined) return false
    return det ? r.open !== 'Open booking' : r.open !== 'View only'
  })
  const detRows = allRows.filter((r) => r.open === 'Open booking')
  const viewRows = allRows.filter((r) => r.open === 'View only')
  check(!wrong.length, 'sales: wash rows are View only, detailing rows open in Bookings', `detailing=${detRows.length} view-only=${viewRows.length}${wrong.length ? ` wrong=${JSON.stringify(wrong.slice(0, 3))}` : ''}`)
  await page.screenshot({ path: join(shots, 'queue-all-branches-table.png'), fullPage: false })

  const target = branchOpts.find((o) => o.value !== 'all' && branchesWithCars.has(o.value)) || branchOpts[1]
  await page.select('.queue-board-toolbar select', target.value)
  await page.waitForFunction((slug) => new URLSearchParams(location.search).get('branch') === slug, { timeout: 10000 }, target.value).catch(() => null)
  await sleep(2500)
  const filtered = await readRows()
  const offBranch = filtered.filter((r) => r.branch !== target.text && r.branch.toLowerCase() !== target.value)
  check(!offBranch.length, `sales: filtering to ${target.text} shows only that branch`, `${filtered.length} rows · ${await rangeText()}${offBranch.length ? ` off=${offBranch.map((r) => r.branch).join(',')}` : ''}`)
  await page.screenshot({ path: join(shots, 'queue-branch-filter.png'), fullPage: false })

  await page.goto(`${server.base}/operations/queue`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.queue-lane-board-fit', { timeout: 60000 })
  await sleep(2500)
  await dismissInstall()
  const lanes = await page.$$eval('.queue-lane-board-fit [data-status]', (n) => n.map((s) => s.getAttribute('data-status')))
  check(lanes.join(',') === 'confirmed,waiting,in_progress,final_checking', 'sales: board lanes are Assigned, Waiting, In progress, Final check', lanes.join(','))
  const cards = await page.$$eval('.queue-lane-board-fit .queue-ticket-card', (n) => n.map((c) => ({
    tag: c.tagName,
    clipped: c.scrollHeight > c.clientHeight + 1,
    href: c.getAttribute('href') || '',
  })))
  check(cards.length > 0 && !cards.some((c) => c.href), 'sales: board cards never link to the wash ticket page', `${cards.filter((c) => c.tag === 'BUTTON').length} open-able, ${cards.filter((c) => c.tag === 'DIV').length} view-only`)
  check(!cards.some((c) => c.clipped), 'sales: no board card is squeezed (text never overlaps)', `${cards.filter((c) => c.clipped).length} clipped of ${cards.length}`)
  await page.screenshot({ path: join(shots, 'queue-board.png'), fullPage: false })

  // ── Detailing ticket opens the Bookings editor; closing returns to Queue ──
  await page.goto(`${server.base}/operations/queue?view=table`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bk-data-grid tbody tr', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.bk-data-grid .animate-pulse'), { timeout: 30000 })
  await sleep(1000)
  await dismissInstall()
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bk-data-grid button')].find((x) => x.textContent.trim() === 'Open booking')
    b?.click()
    return !!b
  })
  if (!opened) {
    check(false, 'sales: a detailing ticket is on the Queue to open', 'none active right now')
  } else {
    await page.waitForFunction(() => location.pathname === '/operations/bookings', { timeout: 20000 })
    const editor = await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Edit booking/.test(d.textContent)), { timeout: 30000 }).then(() => true, () => false)
    check(editor, 'sales: detailing ticket opens the Bookings editor', await page.evaluate(() => location.search))
    await page.screenshot({ path: join(shots, 'detailing-ticket-editor.png'), fullPage: false })
    await page.keyboard.press('Escape')
    const back = await page.waitForFunction(() => location.pathname === '/operations/queue', { timeout: 15000 }).then(() => true, () => false)
    check(back, 'sales: closing the editor returns to Queue', await path())
  }

  // ── Denied routes ─────────────────────────────────────────────────
  for (const denied of ['/operations/queue/new', '/operations/dashboard', '/operations/kpi']) {
    await page.goto(`${server.base}${denied}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.pathname === '/operations/access-denied', { timeout: 60000 }).catch(() => null)
    check(await path() === '/operations/access-denied', `sales: ${denied} is refused`, await path())
  }

  // ── CRM view only ─────────────────────────────────────────────────
  await page.goto(`${server.base}/operations/crm`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label="CRM sections"]', { timeout: 60000 })
  await sleep(2500)
  await dismissInstall()
  const crmTabs = await page.$$eval('[aria-label="CRM sections"] [role="tab"]', (n) => n.map((t) => t.textContent.trim()))
  check(crmTabs.length === 3 && !crmTabs.some((t) => /SMS/.test(t)), 'sales: CRM tabs are Directory, Smart groups, Insights (no SMS)', crmTabs.join(', '))
  check(await page.evaluate(() => /View only\./.test(document.body.innerText)), 'sales: CRM says View only')
  check(!(await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Register account/.test(b.textContent)))), 'sales: no Register account')
  await page.screenshot({ path: join(shots, 'crm-directory.png'), fullPage: false })
  const viewed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /^View$/.test(x.textContent.trim()))
    b?.click()
    return !!b
  })
  check(viewed, 'sales: a customer profile can be opened')
  if (viewed) {
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 })
    await sleep(1500)
    const writeButtons = await page.$$eval('[role="dialog"] button', (n) => n.map((b) => b.textContent.trim()).filter((t) => /^(Message|Edit|Add vehicle)$/.test(t)))
    check(!writeButtons.length, 'sales: customer profile has no Message / Edit / Add vehicle', writeButtons.join(', ') || 'none')
    await page.screenshot({ path: join(shots, 'crm-profile-view-only.png'), fullPage: false })
    await page.keyboard.press('Escape')
  }
  await page.goto(`${server.base}/operations/crm?tab=sms`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label="CRM sections"]', { timeout: 60000 })
  await sleep(1500)
  check(await path() === '/operations/crm', 'sales: ?tab=sms falls back to Directory instead of erroring', await path())

  const errs = await toasts()
  check(!problems.length && !errs.length, 'sales: no exceptions, console errors, failed requests, or error toasts', [...problems, ...errs.map((t) => `toast: ${t}`)].slice(0, 6).join(' | '))
} catch (err) {
  check(false, 'sales: run', String(err.message).slice(0, 300))
} finally {
  await browser?.close()
  await server?.stop()
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed')
process.exit(failed ? 1 : 0)
