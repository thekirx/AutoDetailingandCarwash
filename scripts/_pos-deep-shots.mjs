/**
 * POS deep screenshot pack (analysis only, non-destructive).
 * Admin + Boss × desktop/phone × every tab, cart sheet, checkout, EoS wizard, settings.
 * Evidence: e2e-evidence/pos-deep/
 *   DEV_PORT=5292 node scripts/_pos-deep-shots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'pos-deep')
mkdirSync(outDir, { recursive: true })

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    if (!process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const log = []
const note = (k, v = '') => {
  log.push({ k, v })
  console.log('•', k, v)
}
const account = (id) => OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dismissCookie(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (btn) await btn.click().catch(() => null)
}
async function settle(page) {
  await dismissCookie(page)
  await page
    .waitForFunction(() => !(document.body?.innerText || '').toUpperCase().includes('VERIFYING ACCESS'), { timeout: 30000 })
    .catch(() => null)
  await sleep(3000)
}
async function clearSession(page, base) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(300)
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch { /* */ } }).catch(() => null)
  try { const c = await page.createCDPSession(); await c.send('Network.clearBrowserCookies') } catch { /* */ }
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
}
async function login(page, base, acct) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookie(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const e = await page.$('input[type="email"], input[name="email"]')
  const p = await page.$('input[type="password"], input[name="password"]')
  await e.click({ clickCount: 3 }); await e.type(acct.email, { delay: 4 })
  await p.click({ clickCount: 3 }); await p.type(acct.password, { delay: 4 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), { timeout: 60000 }).catch(() => null)
  await sleep(800)
  return !/login|access-denied/.test(page.url())
}
async function shot(page, name, full = true) {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full })
}
async function clickText(page, re) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, 'i')
    const el = [...document.querySelectorAll('button, [role="tab"], a')].find((b) => rx.test((b.textContent || '').trim()))
    if (el) { el.click(); return (el.textContent || '').trim().slice(0, 60) }
    return null
  }, re.source)
}
async function inventory(page, label) {
  const data = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const btns = [...document.querySelectorAll('button')].filter(vis).map((b) => ({
      text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
      aria: b.getAttribute('aria-label') || '',
      disabled: b.disabled,
      h: Math.round(b.getBoundingClientRect().height),
      w: Math.round(b.getBoundingClientRect().width),
    }))
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).map((i) => ({
      id: i.id, name: i.name, type: i.type, inputmode: i.getAttribute('inputmode') || '', autocomplete: i.getAttribute('autocomplete') || '',
      labelled: Boolean(i.id && document.querySelector(`label[for="${i.id}"]`)) || Boolean(i.getAttribute('aria-label')) || Boolean(i.closest('label')),
      placeholder: i.placeholder || '', required: i.required,
    }))
    const iconOnlyNoAria = btns.filter((b) => !b.text && !b.aria).length
    const small = btns.filter((b) => b.h && b.h < 44).length
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map((h) => `${h.tagName}:${(h.textContent || '').trim().slice(0, 50)}`)
    const scrollX = document.documentElement.scrollWidth > window.innerWidth
    return { buttons: btns, inputs, iconOnlyNoAria, small, headings, scrollX, url: location.href }
  })
  writeFileSync(join(outDir, `${label}.inventory.json`), JSON.stringify(data, null, 2))
  note(`${label} inventory`, `buttons=${data.buttons.length} inputs=${data.inputs.length} iconOnlyNoAria=${data.iconOnlyNoAria} <44px=${data.small} scrollX=${data.scrollX}`)
  return data
}

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const port = process.env.DEV_PORT || '5292'
  const base = `http://127.0.0.1:${port}`
  const isWin = process.platform === 'win32'
  const child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, env: process.env })
  let ready = false
  for (let i = 0; i < 90 && !ready; i++) {
    await sleep(500)
    try { const r = await fetch(base, { signal: AbortSignal.timeout(2000) }); if (r.ok || r.status === 404) ready = true } catch { /* */ }
  }
  if (!ready) throw new Error('vite not ready')
  return { base, stop: async () => { try { if (isWin && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true }); else child.kill('SIGTERM') } catch { /* */ } } }
}

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true } }

