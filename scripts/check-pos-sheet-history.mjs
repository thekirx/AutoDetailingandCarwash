/**
 * READ-ONLY: POS > Sheet history as the Branch Admin.
 * Logs in, opens /operations/pos?tab=history, and checks the rendered table against the database:
 * row count for the default window, weekly / monthly grouping, date search, and that "Open" lands on the sheet.
 *
 *   node scripts/check-pos-sheet-history.mjs        (starts vite on :5199, or set BASE_URL)
 */
/* global document, location */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { sheetHistoryRange } from '../src/lib/dailySheet.js'
import { getLocalCalendarDate } from '../src/lib/localCalendarDate.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const shots = join(root, 'e2e-evidence', 'pos-sheet-history')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

let server
let browser
let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`); if (!ok) failed += 1 }

try {
  const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'admin')
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)))

  await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
  await page.type('input[type="password"]', persona.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })

  await page.goto(`${server.base}/operations/pos?tab=history`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('[aria-label="Sheets"] table, [aria-label="Sheets"] p', { timeout: 30000 })
  await sleep(1500)

  const tabs = await page.$$eval('[role="tab"]', (els) => els.map((e) => e.textContent.trim()))
  check(tabs.some((t) => /Sheet history/.test(t)), 'POS shows a Sheet history tab', tabs.join(' | '))

  const today = getLocalCalendarDate()
  const { from, to } = sheetHistoryRange('last30', today)
  const branch = (await db.from('staff_profiles').select('branch_slug').eq('id', (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === persona.email)?.id).maybeSingle()).data?.branch_slug
  const { count } = await db.from('daily_sheets').select('id', { count: 'exact', head: true }).eq('branch', branch).gte('business_date', from).lte('business_date', to)

  const readRows = () => page.$$eval('[aria-label="Sheets"] tbody tr', (trs) => trs.map((tr) => ({ sub: tr.classList.contains('xero-subtotal'), text: tr.innerText.replace(/\s+/g, ' ').trim() })))
  let rows = await readRows()
  check(rows.filter((r) => !r.sub).length === count, 'Weekly view lists every sheet in the last 30 days', `ui=${rows.filter((r) => !r.sub).length} db=${count} branch=${branch}`)
  check(rows.some((r) => r.sub && /sheets? ·/.test(r.text)), 'Weekly view has week header rows', rows.find((r) => r.sub)?.text)
  await page.screenshot({ path: join(shots, 'weekly.png'), fullPage: true })

  const clickText = (label) => page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l)?.click(), label)
  await clickText('Monthly')
  await sleep(400)
  rows = await readRows()
  check(rows.some((r) => r.sub && /(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/.test(r.text)), 'Monthly view groups by month', rows.find((r) => r.sub)?.text)
  await page.screenshot({ path: join(shots, 'monthly.png'), fullPage: true })

  await clickText('Daily')
  await sleep(400)
  rows = await readRows()
  check(rows.length > 0 && rows.every((r) => !r.sub), 'Daily view is one row per sheet', `${rows.length} rows`)

  const pick = rows[0]?.text.match(/(\w+), (\w+) (\d+), (\d{4})/)
  if (pick) {
    await page.type('#sh-search', `${pick[2]} ${pick[3]}`)
    await sleep(400)
    rows = await readRows()
    check(rows.length >= 1 && rows.every((r) => r.text.includes(`${pick[2]} ${pick[3]}`)), `Search "${pick[2]} ${pick[3]}" narrows to that date`, `${rows.length} row(s)`)
    await page.screenshot({ path: join(shots, 'search.png'), fullPage: true })
    await page.evaluate(() => [...document.querySelectorAll('[aria-label="Sheets"] tbody .ds-link')][0]?.click())
    await page.waitForFunction(() => location.search.includes('tab=sheet') && location.search.includes('date='), { timeout: 10000 }).catch(() => null)
    check(/tab=sheet/.test(page.url()) && /date=\d{4}-\d{2}-\d{2}/.test(page.url()), 'Clicking a date opens that day on the Daily sheet tab', page.url())
  }
  check(errors.length === 0, 'no page errors', errors.join(' || '))
} catch (err) {
  console.error('CHECK FAILED:', err?.message || err)
  failed += 1
} finally {
  if (browser) await browser.close().catch(() => null)
  if (server) await server.stop().catch(() => null)
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exitCode = failed ? 1 : 0
