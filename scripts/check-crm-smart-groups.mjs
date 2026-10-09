/**
 * READ-ONLY: CRM › Smart groups + customer profile modal as the Marketing Lead.
 * Expected counts are computed here straight from the database (not via src/lib/crmSmartGroups.js),
 * then compared with what the page shows for presets and custom ranges. Opens the profile modal
 * from Smart groups and Directory, checks its numbers, saves + deletes a custom group.
 *
 *   node scripts/check-crm-smart-groups.mjs        (starts vite on :5199, or set BASE_URL)
 */
/* global document, location, window, HTMLInputElement, HTMLSelectElement */
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
process.env.TZ = 'Asia/Manila'
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const shots = join(root, 'e2e-evidence', 'crm-smart-groups')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DAY = 86400000

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

async function paged(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

/** Independent expectations from raw rows for one branch. */
async function expectations(branch) {
  const bookings = await paged(() => db.from('bookings').select('id, customer_id, status, completed_at, visit_group_id').eq('branch', branch).eq('is_archived', false).not('customer_id', 'is', null).order('id'))
  const ids = [...new Set(bookings.map((b) => b.customer_id))]
  const live = new Set()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('customers').select('id').in('id', ids.slice(i, i + 200)).eq('role', 'customer').eq('is_archived', false)
    data.forEach((c) => live.add(c.id))
  }
  const done = new Map()
  for (const b of bookings) {
    if (b.status !== 'completed' || !live.has(b.customer_id)) continue
    const list = done.get(b.customer_id) || []
    list.push(Date.parse(b.completed_at))
    done.set(b.customer_id, list)
  }
  const now = Date.now()
  const count = (fn) => [...done.values()].filter(fn).length
  const aug1 = new Date(2026, 7, 1).getTime()
  const oct1 = new Date(2026, 9, 1).getTime()
  return {
    bookings,
    visited30: count((t) => t.some((x) => x >= now - 30 * DAY)),
    new30: count((t) => Math.min(...t) >= now - 30 * DAY),
    lapsed90: count((t) => Math.max(...t) < now - 90 * DAY),
    never: [...live].filter((id) => !done.has(id)).length,
    augSep: count((t) => t.some((x) => x >= aug1 && x < oct1)),
    new6wTwoPlus: count((t) => Math.min(...t) >= now - 42 * DAY && t.length >= 2),
  }
}

let server
let browser
let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

