/**
 * Payroll deep screenshot pack (analysis only, non-destructive).
 * Boss + ASA Ã— desktop/phone Ã— every tab, both wizards to the confirm step (never confirms),
 * validation probes, Settings â†’ Payroll, My Pay (crew), denials (admin / investor / TL).
 * Evidence: e2e-evidence/payroll-deep/
 *   DEV_PORT=5293 node scripts/_payroll-deep-shots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'payroll-deep')
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
  console.log('â€¢', k, v)
}
const account = (id) => OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dismissCookie(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (btn) await btn.click().catch(() => null)
}
async function settle(page, ms = 2500) {
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
  // Real users dismiss the PWA install popup once; keep it out of the wizard shots.
  await page.evaluate(() => { try { localStorage.setItem('hakum-pwa-install-dismissed-v1', String(Date.now())); localStorage.setItem('hakum-push-prompt-v1', '1') } catch { /* */ } })
  return !/login|access-denied/.test(page.url())
}
/** True when the navy "Verifying access" gate replaced the page (auth remount wipes wizard state). */
async function gateFlipped(page) {
  return page.evaluate(() => (document.body?.innerText || '').toUpperCase().includes('VERIFYING ACCESS') || !document.querySelector('main, .hakum-payroll'))
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
/** Set a controlled React input (date / number) through the native setter so onChange fires. */
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
async function bodyText(page) {
  return page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 4000))
}
async function toasts(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role="status"]')].map((t) => (t.textContent || '').trim()).filter(Boolean))
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
      id: i.id, name: i.name, type: i.type, min: i.getAttribute('min') || '', max: i.getAttribute('max') || '', step: i.getAttribute('step') || '',
      inputmode: i.getAttribute('inputmode') || '', autocomplete: i.getAttribute('autocomplete') || '',
      labelled: Boolean(i.id && document.querySelector(`label[for="${i.id}"]`)) || Boolean(i.getAttribute('aria-label')) || Boolean(i.closest('label')),
      placeholder: i.placeholder || '', required: i.required, disabled: i.disabled,
    }))
    const iconOnlyNoAria = btns.filter((b) => b.tag === 'BUTTON' && !b.text && !b.aria).length
    const small = btns.filter((b) => b.tag === 'BUTTON' && b.h && b.h < 44).length
    const unlabelled = inputs.filter((i) => !i.labelled && i.type !== 'hidden').length
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter(vis).map((h) => `${h.tagName}:${(h.textContent || '').trim().slice(0, 60)}`)
    const scrollX = document.documentElement.scrollWidth > window.innerWidth
    return { buttons: btns, inputs, iconOnlyNoAria, small, unlabelled, headings, scrollX, url: location.href }
  })
  writeFileSync(join(outDir, `${label}.inventory.json`), JSON.stringify(data, null, 2))
  note(`${label} inventory`, `ctas=${data.buttons.length} inputs=${data.inputs.length} unlabelled=${data.unlabelled} iconOnlyNoAria=${data.iconOnlyNoAria} <44px=${data.small} scrollX=${data.scrollX}`)
  return data
}

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const port = process.env.DEV_PORT || '5293'
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
const TABS = ['home', 'run', 'cash-advance', 'packages', 'history', 'rules']

