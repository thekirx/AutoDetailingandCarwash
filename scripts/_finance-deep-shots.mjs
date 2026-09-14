/**
 * Finance + Reports deep screenshot pack (analysis only, non-destructive).
 * Boss + ASA × desktop/phone × every Finance tab, Reports blocks, validation probes.
 * Never accept/reject a close, pay a bill, send a quote, or save a category/vendor/balance.
 * Evidence: e2e-evidence/finance-deep/
 *   DEV_PORT=5295 node scripts/_finance-deep-shots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'finance-deep')
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
async function settle(page, ms = 2800) {
  await dismissCookie(page)
  await page
    .waitForFunction(() => !(document.body?.innerText || '').toUpperCase().includes('VERIFYING ACCESS'), { timeout: 30000 })
    .catch(() => null)
  await sleep(ms)
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
  await page.evaluate(() => { try { localStorage.setItem('hakum-pwa-install-dismissed-v1', String(Date.now())); localStorage.setItem('hakum-push-prompt-v1', '1') } catch { /* */ } })
  return !/login|access-denied/.test(page.url())
}
async function shot(page, name, full = true) {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full })
}
async function clickText(page, re) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, 'i')
    const el = [...document.querySelectorAll('button, [role="tab"], a')].find((b) => rx.test((b.textContent || '').trim()) && !b.disabled)
    if (el) { el.click(); return (el.textContent || '').trim().slice(0, 60) }
    return null
  }, re.source)
}
async function typeInto(page, selector, text) {
  return page.evaluate((sel, value) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const proto = Object.getPrototypeOf(el)
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    el.focus()
    if (setter) setter.call(el, String(value)); else el.value = String(value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, selector, text)
}
async function setSelect(page, selector, value) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel)
    if (!el) return false
    el.value = val
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, selector, value)
}
async function toasts(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role="status"]')].map((t) => (t.textContent || '').trim()).filter(Boolean))
}
async function shellMeta(page) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.querySelector('h1')?.textContent?.trim() || '',
    badge: [...document.querySelectorAll('.finance-role-badge, [class*="badge"]')].map((b) => (b.textContent || '').trim()).find((t) => /edit|view only/i.test(t)) || '',
    net: document.querySelector('.finance-net-value')?.textContent?.trim() || '',
    window: document.querySelector('.finance-filters-window')?.textContent?.trim() || '',
    guideOpen: Boolean(document.querySelector('[data-state="open"]')) || /how finance works/i.test(document.body.innerText) && !/open a step/i.test(document.body.innerText.slice(0, 400)),
    tabs: [...document.querySelectorAll('[role="tab"]')].map((t) => ({
      text: (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      clipped: t.getBoundingClientRect().right > window.innerWidth - 4,
      w: Math.round(t.getBoundingClientRect().width),
    })),
    denied: /access denied|lane closed|forbidden/i.test(document.body.innerText.slice(0, 800)),
  }))
}
async function inventory(page, label) {
  const data = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const btns = [...document.querySelectorAll('button, a[href]')].filter(vis).map((b) => ({
      tag: b.tagName,
      text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      aria: b.getAttribute('aria-label') || '',
      href: b.getAttribute('href') || '',
      disabled: Boolean(b.disabled),
      h: Math.round(b.getBoundingClientRect().height),
      w: Math.round(b.getBoundingClientRect().width),
    }))
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).map((i) => ({
      id: i.id, name: i.name, type: i.type, min: i.getAttribute('min') || '', max: i.getAttribute('max') || '',
      labelled: Boolean(i.id && document.querySelector(`label[for="${i.id}"]`)) || Boolean(i.getAttribute('aria-label')) || Boolean(i.closest('label')),
      placeholder: i.placeholder || '', required: i.required, disabled: i.disabled,
    }))
    return {
      buttons: btns,
      inputs,
      iconOnlyNoAria: btns.filter((b) => b.tag === 'BUTTON' && !b.text && !b.aria).length,
      small: btns.filter((b) => b.tag === 'BUTTON' && b.h && b.h < 44).length,
      unlabelled: inputs.filter((i) => !i.labelled && i.type !== 'hidden').length,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map((h) => `${h.tagName}:${(h.textContent || '').trim().slice(0, 60)}`),
      scrollX: document.documentElement.scrollWidth > window.innerWidth,
      url: location.href,
    }
  })
  writeFileSync(join(outDir, `${label}.inventory.json`), JSON.stringify(data, null, 2))
  note(`${label} inventory`, `ctas=${data.buttons.length} inputs=${data.inputs.length} unlabelled=${data.unlabelled} iconOnlyNoAria=${data.iconOnlyNoAria} <44px=${data.small} scrollX=${data.scrollX}`)
  return data
}

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const port = process.env.DEV_PORT || '5295'
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
const TABS = [
  'overview',
  'sales',
  'purchases',
  'pl',
  'shift-close',
  'expense-reports',
  'vendors',
  'quotes',
  'corporate',
  'categories',
  'reports',
]
const REPORT_BLOCKS = [
  { slug: 'best-sellers', title: /best sellers/i },
  { slug: 'shift-attestation', title: /shift close attestation/i },
  { slug: 'sales-report', title: /sales report/i },
  { slug: 'operations', title: /operations report/i },
  { slug: 'retention', title: /customer retention/i },
]

