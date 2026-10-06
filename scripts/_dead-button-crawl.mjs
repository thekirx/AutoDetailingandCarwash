/**
 * Dead-button crawl: every persona → every sidebar page → click each visible button in <main>.
 * All writes are aborted (only GET, auth token, and read-only RPCs pass), so this is safe on the live project.
 * Flags: "dead" = click caused no DOM change, no request, no navigation and no side effect
 * (file picker, clipboard, download, window.open, print, confirm); "error" = uncaught page error on click.
 *
 *   BASE_URL=http://localhost:5173 CRAWL_PERSONAS=boss,asa node scripts/_dead-button-crawl.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'dead-buttons')
mkdirSync(outDir, { recursive: true })
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (line && !line.startsWith('#') && i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const base = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const personaIds = (process.env.CRAWL_PERSONAS || 'boss,asa,admin,opslead,tl,crew1,investor,sales,detailer,marketing,video').split(',')
const MAX_CLICKS = Number(process.env.CRAWL_MAX_CLICKS || 45)
const SKIP = /sign ?out|log ?out/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function allowed(req) {
  const m = req.method()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  const u = req.url()
  if (/\/auth\/v1\/token/.test(u)) return true
  return /\/rest\/v1\/rpc\/(get_|can_|is_|current_|accessible_|manageable_|user_has|asa_has|daily_sheet_can|staff_is)/.test(u)
}

const dead = []
const errors = []
const summary = []
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.setRequestInterception(true)
let reqCount = 0
let pageErrs = []
page.on('request', (req) => {
  reqCount += 1
  if (allowed(req)) req.continue().catch(() => null)
  else req.abort().catch(() => null)
})
page.on('pageerror', (e) => pageErrs.push(String(e?.message || e).slice(0, 200)))
page.on('dialog', (d) => d.dismiss().catch(() => null))
await page.evaluateOnNewDocument(() => {
  window.__side = 0
  const bump = () => { window.__side += 1 }
  const inClick = HTMLInputElement.prototype.click
  HTMLInputElement.prototype.click = function (...a) { if (this.type === 'file') return bump(); return inClick.apply(this, a) }
  const aClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function (...a) { bump(); return aClick.apply(this, a) }
  window.open = () => { bump(); return null }
  window.print = bump
  window.confirm = () => { bump(); return false }
  if (navigator.clipboard) {
    navigator.clipboard.writeText = async () => bump()
    navigator.clipboard.write = async () => bump()
  }
  document.addEventListener('copy', bump, true)
})

async function login(acct) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }).catch(() => null)
  const client = await page.createCDPSession()
  await client.send('Network.clearBrowserCookies').catch(() => null)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.type('input[type="email"]', acct.email, { delay: 5 })
  await page.type('input[type="password"]', acct.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), { timeout: 60000 }).catch(() => null)
  await sleep(1200)
  return isOpsAuthedUrl(page.url())
}

async function settle() {
  await page.waitForFunction(() => !(document.body?.innerText || '').toUpperCase().includes('VERIFYING ACCESS'), { timeout: 30000 }).catch(() => null)
  await sleep(1500)
}

/** In page: visible enabled buttons in main, keyed by label + occurrence. */
function listButtons() {
  const vis = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"], [hidden]')
  }
  const seen = new Map()
  const out = []
  for (const el of document.querySelectorAll('main button, main [role="button"], main [role="tab"], [role="dialog"] button')) {
    if (!vis(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue
    // Re-selecting the current tab / filter / view is a correct no-op.
    if (el.matches('[aria-pressed="true"], [aria-selected="true"], [aria-current]:not([aria-current="false"]), [data-state="active"], .rbc-active')) continue
    const label = (el.getAttribute('aria-label') || el.innerText || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 50) || `<${el.className.toString().slice(0, 30)}>`
    const n = (seen.get(label) || 0) + 1
    seen.set(label, n)
    out.push({ key: `${label}#${n}`, label, n })
  }
  return out
}

/** In page: click the n-th button with this label and arm a mutation counter that ignores its own data-* churn. */
function clickButton({ label, n }) {
  let hit = 0
  for (const el of document.querySelectorAll('main button, main [role="button"], main [role="tab"], [role="dialog"] button')) {
    const l = (el.getAttribute('aria-label') || el.innerText || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 50) || `<${el.className.toString().slice(0, 30)}>`
    if (l !== label || el.disabled) continue
    hit += 1
    if (hit !== n) continue
    window.__muts = 0
    window.__obs?.disconnect()
    window.__obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'attributes' && (m.attributeName || '').startsWith('data-') && (m.target === el || el.contains(m.target))) continue
        if (m.type === 'attributes' && m.attributeName === 'class' && (m.target === el || el.contains(m.target))) continue
        window.__muts += 1
      }
    })
    window.__obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    window.__side = 0
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }
  return false
}

try {
  for (const id of personaIds) {
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    if (!acct || !(await login(acct))) {
      errors.push({ persona: id, path: '(login)', button: '', error: 'login failed' })
      console.error('✖', id, 'login failed')
      continue
    }
    await settle()
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('.command-rail a[href^="/operations"], .floor-rail-nav a[href^="/operations"]')].map((a) => a.getAttribute('href')))])
    for (const path of links) {
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
      await settle()
      const home = new URL(page.url()).pathname
      const tested = new Set()
      let clicks = 0
      let deadHere = 0
      while (clicks < MAX_CLICKS) {
        const list = (await page.evaluate(listButtons).catch(() => [])).filter((b) => !tested.has(b.key) && !SKIP.test(b.label))
        if (!list.length) break
        const b = list[0]
        tested.add(b.key)
        clicks += 1
        reqCount = 0
        pageErrs = []
        const beforeUrl = page.url()
        const ok = await page.evaluate(clickButton, b).catch(() => false)
        if (!ok) continue
        await sleep(700)
        const state = await page.evaluate(() => ({ muts: window.__muts || 0, side: window.__side || 0 })).catch(() => ({ muts: 1, side: 0 }))
        const moved = page.url() !== beforeUrl
        if (pageErrs.length) {
          errors.push({ persona: id, path, button: b.label, error: pageErrs.join(' | ') })
          console.error('✖ error', id, path, `"${b.label}"`, pageErrs[0])
        }
        if (!moved && !state.muts && !state.side && !reqCount) {
          deadHere += 1
          dead.push({ persona: id, path, button: b.label })
          console.error('✖ dead', id, path, `"${b.label}"`)
        }
        await page.keyboard.press('Escape').catch(() => null)
        await sleep(150)
        if (new URL(page.url()).pathname !== home) {
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
          await settle()
        }
      }
      summary.push({ persona: id, path, clicks, dead: deadHere })
      console.log('✔', id, path, `${clicks} clicks · ${deadHere} dead`)
    }
  }
} finally {
  await browser.close()
}

const tag = personaIds.join('-')
writeFileSync(join(outDir, `summary-${tag}.json`), JSON.stringify({ base, dead, errors, pages: summary, at: new Date().toISOString() }, null, 2))
console.log(`\n---\npages ${summary.length} · clicks ${summary.reduce((s, p) => s + p.clicks, 0)} · dead ${dead.length} · errors ${errors.length}`)
if (dead.length || errors.length) process.exit(1)