async function payrollPass(page, base, who, vp) {
  const tag = `${who}-${vp}`
  await page.setViewport(VIEWPORTS[vp])
  for (const tab of TABS) {
    await page.goto(`${base}/operations/payroll?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    await shot(page, `${tag}-${tab}`)
    await inventory(page, `${tag}-${tab}`)
  }

  // ---- Floor wizard: load proof â†’ payouts â†’ confirm (never click Confirm payroll)
  await page.goto(`${base}/operations/payroll?tab=run`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const period = await page.evaluate(() => ({
    start: document.querySelector('#payroll-start')?.value,
    end: document.querySelector('#payroll-end')?.value,
    freq: document.querySelector('#payroll-freq')?.textContent?.trim(),
  }))
  note(`${tag} floor period defaults`, JSON.stringify(period))
  // Bad range: end before start, then load
  await typeInto(page, '#payroll-end', '2020-01-01')
  const badLoad = await clickText(page, /^load pos proof/)
  await sleep(2500)
  note(`${tag} floor end<start load`, `${badLoad || 'no button'} :: toasts=${JSON.stringify(await toasts(page))} :: step=${await page.evaluate(() => document.querySelector('.hakum-payroll-steps .is-on')?.textContent?.trim())}`)
  await shot(page, `${tag}-floor-bad-range`, false)
  // Every wizard state below is reached from a fresh load and captured with ONE screenshot at the end:
  // a screenshot activates the target (hidden→visible) → auth-js SIGNED_IN → gate remount wipes the preview (gate-flip-probe.txt).
  const wizard = async (kind, name, acts) => {
    await page.goto(`${base}/operations/payroll?tab=run`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    if (kind === 'fixed') { await clickText(page, /^fixed salary/); await sleep(400) }
    else { await typeInto(page, '#payroll-start', '2026-08-01'); await typeInto(page, '#payroll-end', period.end || '2026-09-15') }
    if (name !== 'fixed-period') {
      await clickText(page, kind === 'fixed' ? /^load salaried employees/ : /^load pos proof/)
      await sleep(5000)
    }
    const out = []
    for (const act of acts) out.push(await act())
    if (await gateFlipped(page)) note(`${tag} GATE FLIP`, `${name}: preview wiped before capture`)
    const summary = await page.evaluate(() => ({
      step: document.querySelector('.hakum-payroll-steps .is-on')?.textContent?.trim() || null,
      rows: document.querySelectorAll('.hakum-payroll-row, .hakum-payroll-review').length,
      text: (document.body.innerText.match(/(Wash sales|Net payout|Salary subtotal|No payout lines|No active monthly|No commissions|Nothing to pay|total ₱)[^\n]{0,90}/g) || []).slice(0, 4),
      toasts: [...document.querySelectorAll('[data-sonner-toast], [role="status"]')].map((t) => (t.textContent || '').trim()).filter(Boolean),
    }))
    note(`${tag} ${name}`, JSON.stringify({ ...summary, acts: out.filter(Boolean) }))
    await shot(page, `${tag}-${name}`, false)
    await inventory(page, `${tag}-${name}`)
  }
  const next = async () => { const r = await clickText(page, /^next/); await sleep(700); return r ? 'next' : 'next-disabled' }
  await wizard('floor', 'floor-proof', [])
  await wizard('floor', 'floor-lines', [next])
  await wizard('floor', 'floor-pct-150', [next, async () => {
    const before = await page.evaluate(() => document.body.innerText.match(/Net payout[^\n]{0,40}/i)?.[0] || '')
    const ok = await typeInto(page, '#payroll-pct', '150'); await sleep(600)
    return ok ? `pct150 before=${before}` : 'no #payroll-pct'
  }])
  await wizard('floor', 'floor-add-line-empty', [next, async () => { const r = await clickText(page, /^add line$/); await sleep(900); return r ? 'add-line-clicked' : 'no add line button' }])
  await wizard('floor', 'floor-confirm', [next, next])
  await wizard('fixed', 'fixed-period', [])
  await wizard('fixed', 'fixed-people', [])
  await wizard('fixed', 'fixed-extras', [next])
  await wizard('fixed', 'fixed-commission-empty', [next, async () => { const r = await clickText(page, /^add commission$/); await sleep(900); return r ? 'add-commission-clicked' : 'no add commission button' }])
  await wizard('fixed', 'fixed-review', [next, next])

  // ---- Salaries (packages) empty submit
  await page.goto(`${base}/operations/payroll?tab=packages`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const pkgEmpty = await clickText(page, /^save monthly salary$/)
  await sleep(900)
  note(`${tag} salary empty submit`, `${pkgEmpty || 'no button'} :: toasts=${JSON.stringify(await toasts(page))}`)
  await shot(page, `${tag}-packages-empty-submit`, false)
  // Negative amount typed (not saved)
  await typeInto(page, '#pkg-amount', '-5000')
  await sleep(300)
  const pkgVal = await page.evaluate(() => ({ value: document.querySelector('#pkg-amount')?.value, valid: document.querySelector('#pkg-amount')?.checkValidity() }))
  note(`${tag} salary -5000 typed`, JSON.stringify(pkgVal))

  // ---- Rules: 150% wash pool typed (not saved)
  await page.goto(`${base}/operations/payroll?tab=rules`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await settle(page)
  const rulesBefore = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('input[id^="rule-"]')].map((i) => [i.id, i.value])))
  note(`${tag} rules values`, JSON.stringify(rulesBefore))
  await typeInto(page, '#rule-wash_pool_pct', '150')
  await typeInto(page, '#rule-ceramic_card_fee_pct', '-3')
  await sleep(300)
  const rulesValid = await page.evaluate(() => ({
    pct: document.querySelector('#rule-wash_pool_pct')?.value, pctValid: document.querySelector('#rule-wash_pool_pct')?.checkValidity(),
    fee: document.querySelector('#rule-ceramic_card_fee_pct')?.value, feeValid: document.querySelector('#rule-ceramic_card_fee_pct')?.checkValidity(),
    formValid: document.querySelector('#rule-wash_pool_pct')?.form?.checkValidity(),
  }))
  note(`${tag} rules 150 / -3 typed`, JSON.stringify(rulesValid))
  await shot(page, `${tag}-rules-bad-values`, false)
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
  const ONLY_WIZARD = process.env.ONLY_WIZARD === '1'
  const DENY_ONLY = process.env.DENY_ONLY === '1'
  for (const who of DENY_ONLY ? [] : WHO) {
    await page.setViewport(VIEWPORTS.desktop)
    await clearSession(page, base)
    const ok = await login(page, base, account(who))
    note(`${who} login`, ok ? page.url() : 'FAILED')
    if (!ok) continue
    await payrollPass(page, base, who, 'desktop')
    await payrollPass(page, base, who, 'phone')
    // Settings â†’ Payroll route
    await page.setViewport(VIEWPORTS.desktop)
    await page.goto(`${base}/operations/settings/payroll`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    await shot(page, `${who}-settings-payroll`)
    await inventory(page, `${who}-settings-payroll`)
    // My Pay as SA/ASA (SA should bounce to Payroll)
    await page.goto(`${base}/operations/my-pay`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page)
    note(`${who} /my-pay lands`, page.url())
  }

  // Denials: admin (BA), investor, tl
  for (const who of ONLY_WIZARD ? [] : ['admin', 'investor', 'tl']) {
    await page.setViewport(VIEWPORTS.desktop)
    await clearSession(page, base)
    const ok = await login(page, base, account(who))
    note(`${who} login`, ok ? page.url() : 'FAILED')
    if (!ok) continue
    await page.goto(`${base}/operations/payroll`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page, 1500)
    note(`${who} /payroll lands`, page.url())
    await shot(page, `${who}-payroll-route`, false)
    await page.goto(`${base}/operations/settings/payroll`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await settle(page, 1500)
    note(`${who} /settings/payroll lands`, page.url())
  }

  // My Pay as crew + detailer (desktop + phone)
  for (const who of ONLY_WIZARD ? [] : ['crew1', 'detailer']) {
    await clearSession(page, base)
    const ok = await login(page, base, account(who))
    note(`${who} login`, ok ? page.url() : 'FAILED')
    if (!ok) continue
    for (const vp of ['desktop', 'phone']) {
      await page.setViewport(VIEWPORTS[vp])
      await page.goto(`${base}/operations/my-pay`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await settle(page, 3500)
      await shot(page, `${who}-${vp}-my-pay`)
      await inventory(page, `${who}-${vp}-my-pay`)
      note(`${who} ${vp} my-pay text`, (await bodyText(page)).slice(0, 600))
    }
  }

  // Landing brand reference
  await page.setViewport(VIEWPORTS.desktop)
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