async function financePass(page, base, who, vp) {
  const tag = `${who}-${vp}`
  await page.setViewport(VIEWPORTS[vp])
  for (const tab of TABS) {
    await page.goto(`${base}/operations/finance?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page, tab === 'reports' ? 4500 : 2800)
    const meta = await shellMeta(page)
    note(`${tag} ${tab} meta`, JSON.stringify(meta))
    await shot(page, `${tag}-${tab}`)
    await inventory(page, `${tag}-${tab}`)
    if (tab === 'reports') {
      for (const block of REPORT_BLOCKS) {
        const found = await page.evaluate((src) => {
          const rx = new RegExp(src, 'i')
          const el = [...document.querySelectorAll('h2,h3,h4,[class*="title"]')].find((n) => rx.test((n.textContent || '').trim()))
          if (!el) return false
          el.scrollIntoView({ block: 'start' })
          return true
        }, block.title.source)
        await sleep(400)
        note(`${tag} reports ${block.slug}`, found ? 'scrolled' : 'missing')
        await shot(page, `${tag}-reports-${block.slug}`, false)
      }
    }
  }

  if (who === 'boss') {
    for (const tab of ['overview', 'sales', 'pl', 'shift-close', 'reports']) {
      await page.goto(`${base}/operations/finance?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await settle(page, 2000)
      await setSelect(page, '#finance-preset-filter', 'last_month')
      await sleep(300)
      await clickText(page, /^refresh$/)
      await settle(page, tab === 'reports' ? 4500 : 3200)
      const lastMeta = await shellMeta(page)
      note(`${tag} last_month ${tab}`, JSON.stringify(lastMeta))
      await shot(page, `${tag}-${tab}-last-month`)
      await inventory(page, `${tag}-${tab}-last-month`)
    }
  }
}

async function probeValidation(page, base, who) {
  const tag = `${who}-desktop`
  await page.setViewport(VIEWPORTS.desktop)

  // Inverted custom range (no persist — just load)
  await page.goto(`${base}/operations/finance?tab=overview`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const presetOk = await setSelect(page, '#finance-preset-filter', 'custom')
  await sleep(400)
  await typeInto(page, '#finance-start', '2026-09-01')
  await typeInto(page, '#finance-end', '2020-01-01')
  await sleep(400)
  const refreshed = await clickText(page, /^refresh$/)
  await sleep(2500)
  const rangeMeta = await page.evaluate(() => ({
    start: document.querySelector('#finance-start')?.value,
    end: document.querySelector('#finance-end')?.value,
    window: document.querySelector('.finance-filters-window')?.textContent?.trim() || '',
    net: document.querySelector('.finance-net-value')?.textContent?.trim() || '',
  }))
  note(`${tag} inverted custom range`, JSON.stringify({ presetOk, refreshed, ...rangeMeta, toasts: await toasts(page) }))
  await shot(page, `${tag}-inverted-range`, false)

  const emptySubmit = async (tab, re, name) => {
    await page.goto(`${base}/operations/finance?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    const clicked = await clickText(page, re)
    await sleep(900)
    note(`${tag} ${name}`, `${clicked || 'no button'} :: toasts=${JSON.stringify(await toasts(page))}`)
    await shot(page, `${tag}-${name}`, false)
  }

  await page.goto(`${base}/operations/finance?tab=purchases`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const openedBill = await clickText(page, /^new bill$/)
  await sleep(500)
  const savedBill = await clickText(page, /^save bill$/)
  await sleep(900)
  note(`${tag} bill-empty-submit`, `open=${openedBill || 'no'} save=${savedBill || 'no'} :: toasts=${JSON.stringify(await toasts(page))}`)
  await shot(page, `${tag}-bill-empty-submit`, false)

  await emptySubmit('vendors', /^add vendor$/, 'vendor-empty-submit')
  await emptySubmit('quotes', /^send quotation$/, 'quote-empty-submit')
  await emptySubmit('categories', /^add$/, 'category-empty-submit')
  await emptySubmit('corporate', /^save balance$/, 'corporate-empty-submit')
  await emptySubmit('expense-reports', /^save draft/, 'expense-report-empty-submit')

  await page.goto(`${base}/operations/finance?tab=shift-close`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  await typeInto(page, '#shift-review-note', '')
  const rejected = await clickText(page, /^reject$/)
  await sleep(900)
  note(`${tag} reject-without-note`, `${rejected || 'no reject'} :: toasts=${JSON.stringify(await toasts(page))}`)
  await shot(page, `${tag}-reject-no-note`, false)

  await page.goto(`${base}/operations/reports`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page, 1500)
  note(`${tag} /operations/reports lands`, page.url())
  await shot(page, `${tag}-legacy-reports-redirect`, false)
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

  const WHO = (process.env.WHO || 'boss,asa').split(',').filter(Boolean)
  for (const who of WHO) {
    await page.setViewport(VIEWPORTS.desktop)
    await clearSession(page, base)
    const ok = await login(page, base, account(who))
    note(`${who} login`, ok ? page.url() : 'FAILED')
    if (!ok) continue
    await financePass(page, base, who, 'desktop')
    await financePass(page, base, who, 'phone')
    await probeValidation(page, base, who)
  }

  const landingRef = join(root, 'e2e-evidence', 'pos-deep', 'brand-landing-ref.png')
  await page.setViewport(VIEWPORTS.desktop)
  if (existsSync(landingRef)) {
    note('brand-landing-ref', 'reused pos-deep/brand-landing-ref.png')
  } else {
    await page.goto(`${base}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    await shot(page, 'brand-landing-ref', false)
  }

  await browser.close()
} catch (e) {
  note('fatal', e?.message || String(e))
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}
writeFileSync(join(outDir, 'log.json'), JSON.stringify(log, null, 2))
console.log('done', log.length, 'notes')
