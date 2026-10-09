/**
 * READ-ONLY: opens every Planner tab (and its sub-tabs) as each role that can see the Planner.
 * Fails on page exceptions, console errors, failed API / Supabase responses, or error toasts.
 *
 *   node scripts/check-planner-tabs.mjs        (starts vite on :5199, or set BASE_URL)
 */
/* global document, location */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { isBookingBoardRow } from '../src/lib/serviceKinds.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const shots = join(root, 'e2e-evidence', 'planner-tabs')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PERSONAS = process.env.ONLY ? process.env.ONLY.split(',') : ['boss', 'asa', 'admin', 'opslead', 'tl', 'crew1', 'marketing', 'video']
const HOME = { boss: '/operations/dashboard', asa: '/operations/dashboard', admin: '/operations/pos', opslead: '/operations/queue', tl: '/operations/queue', crew1: '/operations/attendance', marketing: '/operations/crm', video: '/operations/planning' }
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

/** Booking-board appointments in a month (all branches), computed from raw rows with the app's own rule. */
async function expectedCalendarBookings(year, month) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('bookings').select('id, status, services ( slug, pay_category )')
      .eq('is_archived', false).neq('status', 'cancelled')
      .gte('scheduled_start', new Date(year, month, 1).toISOString()).lt('scheduled_start', new Date(year, month + 1, 1).toISOString())
      .order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  return { all: rows.length, board: rows.filter(isBookingBoardRow).length }
}
const EXPECTED_TABS = {
  edit: ['Board', 'Calendar', 'Forms', 'Events', 'Review', 'Configure'],
  view: ['Board', 'Calendar', 'Forms', 'Events'],
  video: ['Board', 'Calendar'],
}

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
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

