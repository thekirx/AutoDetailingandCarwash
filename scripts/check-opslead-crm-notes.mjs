/**
 * READ-ONLY: Operations Lead shell (no Floor Board, Queue home, CRM view only) and CRM ticket notes.
 * Every CRM role opens the same customer from the Directory and must see the Team Lead ticket note
 * (bookings.notes from the New ticket form) on the profile Notes tab. View-only roles get no add-note form.
 * Fails on page exceptions, console errors, failed API / Supabase responses, or error toasts.
 *
 *   node scripts/check-opslead-crm-notes.mjs        (starts vite on :5199, or set BASE_URL)
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
const shots = join(root, 'e2e-evidence', 'opslead-crm-notes')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, opts)
const account = (id) => OPS_DEMO_ACCOUNTS.find((a) => a.id === id)

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

/** Latest Team Lead ticket note Marketing can read (branch scoped), so every CRM role can read it too. */
async function pickTarget() {
  const mkt = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, opts)
  const { error: signErr } = await mkt.auth.signInWithPassword({ email: account('marketing').email, password: account('marketing').password })
  if (signErr) throw signErr
  const { data, error } = await mkt.from('bookings')
    .select('customer_id, notes, created_at')
    .not('notes', 'is', null).not('team_lead_id', 'is', null).not('customer_id', 'is', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  for (const b of data) {
    const { data: c } = await db.from('customers').select('id, full_name, phone').eq('id', b.customer_id).maybeSingle()
    if (c?.phone && b.notes.trim()) return { customer: c, note: b.notes.trim() }
  }
  throw new Error('no customer with a Team Lead ticket note found')
}

let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

let server
let browser
try {
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const target = await pickTarget()
  const noteProbe = target.note.split(/\s+/).slice(0, 6).join(' ')
  console.log(`target: ${target.customer.full_name} (${target.customer.phone}) note "${noteProbe}…"`)
  const { data: asaRow } = await db.from('staff_profiles').select('permission_grants').eq('id', (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === account('asa').email)?.id).maybeSingle()
  const asaHasCrm = Boolean(asaRow?.permission_grants?.crm)

  const personas = [
    { id: 'opslead', canWrite: false },
    { id: 'boss', canWrite: true },
    ...(asaHasCrm ? [{ id: 'asa', canWrite: true }] : []),
    { id: 'marketing', canWrite: true },
    { id: 'sales', canWrite: false },
  ].filter((p) => !process.env.ONLY || process.env.ONLY.split(',').includes(p.id))
  if (!asaHasCrm) console.log('INFO  asa: demo ASA has no crm grant, so CRM is refused by design; skipped')

  for (const { id, canWrite } of personas) {
    const persona = account(id)
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
    const path = () => page.evaluate(() => location.pathname)
    const dismissInstall = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())

    await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded' })
    const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
    if (cookie) await cookie.click().catch(() => null)
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 90000 })
    await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
    await page.type('input[type="password"]', persona.password, { delay: 5 })
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })
    await sleep(1000)

    if (id === 'opslead') {
      check(await path() === '/operations/queue', 'opslead: lands on Queue', await path())
      await page.waitForSelector('a[href="/operations/crm"]', { timeout: 30000 }).catch(() => null)
      const navHrefs = await page.$$eval('a[href^="/operations/"]', (n) => [...new Set(n.map((a) => a.getAttribute('href')))])
      check(!navHrefs.includes('/operations/dashboard'), 'opslead: no Floor link in the shell', navHrefs.join(', '))
      check(navHrefs.includes('/operations/crm'), 'opslead: shell links to CRM')
      await dismissInstall()
      await page.screenshot({ path: join(shots, 'opslead-queue-home.png'), fullPage: false })
      await page.goto(`${server.base}/operations/dashboard`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => location.pathname === '/operations/access-denied', { timeout: 60000 }).catch(() => null)
      check(await path() === '/operations/access-denied', 'opslead: /operations/dashboard is refused', await path())
    }

    await page.goto(`${server.base}/operations/crm`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="CRM sections"]', { timeout: 60000 })
    await sleep(2000)
    await dismissInstall()
    if (!canWrite) {
      const crmTabs = await page.$$eval('[aria-label="CRM sections"] [role="tab"]', (n) => n.map((t) => t.textContent.trim()))
      check(!crmTabs.some((t) => /SMS/.test(t)), `${id}: CRM has no SMS tab`, crmTabs.join(', '))
      check(await page.evaluate(() => /View only\./.test(document.body.innerText)), `${id}: CRM says View only`)
    }
    await page.type('input[placeholder="Search name, phone, email"]', target.customer.phone, { delay: 5 })
    await sleep(800)
    const viewed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /^View$/.test(x.textContent.trim()))
      b?.click()
      return !!b
    })
    check(viewed, `${id}: Directory finds the customer and View opens the profile`)
    if (viewed) {
      await page.waitForSelector('.crm-profile', { timeout: 15000 })
      await page.waitForFunction(() => !/Loading history/.test(document.querySelector('.crm-profile')?.textContent || ''), { timeout: 30000 }).catch(() => null)
      // The tabs remount once history finishes loading (back to Visits), so keep selecting Notes until it sticks.
      await page.waitForFunction(() => {
        const tab = [...document.querySelectorAll('.crm-profile [role="tab"]')].find((t) => /^Notes/.test(t.textContent.trim()))
        if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click()
        return /Ticket notes/.test(document.querySelector('.crm-profile')?.innerText || '')
      }, { timeout: 30000, polling: 500 }).catch(() => null)
      await sleep(500)
      const dialogText = await page.$eval('.crm-profile', (d) => d.innerText)
      if (!dialogText.includes('Ticket notes')) {
        console.log('  debug tabs:', await page.$$eval('.crm-profile [role="tab"]', (n) => n.map((t) => `${t.textContent.trim()}=${t.getAttribute('aria-selected')}`).join(' ')))
      }
      check(dialogText.includes('Ticket notes') && dialogText.includes(noteProbe), `${id}: Notes tab shows the Team Lead ticket note`, noteProbe)
      const labels = await page.$$eval('.crm-profile article span.font-medium', (n) => n.map((s) => s.textContent.trim()))
      const author = labels.find((t) => t.startsWith('Team Lead · '))?.slice('Team Lead · '.length) || ''
      check(Boolean(author), `${id}: the note names the Team Lead who wrote it`, author)
      const hasForm = await page.$('.crm-profile #guest-note-body').then(Boolean)
      check(hasForm === canWrite, `${id}: guest-note form ${canWrite ? 'shown (CRM editor)' : 'hidden (view only)'}`)
      if (!canWrite) {
        const writeButtons = await page.$$eval('.crm-profile button', (n) => n.map((b) => b.textContent.trim()).filter((t) => /^(Message|Edit profile|Add vehicle)$/.test(t)))
        check(!writeButtons.length, `${id}: profile has no Message / Edit / Add vehicle`, writeButtons.join(', ') || 'none')
      }
      await page.screenshot({ path: join(shots, `${id}-profile-notes.png`), fullPage: false })
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