try {
  const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'marketing')
  const { data: staff } = await db.from('staff_profiles').select('id, branch_slug').eq('login_email', persona.email).maybeSingle()
  const exp = await expectations(staff.branch_slug)
  console.log(`branch=${staff.branch_slug}`, JSON.stringify({ ...exp, bookings: exp.bookings.length }))

  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, TZ: 'Asia/Manila' } })
  const page = await browser.newPage()
  await page.emulateTimezone('Asia/Manila')
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
  await page.evaluate((uid) => localStorage.removeItem(`hakum.crm.smartGroups:${uid}`), staff.id)

  await page.goto(`${server.base}/operations/crm?tab=groups`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.crm-groups', { timeout: 30000 })
  await page.waitForFunction(() => /^\d[\d,]*\s/.test(document.querySelector('.crm-groups p.text-2xl')?.textContent || ''), { timeout: 60000 })
  await sleep(1500)

  const count = () => page.$eval('.crm-groups p.text-2xl', (p) => Number(p.textContent.replace(/[^\d]/g, '')))
  const summary = () => page.$eval('.crm-groups p.text-2xl + p', (p) => p.textContent.trim())
  const clickText = (scope, label) => page.evaluate((s, l) => [...document.querySelectorAll(`${s} button`)].find((b) => b.textContent.trim() === l)?.click(), scope, label)
  const setField = (sel, value) => page.evaluate((s, v) => {
    const el = document.querySelector(s)
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }, sel, value)
  const settle = () => sleep(350)
  const dismissInstall = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
  await dismissInstall()

  check(await count() === exp.visited30, 'Visited last 30 days matches DB (completed visits only)', `ui=${await count()} db=${exp.visited30}`)
  await page.screenshot({ path: join(shots, 'default-30d.png'), fullPage: true })

  for (const [label, key] of [['New customers (30 days)', 'new30'], ['Lapsed (no visit 90+ days)', 'lapsed90'], ['Never visited', 'never']]) {
    await clickText('[aria-label="Preset groups"]', label)
    await settle()
    check(await count() === exp[key], `${label} matches DB`, `ui=${await count()} db=${exp[key]}`)
  }

  await setField('#sg-match', 'any')
  await settle()
  await setField('#sg-kind', 'months')
  await settle()
  await setField('#sg-from', '2026-08')
  await setField('#sg-to', '2026-09')
  await settle()
  check(await count() === exp.augSep, 'Custom month range Aug-Sep 2026 matches DB', `ui=${await count()} db=${exp.augSep} · ${await summary()}`)
  await dismissInstall()
  await sleep(400)
  await page.screenshot({ path: join(shots, 'month-range.png'), fullPage: true })

  await setField('#sg-from', '2026-10')
  await settle()
  const err = await page.$eval('.crm-groups [role="alert"]', (p) => p.textContent).catch(() => '')
  check(/Start is after end/.test(err), 'Reversed month range shows an error instead of a wrong count', err)

  await setField('#sg-match', 'first')
  await settle()
  await setField('#sg-kind', 'last')
  await settle()
  await setField('#sg-amount', '6')
  await setField('#sg-unit', 'weeks')
  await setField('#sg-min', '2')
  await settle()
  check(await count() === exp.new6wTwoPlus, 'New customers in last 6 weeks with 2+ visits matches DB', `ui=${await count()} db=${exp.new6wTwoPlus} · ${await summary()}`)
  check(/First visit in the last 6 weeks · 2\+ visits/.test(await summary()), 'Filter sentence describes the custom filter', await summary())

  await setField('#sg-name', 'QA returning new customers')
  await page.evaluate(() => document.querySelector('.crm-groups form button[type="submit"]').click())
  await settle()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label="Saved groups"]', { timeout: 30000 }).catch(() => null)
  await page.waitForFunction(() => /^\d/.test(document.querySelector('.crm-groups p.text-2xl')?.textContent || ''), { timeout: 60000 })
  await sleep(1200)
  await dismissInstall()
  await clickText('[aria-label="Saved groups"]', 'QA returning new customers')
  await settle()
  check(await count() === exp.new6wTwoPlus, 'Saved group survives a reload and re-applies its filter', `ui=${await count()}`)
  await page.evaluate(() => document.querySelector('[aria-label="Delete saved group QA returning new customers"]')?.click())
  await settle()
  check(!(await page.$('[aria-label="Delete saved group QA returning new customers"]')), 'Saved group can be deleted')

  await clickText('[aria-label="Preset groups"]', 'Visited last 30 days')
  await settle()
  await setField('#sg-sort', 'visits')
  await settle()
  const first = await page.$eval('.crm-groups tbody tr', (tr) => ({ name: tr.cells[0].textContent.trim(), visits: Number(tr.cells[2].textContent) }))
  await page.evaluate(() => document.querySelector('.crm-groups tbody tr button').click())
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 })
  await page.waitForFunction(() => !document.querySelector('[role="dialog"] [aria-busy="true"]') && /Visits \(\d+\)/.test(document.querySelector('[role="dialog"]').innerText), { timeout: 30000 })
  await sleep(800)
  const modal = await page.$eval('[role="dialog"]', (d) => ({
    title: d.querySelector('h2')?.textContent.trim(),
    visitsKpi: Number(d.querySelector('[aria-label="Customer value"] p.text-lg')?.textContent),
    tab: d.innerText.match(/Visits \((\d+)\)/)?.[1],
    rows: d.querySelectorAll('tbody tr').length,
  }))
  const { data: cust } = await db.from('customers').select('id').eq('full_name', first.name).limit(5)
  const mine = exp.bookings.filter((b) => cust.some((c) => c.id === b.customer_id))
  const trips = new Set(mine.filter((b) => b.status === 'completed').map((b) => b.visit_group_id || b.id)).size
  check(modal.title === first.name, 'View opens a modal for that customer', modal.title)
  check(modal.visitsKpi === first.visits && modal.visitsKpi === trips, 'Modal visit count matches the table and the DB', `modal=${modal.visitsKpi} table=${first.visits} db=${trips}`)
  check(Number(modal.tab) === mine.length && modal.rows === mine.length, 'Modal lists the full booking history (no 30-row cap)', `tab=${modal.tab} rows=${modal.rows} db=${mine.length}`)
  await page.screenshot({ path: join(shots, 'profile-modal.png') })

  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] [role="tab"]')].find((t) => /Purchases/.test(t.textContent))?.click())
  await settle()
  await page.screenshot({ path: join(shots, 'profile-purchases.png') })
  await page.keyboard.press('Escape')
  await sleep(500)
  check(!(await page.$('[role="dialog"]')), 'Escape closes the modal')

  await page.goto(`${server.base}/operations/crm?tab=directory`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr button').length > 0, { timeout: 60000 })
  await page.evaluate(() => document.querySelector('tbody tr button').click())
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 })
  check(true, 'Directory View also opens the profile modal')
  await page.keyboard.press('Escape')
  await sleep(400)

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(`${server.base}/operations/crm?tab=groups`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.crm-groups tbody tr button').length > 0, { timeout: 60000 })
  await dismissInstall()
  await sleep(400)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(overflow <= 1, 'Phone width: page does not scroll sideways', `overflow=${overflow}px`)
  await page.screenshot({ path: join(shots, 'phone-groups.png'), fullPage: true })
  await page.evaluate(() => document.querySelector('.crm-groups tbody tr button').click())
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 })
  await sleep(1500)
  const fits = await page.$eval('[role="dialog"]', (d) => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.height <= window.innerHeight })
  check(fits, 'Phone width: modal fits the screen')
  await page.screenshot({ path: join(shots, 'phone-modal.png') })

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