async function runPersona(id) {
  const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const problems = []
  page.on('pageerror', (e) => problems.push(`exception: ${String(e.message).slice(0, 200)}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`) })
  page.on('response', (r) => {
    const url = r.url()
    if (r.status() >= 400 && (url.includes('supabase.co') || url.includes('/api/'))) problems.push(`http ${r.status()}: ${r.request().method()} ${url.split('?')[0].slice(-80)}`)
  })
  const dismissInstall = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
  const dialogOpen = () => page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => !/Install Hakum/.test(d.textContent)), { timeout: 8000 }).then(() => true, () => false)
  const toasts = () => page.$$eval('[data-sonner-toast][data-type="error"]', (n) => n.map((t) => t.textContent.trim()))
  const clickButton = (scope, label) => page.evaluate((s, l) => {
    const b = [...document.querySelectorAll(`${s} button`)].find((x) => x.textContent.trim() === l)
    b?.click()
    return !!b
  }, scope, label)

  await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
  await page.type('input[type="password"]', persona.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })
  await sleep(800)
  check(await page.evaluate(() => location.pathname) === HOME[id], `${id}: lands on ${HOME[id]}`, await page.evaluate(() => location.pathname))
  check(!(await page.$('a[href^="/operations/roadmap"]')) && !(await page.evaluate(() => /\bOps Lab\b/.test(document.body.innerText))), `${id}: no Ops Lab link anywhere in the shell`)
  await page.goto(`${server.base}/operations/roadmap?board=x`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !location.pathname.startsWith('/operations/roadmap') && location.pathname !== '/operations', { timeout: 30000 }).catch(() => null)
  check(await page.evaluate(() => location.pathname) === HOME[id], `${id}: old /operations/roadmap link redirects home`, await page.evaluate(() => location.pathname))

  await page.goto(`${server.base}/operations/planning`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('[role="tablist"][aria-label="Planner"]', { timeout: 45000 })
  await sleep(1500)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())

  const tabLabels = await page.$$eval('[role="tablist"][aria-label="Planner"] [role="tab"]', (n) => n.map((t) => t.getAttribute('aria-label') || t.textContent.replace(/\s*\(\d+\)$/, '').trim()))
  const canEdit = ['boss', 'admin', 'opslead'].includes(id)
  const expected = id === 'video' ? EXPECTED_TABS.video : canEdit ? EXPECTED_TABS.edit : id === 'asa' ? null : EXPECTED_TABS.view
  if (expected) check(expected.every((t) => tabLabels.some((l) => l.startsWith(t))) && tabLabels.length === expected.length, `${id}: tabs ${expected.join(', ')}`, tabLabels.join(', '))

  for (const label of tabLabels) {
    const before = problems.length
    await page.evaluate((l) => [...document.querySelectorAll('[role="tablist"][aria-label="Planner"] [role="tab"]')].find((t) => (t.getAttribute('aria-label') || t.textContent.replace(/\s*\(\d+\)$/, '').trim()) === l)?.click(), label)
    await sleep(1800)
    await dismissInstall()
    const tabId = await page.evaluate(() => new URLSearchParams(location.search).get('tab') || 'board')

    if (tabId === 'board') {
      for (const v of ['Board', 'Table']) { await clickButton('.planner-v2-rail', v); await sleep(300) }
      if (await clickButton('.hakum-planning', 'New task')) {
        check(await dialogOpen(), `${id}: New task opens the task modal`)
        await page.keyboard.press('Escape')
        await sleep(600)
      }
      if (await page.$('.planner-v2-row-link')) {
        await dismissInstall()
        await page.focus('.planner-v2-row-link')
        await page.keyboard.press('Enter')
        check(await dialogOpen(), `${id}: an existing task opens from the keyboard (Tab + Enter)`)
        await page.keyboard.press('Escape')
        await sleep(600)
      }
    }
    if (tabId === 'calendar') {
      for (const v of ['Next', 'Prev', 'Prev']) { await clickButton('.planner-cal-toolbar', v); await sleep(900) }
      await page.waitForFunction(() => /September/.test(document.querySelector('.planner-cal-toolbar strong')?.textContent || ''), { timeout: 10000 }).catch(() => null)
      await sleep(2500)
      const chips = await page.$$eval('.planner-cal-chip.is-booking', (n) => n.map((a) => a.getAttribute('href')))
      const hrefsOk = chips.every((h) => /^\/operations\/bookings\?tab=table&date=2026-09-\d{2}$/.test(h))
      if (id === 'boss') {
        const exp = await expectedCalendarBookings(2026, 8)
        check(chips.length === exp.board, 'boss: September calendar shows every booking-board appointment, not walk-in tickets', `ui=${chips.length} db=${exp.board} (all bookings incl. walk-ins=${exp.all})`)
      }
      if (canEdit) check(chips.length > 0 && hrefsOk, `${id}: September booking chips link to that day on Bookings`, chips[0] || 'none')
      await dismissInstall()
      const covering = await page.evaluate(() => {
        const cell = [...document.querySelectorAll('.planner-cal-cell')][10]
        if (!cell) return 'no calendar cells'
        cell.scrollIntoView({ block: 'center' })
        const r = cell.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return hit && cell.contains(hit) ? '' : `${hit?.tagName}.${hit?.className}`
      })
      check(!covering, `${id}: calendar grid is visible (nothing overlays it)`, covering || 'ok')
      await page.screenshot({ path: join(shots, `${id}-calendar-september.png`), fullPage: true })
      if (id === 'boss' && chips.length) {
        const day = chips[0].split('date=')[1]
        const name = await page.$eval(`.planner-cal-chip.is-booking[href="${chips[0]}"]`, (a) => a.textContent.trim())
        await sleep(400)
        await page.click(`.planner-cal-chip.is-booking[href="${chips[0]}"]`)
        await page.waitForFunction(() => location.pathname === '/operations/bookings', { timeout: 20000 })
          .catch(async () => { throw new Error(`chip click stayed on ${await page.evaluate(() => location.href)}`) })
        await page.waitForSelector('input[aria-label="Start date"]', { timeout: 20000 }).catch(() => null)
        const range = await page.evaluate(() => [document.querySelector('input[aria-label="Start date"]')?.value, document.querySelector('input[aria-label="End date"]')?.value])
        check(range[0] === day && range[1] === day, 'boss: booking chip opens Bookings filtered to that day', `${range.join(' to ')} expected ${day}`)
        const listed = await page.waitForFunction((n) => [...document.querySelectorAll('table tbody td')].some((td) => td.textContent.includes(n)), { timeout: 20000 }, name).then(() => true, () => false)
        check(listed, 'boss: the clicked booking is listed on that day', name)
        await page.screenshot({ path: join(shots, 'boss-bookings-linked-day.png'), fullPage: false })
        await page.goBack({ waitUntil: 'domcontentloaded' })
        await page.waitForSelector('[role="tablist"][aria-label="Planner"]', { timeout: 30000 })
        await sleep(1200)
      }
    }
    if (tabId === 'forms') {
      const kinds = await page.$$eval('#form-kind-filter option', (n) => n.map((o) => o.value))
      let buttons = 0
      let dialogs = 0
      const seen = []
      for (const kind of kinds) {
        await dismissInstall()
        await page.select('#form-kind-filter', kind)
        await sleep(700)
        seen.push(`${kind}:${await page.$eval('.planner-forms [data-slot="card-title"], .planner-forms h3', (n) => n.textContent.trim()).catch(() => '?')}`)
        for (const match of [/^Preview$/, /^Results \(\d+\)$/, /^Edit$/]) {
          const opened = await page.evaluate((src) => {
            const b = [...document.querySelectorAll('.planner-forms button')].find((x) => new RegExp(src).test(x.textContent.trim()))
            b?.click()
            return !!b
          }, match.source)
          if (!opened) continue
          buttons += 1
          if (await dialogOpen()) dialogs += 1
          await page.keyboard.press('Escape')
          await sleep(500)
        }
      }
      check(dialogs === buttons, `${id}: Forms kinds (${kinds.length}): every Preview / Results / Edit opens its dialog`, `${dialogs}/${buttons} · ${seen.join(' | ')}`)
    }
    const SUB_TABS = '.planner-v2 [role="tablist"]:not([aria-label="Planner"]) [role="tab"]'
    const inner = await page.$$eval(SUB_TABS, (n) => n.map((t) => t.textContent.trim()).filter(Boolean))
    for (const sub of inner) {
      await page.evaluate((sel, s) => [...document.querySelectorAll(sel)].find((t) => t.textContent.trim() === s)?.click(), SUB_TABS, sub)
      await sleep(900)
    }
    await page.screenshot({ path: join(shots, `${id}-${tabId}.png`), fullPage: true })
    const errs = await toasts()
    const fresh = problems.slice(before)
    check(!fresh.length && !errs.length, `${id}: ${label} tab${inner.length ? ` (+ ${inner.length} sub-tabs)` : ''} has no errors`, [...fresh, ...errs.map((t) => `toast: ${t}`)].join(' | '))
  }
  await ctx.close()
}

try {
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  for (const id of PERSONAS) {
    try {
      await runPersona(id)
    } catch (err) {
      check(false, `${id}: run`, String(err.message).slice(0, 200))
    }
  }
} finally {
  await browser?.close()
  await server?.stop()
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed')
process.exit(failed ? 1 : 0)
