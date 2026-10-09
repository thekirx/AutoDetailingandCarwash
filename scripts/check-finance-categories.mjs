/**
 * WRITES then cleans up: Finance categories + vendors CRUD and adding them from the New bill form,
 * as Super Admin and ASA (finance_write). Every assertion is read back from the database.
 * Rows it creates are named "QA FinCat …" / "QA Vendor …" and removed at the end (service role).
 *
 *   node scripts/check-finance-categories.mjs        (starts vite on :5199, or set BASE_URL)
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
const shots = join(root, 'e2e-evidence', 'finance-categories')
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

async function cleanup() {
  const { data: cats } = await db.from('expense_categories').select('id').like('name', 'QA FinCat%')
  const { data: vendors } = await db.from('vendors').select('id').like('name', 'QA Vendor%')
  const catIds = (cats || []).map((c) => c.id)
  const vendorIds = (vendors || []).map((v) => v.id)
  if (catIds.length) await db.from('expenses').delete().in('category_id', catIds)
  if (vendorIds.length) await db.from('expenses').delete().in('vendor_id', vendorIds)
  if (catIds.length) await db.from('expense_categories').delete().in('id', catIds)
  if (vendorIds.length) await db.from('vendors').delete().in('id', vendorIds)
}
const catByName = async (name) => (await db.from('expense_categories').select('*').eq('name', name).maybeSingle()).data

let failed = 0
const check = (ok, label, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` - ${extra}` : ''}`); if (!ok) failed += 1 }

let server
let browser
try {
  await cleanup()
  server = await ensurePreview()
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  for (const [id, codeA, codeB] of [['boss', '91', '93'], ['asa', '92', '94']]) {
    const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(120000)
    await page.setViewport({ width: 1440, height: 1000 })
    page.on('dialog', (d) => d.accept())
    const problems = []
    let expectFailures = false
    page.on('pageerror', (e) => problems.push(`exception: ${String(e.message).slice(0, 200)}`))
    page.on('console', (m) => { if (m.type() === 'error' && !expectFailures) problems.push(`console: ${m.text().slice(0, 200)}`) })
    page.on('response', (r) => {
      const url = r.url()
      if (!expectFailures && r.status() >= 400 && (url.includes('supabase.co') || url.includes('/api/'))) problems.push(`http ${r.status()}: ${r.request().method()} ${url.split('?')[0].slice(-80)}`)
    })
    const dismiss = () => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Not now')?.click())
    const click = (sel) => page.$eval(sel, (b) => b.click())
    const clickText = (text, scope = 'body') => page.evaluate((t, s) => {
      const b = [...document.querySelector(s).querySelectorAll('button')].find((x) => x.textContent.trim() === t)
      b?.click()
      return Boolean(b)
    }, text, scope)
    const typeInto = async (sel, text) => {
      await page.$eval(sel, (el) => { el.focus(); el.select?.() })
      await page.keyboard.press('Backspace')
      await page.type(sel, text, { delay: 2 })
    }
    const lastToast = async () => {
      await page.waitForSelector('[data-sonner-toast][data-type="error"]', { timeout: 10000 }).catch(() => null)
      const text = await page.evaluate(() => document.querySelector('[data-sonner-toast][data-type="error"]')?.textContent.trim() || '')
      await page.evaluate(() => document.querySelectorAll('[data-sonner-toast] [data-close-button], [data-sonner-toast] button[aria-label="Close toast"]').forEach((b) => b.click()))
      await page.waitForFunction(() => !document.querySelector('[data-sonner-toast][data-type="error"]'), { timeout: 12000 }).catch(() => null)
      return text
    }
    const openTab = async (tab) => {
      await page.goto(`${server.base}/operations/finance?tab=${tab}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 60000 }, tab === 'categories' ? 'Add category' : 'New bill')
      await sleep(800)
      await dismiss()
    }
    const waitDialogClosed = () => page.waitForFunction(() => !document.querySelector('[role="dialog"] form'), { timeout: 15000 }).catch(() => null)

    await page.goto(`${server.base}/operations/login`, { waitUntil: 'domcontentloaded' })
    const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
    if (cookie) await cookie.click().catch(() => null)
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 90000 })
    await page.type('input[type="email"], input[name="email"]', persona.email, { delay: 5 })
    await page.type('input[type="password"]', persona.password, { delay: 5 })
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'), { timeout: 60000 })

    // Categories: create
    await openTab('categories')
    const name = `QA FinCat ${id}`
    await clickText('Add category')
    await page.waitForSelector('#acct-name')
    await page.type('#acct-code', codeA)
    await page.type('#acct-name', name)
    await page.select('#acct-kind', 'marketing')
    await clickText('Add category', '[role="dialog"]')
    await waitDialogClosed()
    let row = await catByName(name)
    check(row?.code === codeA && row?.kind === 'marketing' && !row.is_archived, `${id}: Add category saves code, name and kind`, JSON.stringify(row && { code: row.code, kind: row.kind }))

    // Edit
    await sleep(800)
    await click(`button[aria-label="Edit ${name}"]`)
    await page.waitForSelector('#acct-name')
    await typeInto('#acct-name', `${name} edited`)
    await page.$eval('[role="dialog"] input[type="checkbox"]', (c) => c.click())
    await clickText('Save category', '[role="dialog"]')
    await waitDialogClosed()
    row = await catByName(`${name} edited`)
    check(row?.code === codeA && row?.is_chemical === true, `${id}: Edit renames and turns on approval`, row ? `${row.name} approval=${row.is_chemical}` : 'not found')
    const edited = `${name} edited`

    // Duplicate code is refused with a plain message
    expectFailures = true
    await clickText('Add category')
    await page.waitForSelector('#acct-name')
    await page.type('#acct-code', '10')
    await page.type('#acct-name', `QA FinCat ${id} dup`)
    await clickText('Add category', '[role="dialog"]')
    const dupToast = await lastToast()
    check(/already uses that code/.test(dupToast) && !(await catByName(`QA FinCat ${id} dup`)), `${id}: a duplicate code is refused`, dupToast)
    await page.keyboard.press('Escape')
    await waitDialogClosed()

    // Deleting a category that bills use is refused and offers Archive
    await click('button[aria-label="Delete Meals and Entertainment"]')
    const usedToast = await lastToast()
    check(/existing bills/.test(usedToast) && /Archive/.test(usedToast) && Boolean(await catByName('Meals and Entertainment')), `${id}: deleting a used category is refused with an Archive option`, usedToast.slice(0, 120))
    expectFailures = false

    // Account 14 keeps code and kind; no archive / delete
    const salary = (await db.from('expense_categories').select('name').eq('code', '14').single()).data
    check(!(await page.$(`button[aria-label="Delete ${salary.name}"]`)) && !(await page.$(`button[aria-label="Archive ${salary.name}"]`)), `${id}: account 14 has no Archive or Delete`)
    await click(`button[aria-label="Edit ${salary.name}"]`)
    await page.waitForSelector('#acct-code')
    check(await page.$eval('#acct-code', (n) => n.disabled) && await page.$eval('#acct-kind', (n) => n.disabled), `${id}: account 14 code and kind are locked in Edit`)
    await page.keyboard.press('Escape')
    await waitDialogClosed()

    // Archive
    await click(`button[aria-label="Archive ${edited}"]`)
    await sleep(1500)
    check((await catByName(edited))?.is_archived === true, `${id}: Archive hides the category`)
    if (id === 'boss') await page.screenshot({ path: join(shots, 'boss-categories.png'), fullPage: false })

    // New bill: archived category gone from the picker; add vendor + category inline, save the bill
    await openTab('purchases')
    await clickText('New bill')
    await page.waitForSelector('#bill-from')
    const acctOptions = await page.$$eval('#bill-0-acct option', (o) => o.map((x) => x.textContent))
    check(!acctOptions.some((t) => t.includes(edited)) && acctOptions.includes('+ New category…'), `${id}: bill Account list hides archived and offers + New category`)
    await page.select('#bill-from', '__new__')
    await page.waitForSelector('#vendor-name')
    const vendorName = `QA Vendor ${id}`
    await page.type('#vendor-name', vendorName)
    await page.type('#vendor-contact', '0917 000 0000')
    await clickText('Add vendor', '[role="dialog"]')
    await waitDialogClosed()
    const vendor = (await db.from('vendors').select('id').eq('name', vendorName).maybeSingle()).data
    check(Boolean(vendor) && await page.$eval('#bill-from', (s) => s.value) === vendor?.id, `${id}: + New vendor saves and is picked on the bill`)
    await page.select('#bill-0-acct', '__new__')
    await page.waitForSelector('#acct-name')
    const billCat = `QA FinCat ${id} bill`
    await page.type('#acct-code', codeB)
    await page.type('#acct-name', billCat)
    await clickText('Add category', '[role="dialog"]')
    await waitDialogClosed()
    const newCat = await catByName(billCat)
    check(Boolean(newCat) && await page.$eval('#bill-0-acct', (s) => s.value) === newCat?.id, `${id}: + New category saves and is picked on line 1`)
    await page.type('#bill-0-item', 'QA rags')
    await page.type('#bill-0-unit', '150')
    await page.screenshot({ path: join(shots, `${id}-new-bill.png`), fullPage: false })
    // Drop the second blank line so only line 1 is saved.
    await click('button[aria-label="Remove line 2"]')
    await clickText('Save bill')
    await sleep(2500)
    const bill = (await db.from('expenses').select('title, total_minor, vendor_id, category_id, status').eq('vendor_id', vendor?.id || '00000000-0000-0000-0000-000000000000').maybeSingle()).data
    check(bill?.category_id === newCat?.id && bill?.total_minor === 15000, `${id}: bill saves with the new vendor and category`, JSON.stringify(bill))

    // Back on Categories: restore, then delete the unused one
    await openTab('categories')
    await click(`button[aria-label="Restore ${edited}"]`)
    await sleep(1500)
    check((await catByName(edited))?.is_archived === false, `${id}: Restore brings it back`)
    await click(`button[aria-label="Delete ${edited}"]`)
    await sleep(1800)
    check(!(await catByName(edited)), `${id}: Delete removes an unused category`)

    // Vendors tab: edit
    await page.goto(`${server.base}/operations/finance?tab=vendors`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout: 60000 }, vendorName)
    await dismiss()
    await page.evaluate((n) => [...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes(n))?.querySelector('button')?.click(), vendorName)
    await page.waitForSelector('#vendor-notes')
    await page.type('#vendor-notes', 'Net 30')
    await clickText('Save vendor', '[role="dialog"]')
    await waitDialogClosed()
    const v2 = (await db.from('vendors').select('notes').eq('name', vendorName).maybeSingle()).data
    check(v2?.notes === 'Net 30', `${id}: Vendors tab Edit saves`)

    const errs = await page.$$eval('[data-sonner-toast][data-type="error"]', (n) => n.map((t) => t.textContent.trim()))
    check(!problems.length && !errs.length, `${id}: no unexpected exceptions, console errors, failed requests, or error toasts`, [...problems, ...errs.map((t) => `toast: ${t}`)].slice(0, 6).join(' | '))

    if (id === 'boss') {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
      await openTab('categories')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(overflow <= 1, 'boss: Categories at phone width has no sideways scroll', `overflow ${overflow}px`)
      await page.screenshot({ path: join(shots, 'boss-categories-phone.png'), fullPage: false })
    }
    await context.close()
  }
} catch (err) {
  check(false, 'run', String(err.message).slice(0, 300))
} finally {
  await browser?.close()
  await server?.stop()
  await cleanup()
  const left = (await db.from('expense_categories').select('id', { count: 'exact', head: true }).like('name', 'QA FinCat%')).count
  check(left === 0, 'cleanup removed every QA category, vendor and bill', `${left} left`)
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed')
process.exit(failed ? 1 : 0)