async function posPass(page, base, who, vp) {
  const tag = `${who}-${vp}`
  await page.setViewport(VIEWPORTS[vp])
  for (const tab of ['checkout', 'pending', 'expenses', 'dashboard', 'settings']) {
    await page.goto(`${base}/operations/pos?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    await shot(page, `${tag}-${tab}`)
    await inventory(page, `${tag}-${tab}`)
  }
  // Sell: add first catalog item → open cart → screenshot checkout panel
  await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const added = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[aria-label^="Add "]')]
    const card = btns[0]
    if (card) { card.click(); return `${card.getAttribute('aria-label')} (of ${btns.length} tiles)` }
    return null
  })
  note(`${tag} add item`, added || 'no catalog add button found')
  await sleep(600)
  await page.evaluate(() => { const b = document.querySelector('button[aria-label^="Add "]'); b?.click() })
  await sleep(400)
  await shot(page, `${tag}-sell-after-add`)
  if (vp === 'phone') {
    const cartOpened = await clickText(page, /^cart ·/)
    note(`${tag} open cart`, cartOpened || 'no cart trigger')
    await sleep(900)
  }
  await shot(page, `${tag}-cart`, vp !== 'phone')
  await inventory(page, `${tag}-cart`)
  // Open discount & customer disclosure
  const disc = await clickText(page, /^discount & customer/)
  note(`${tag} discount panel`, disc || 'none')
  await sleep(600)
  await shot(page, `${tag}-discount-customer`, vp !== 'phone')
  await inventory(page, `${tag}-discount-customer`)
  // Bad discount: 150%
  const discSet = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].find((i) => /discount/i.test(i.id + i.name + (i.getAttribute('aria-label') || '') + (document.querySelector(`label[for="${i.id}"]`)?.textContent || '')))
    if (!el) return null
    el.focus(); el.value = ''
    return el.id || el.name || el.placeholder
  })
  if (discSet) { await page.keyboard.type('150'); await sleep(400) }
  note(`${tag} discount 150 into`, discSet || 'no discount input')
  await shot(page, `${tag}-discount-overflow`, vp !== 'phone')
  // Charge with cash tender empty → validation
  const payClicked = await clickText(page, /^charge/)
  note(`${tag} charge w/o cash`, payClicked || 'no charge button')
  await sleep(900)
  await shot(page, `${tag}-charge-no-cash`, vp !== 'phone')
  await page.keyboard.press('Escape').catch(() => null)
  // Expenses validation: submit empty
  await page.goto(`${base}/operations/pos?tab=expenses`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const exp = await clickText(page, /record expense/)
  note(`${tag} expense empty submit`, exp || 'no button')
  await sleep(500)
  await shot(page, `${tag}-expense-validation`, false)
  // EoS wizard
  await page.goto(`${base}/operations/pos?tab=dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const eos = await clickText(page, /end of shift/)
  note(`${tag} eos`, eos || 'no EoS button')
  await sleep(1200)
  await shot(page, `${tag}-eos-step1`, false)
  await inventory(page, `${tag}-eos`)
  const next = await clickText(page, /^next|continue/)
  note(`${tag} eos next`, next || 'no next')
  await sleep(700)
  await shot(page, `${tag}-eos-step2`, false)
  await page.keyboard.press('Escape').catch(() => null)
}

let server
try {
  server = await ensurePreview()
  const { base } = server
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  page.on('pageerror', (e) => note('pageerror', e.message))
  page.on('response', async (res) => {
    if (res.status() < 400 || !/supabase/.test(res.url())) return
    let body = ''
    try { body = (await res.text()).slice(0, 200) } catch { /* */ }
    note(`http ${res.status()}`, `${res.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 160)} :: ${body}`)
  })

  for (const who of ['admin', 'boss']) {
    await page.setViewport(VIEWPORTS.desktop)
    await clearSession(page, base)
    const ok = await login(page, base, account(who))
    note(`${who} login`, ok ? page.url() : 'FAILED')
    if (!ok) continue
    await posPass(page, base, who, 'desktop')
    await posPass(page, base, who, 'phone')
  }
  // Settings route (full page)
  await page.setViewport(VIEWPORTS.desktop)
  await page.goto(`${base}/operations/settings/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  await shot(page, 'boss-settings-pos-route')
  await inventory(page, 'boss-settings-pos-route')
  // Landing brand reference
  await page.goto(`${base}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  await shot(page, 'brand-landing-ref', false)
  await browser.close()
} catch (e) {
  note('fatal', e?.message || String(e))
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}
writeFileSync(join(outDir, 'log.json'), JSON.stringify(log, null, 2))
console.log('done', log.length, 'notes')
