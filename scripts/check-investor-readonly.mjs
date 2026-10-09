/**
 * READ-ONLY: Investor accounts in the browser.
 * For each investor demo account: nav is Floor Board / POS / Finance, the Floor Board has no queue links or crew panel,
 * POS is Today + Sheet history with no checkout, an opened sheet has no Approve/Return and shows staff names,
 * Finance is "View only", and Queue / People are access-denied. Each account only sees its assigned branch.
 *
 *   node scripts/check-investor-readonly.mjs        (starts vite on :5199, or set BASE_URL)
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
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const shots = join(root, 'e2e-evidence', 'investor-readonly')
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
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

const { data: users } = await db.auth.admin.listUsers({ perPage: 500 })
const { data: branchRows } = await db.from('branches').select('slug, name')
const branchName = (slug) => branchRows.find((b) => b.slug === slug)?.name || slug

async function runPersona(base, persona) {
  const uid = users.users.find((u) => u.email === persona.email)?.id
  const { data: assigned } = await db.from('staff_branch_assignments').select('branch_slug').eq('staff_id', uid)
  const slugs = (assigned || []).map((a) => a.branch_slug)
  const home = branchName(slugs[0])
  const others = branchRows.filter((b) => !slugs.includes(b.slug)).map((b) => b.name)
  console.log(`\n== ${persona.label} (${persona.email}) branches=${slugs.join(',')}`)
  check(slugs.length === 1, 'assigned to exactly one branch', slugs.join(','))

  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)))
  const text = () => page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)
  const go = async (path, waitFor) => {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (waitFor) await page.waitForFunction(waitFor, { timeout: 30000 }).catch(() => null)
    await sleep(1500)
  }

  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
  await page.type('input[type="password"]', persona.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })
  await sleep(1500)

  const nav = await page.$$eval('a[href^="/operations/"]', (as) => [...new Set(as.filter((a) => !a.closest('main')).map((a) => a.getAttribute('href').split('?')[0]))])
  check(['/operations/dashboard', '/operations/pos', '/operations/finance'].every((h) => nav.includes(h)), 'nav has Floor Board, POS, Finance', nav.join(' '))
  check(!nav.some((h) => /\/operations\/(queue|people|bookings|settings|inventory|attendance)/.test(h)), 'nav has no Queue / People / Bookings / Settings', nav.join(' '))

  await go('/operations/dashboard', () => /view only/i.test(document.body.innerText))
  let body = await text()
  check(/Investor · view only/i.test(body), 'Floor Board shows the investor eyebrow')
  check(/Open POS(?! checkout)/i.test(body) && !/Open POS checkout/i.test(body), 'For Payment card links to POS without "checkout" wording')
  check(body.includes(home), `Floor Board is scoped to ${home}`)
  check(!/Crew availability/i.test(body), 'Floor Board hides crew availability')
  const queueLinks = await page.$$eval('main a[href*="/operations/queue"], main a[href*="/operations/bookings"]', (as) => as.map((a) => a.getAttribute('href')))
  check(queueLinks.length === 0, 'Floor Board has no Queue or Bookings links', queueLinks.join(' '))
  await page.screenshot({ path: join(shots, `${persona.id}-floor.png`), fullPage: true })

  await go('/operations/pos', () => document.querySelectorAll('[role="tab"]').length > 0)
  const tabs = await page.$$eval('[role="tab"]', (els) => els.map((e) => e.textContent.trim()))
  check(tabs.length === 2 && /Today/.test(tabs[0]) && /Sheet history/.test(tabs[1]), 'POS tabs are Today + Sheet history', tabs.join(' | '))
  body = await text()
  check(/View only/.test(body) && body.includes(home), `POS is view only for ${home}`)
  check(!(await page.$('select')), 'single-branch investor gets no branch picker')
  const posWrite = await page.$$eval('main button', (bs) => bs.map((b) => b.textContent.trim()).filter((t) => /^(Charge|Checkout|Save|Submit|Ring up|Complete sale|Add)/i.test(t)))
  check(posWrite.length === 0, 'POS Today has no checkout or save buttons', posWrite.join(' | '))
  await page.screenshot({ path: join(shots, `${persona.id}-pos-today.png`), fullPage: true })

  await go('/operations/pos?tab=checkout', () => document.querySelectorAll('[role="tab"]').length > 0)
  const forced = await page.$$eval('[role="tab"][data-state="active"], [role="tab"][aria-selected="true"]', (els) => els.map((e) => e.textContent.trim()))
  check(forced.some((t) => /Today/.test(t)), '?tab=checkout falls back to Today', forced.join(' | '))

  await go('/operations/pos?tab=history', () => document.querySelector('[aria-label="Sheets"] table, [aria-label="Sheets"] p'))
  body = await text()
  check(!others.some((n) => body.includes(`· ${n}`)), 'Sheet history shows no other branch')
  await page.screenshot({ path: join(shots, `${persona.id}-pos-history.png`), fullPage: true })
  const opened = await page.evaluate(() => {
    const link = document.querySelector('[aria-label="Sheets"] tbody .ds-link')
    if (!link) return null
    const label = link.closest('tr')?.innerText || ''
    link.click()
    return label
  })
  if (opened) {
    await page.waitForFunction(() => /Back to sheet history/.test(document.body.innerText), { timeout: 15000 }).catch(() => null)
    await sleep(2500)
    body = await text()
    const reviewButtons = await page.$$eval('main button', (bs) => bs.map((b) => b.textContent.trim()).filter((t) => /^(Approve|Return|Submit|Save|Reopen)/i.test(t)))
    check(reviewButtons.length === 0, 'opened sheet has no Approve / Return / Submit / Save', reviewButtons.join(' | '))
    const d = new Date((opened.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/) || [])[0])
    const iso = Number.isNaN(d.getTime()) ? '1900-01-01' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const { data: sheet } = await db.from('daily_sheets').select('id').eq('branch', slugs[0]).eq('business_date', iso).maybeSingle()
    const { data: lines } = sheet ? await db.from('daily_sheet_lines').select('staff_id').eq('sheet_id', sheet.id).not('staff_id', 'is', null) : { data: [] }
    const ids = [...new Set((lines || []).map((l) => l.staff_id))]
    console.log(`INFO  opened ${iso} (${ids.length} staff lines)`)
    if (ids.length) {
      const { data: staff } = await db.from('staff_profiles').select('full_name').in('id', ids)
      const shown = (staff || []).filter((s) => s.full_name && body.includes(s.full_name))
      check(shown.length > 0, 'opened sheet shows staff names on salary lines', `${shown.length}/${staff?.length || 0}`)
    } else {
      check(!/Unknown staff/i.test(body), 'opened sheet renders without unknown staff')
    }
    await page.screenshot({ path: join(shots, `${persona.id}-pos-sheet.png`), fullPage: true })
  } else {
    console.log('INFO  no sheets in the last 30 days to open')
  }

  await go('/operations/finance', () => /View only|Can edit/.test(document.body.innerText))
  body = await text()
  check(/View only/.test(body) && !/Can edit/.test(body), 'Finance badge says View only')
  await page.screenshot({ path: join(shots, `${persona.id}-finance.png`), fullPage: true })

  for (const path of ['/operations/queue', '/operations/people', '/operations/bookings']) {
    await go(path, () => location.pathname.includes('access-denied'))
    const url = new URL(page.url()).pathname
    check(url !== path, `${path} is blocked`, url)
  }

  check(errors.length === 0, 'no page errors', errors.join(' || '))
  await ctx.close()
}

try {
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  for (const id of ['investor', 'investor2']) await runPersona(server.base, OPS_DEMO_ACCOUNTS.find((a) => a.id === id))
} catch (err) {
  console.error('CHECK FAILED:', err?.message || err)
  failed += 1
} finally {
  if (browser) await browser.close().catch(() => null)
  if (server) await server.stop().catch(() => null)
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exitCode = failed ? 1 : 0
