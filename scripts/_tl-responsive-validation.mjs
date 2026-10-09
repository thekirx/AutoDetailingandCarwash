/* global document, window, location, getComputedStyle */
/**
 * Read-only responsive validation of Team Lead pages (+ BA Bookings, SA Branches) across the
 * 8-viewport matrix and one landscape phone. Real logins, real data, writes blocked.
 *   BASE_URL=http://localhost:5173 node scripts/_tl-responsive-validation.mjs
 *   SHOTS_ONLY=tl node scripts/_tl-responsive-validation.mjs
 * Fails on: horizontal overflow, touch target < 44px (≤1024 wide), form control font < 16px
 * on phones (iOS focus zoom), page error, Supabase 5xx, blocked write, access denied.
 * Evidence: e2e-evidence/responsive-validation/<viewport>/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../src/lib/cookieConsent.js'
import { DISMISS_KEY as INSTALL_DISMISS_KEY } from '../src/lib/installApp.js'

const base = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const outRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e-evidence', 'responsive-validation')

const PAGES = {
  tl: [
    ['bookings', '/operations/bookings'],
    ['bookings-maintenance', '/operations/bookings?stage=maintenance'],
    ['queue', '/operations/queue'],
    ['queue-new', '/operations/queue/new'],
    ['attendance', '/operations/attendance'],
  ],
  admin: [['bookings', '/operations/bookings']],
  // Third item: button text to click before auditing (opens a modal).
  boss: [
    ['branches', '/operations/branches'],
    ['branches-new', '/operations/branches', 'New branch'],
    ['services', '/operations/inventory?tab=bay'],
    ['services-new', '/operations/inventory?tab=bay', 'Add service or package'],
    ['memberships-tiers', '/operations/memberships?tab=tiers'],
    ['memberships-tier-new', '/operations/memberships?tab=tiers', 'Add premium tier'],
    ['finance-vendors', '/operations/finance?tab=vendors'],
    ['finance-vendor-new', '/operations/finance?tab=vendors', 'Add vendor'],
    ['notifications', '/operations/notifications'],
    ['notifications-rule-new', '/operations/notifications', 'New reminder'],
    ['sms', '/operations/crm?tab=sms'],
    ['sms-template-new', '/operations/crm?tab=sms', 'New template'],
    ['planning-events', '/operations/planning?tab=events'],
    ['planning-event-new', '/operations/planning?tab=events', 'New event'],
  ],
}
const VIEWPORTS = [
  { dir: 'mobile-375', width: 375, height: 667, touch: true, phone: true },
  { dir: 'mobile-393', width: 393, height: 852, touch: true, phone: true },
  { dir: 'mobile-430', width: 430, height: 932, touch: true, phone: true },
  { dir: 'tablet-768', width: 768, height: 1024, touch: true },
  { dir: 'tablet-1024', width: 1024, height: 1366, touch: true },
  { dir: 'desktop-1280', width: 1280, height: 800 },
  { dir: 'desktop-1440', width: 1440, height: 900 },
  { dir: 'desktop-1920', width: 1920, height: 1080 },
  { dir: 'landscape-667x375', width: 667, height: 375, touch: true, phone: true },
]
const only = process.env.SHOTS_ONLY ? new Set(process.env.SHOTS_ONLY.split(',')) : null
const vpOnly = process.env.VIEWPORTS_ONLY ? new Set(process.env.VIEWPORTS_ONLY.split(',')) : null
const pageOnly = process.env.PAGES_ONLY ? new Set(process.env.PAGES_ONLY.split(',')) : null

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

function isWrite(req) {
  const u = req.url()
  const m = req.method()
  if (/\/api\/(notify|booking-status|maintenance-schedules)/.test(u) && m !== 'GET' && m !== 'OPTIONS') return true
  if (/\/storage\/v1\/object\//.test(u) && m !== 'GET' && !/\/object\/sign\//.test(u)) return true
  if (/\/rest\/v1\/rpc\/(save|submit|review|reopen)_daily_sheet|\/rest\/v1\/rpc\/complete_pos_sale/.test(u)) return true
  return /\/rest\/v1\/(?!rpc\/)/.test(u) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(m)
}

/** Runs in the page: layout + touch + typography audit. */
function audit({ touch, phone }) {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    if (el.closest('[aria-hidden="true"], .sr-only, [hidden]')) return false
    return true
  }
  const label = (el) =>
    (el.getAttribute('aria-label') || el.innerText || el.value || el.name || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const small = []
  if (touch) {
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]'
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue
      if (el.disabled) continue
      const cs = getComputedStyle(el)
      // Inline links inside running text are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p, li')) continue
      // Draggable map pin: tapping anywhere on the map moves it too, so the pin is not the only target.
      if (el.classList.contains('leaflet-marker-icon')) continue
      // Map tile credits are required attribution text, not actions.
      if (el.closest('.leaflet-control-attribution')) continue
      let r = el.getBoundingClientRect()
      // A wrapping label focuses/toggles its input, so the label is the hit area (not for select popups).
      if (el.tagName === 'INPUT' && el.closest('label')) {
        r = el.closest('label').getBoundingClientRect()
      }
      if (r.width < 43.5 || r.height < 43.5) {
        small.push(`${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
  }
  const smallFonts = []
  if (phone) {
    for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea')) {
      if (!visible(el)) continue
      const px = parseFloat(getComputedStyle(el).fontSize)
      if (px < 16) smallFonts.push(`${el.tagName.toLowerCase()} "${label(el)}" ${px}px`)
    }
  }
  // Clipped overflow: page scrollWidth misses boxes cut off by an overflow:hidden parent.
  const clipped = []
  for (const el of document.querySelectorAll('main *, [role="dialog"] *')) {
    const r = el.getBoundingClientRect()
    if (r.right <= window.innerWidth + 2 || !visible(el)) continue
    let scroller = false
    for (let n = el.parentElement; n; n = n.parentElement) {
      // Only deliberate horizontal scrollers (a vertical scroller also computes overflow-x:auto),
      // plus map tile panes, which overdraw their clipped container by design.
      if (n.classList.contains('overflow-x-auto') || n.matches('[role="tablist"], [data-slot="table-container"], .finance-tabs-rail, .leaflet-container')) { scroller = true; break }
    }
    if (!scroller) clipped.push(`${el.tagName.toLowerCase()} "${label(el).slice(0, 24)}" right=${Math.round(r.right)}`)
  }
  return {
    url: location.pathname + location.search,
    overflow: Math.max(document.documentElement.scrollWidth - window.innerWidth, clipped.length ? 99 : 0),
    clipped: clipped.slice(0, 3),
    denied: /access-denied/.test(location.pathname),
    loading: /Loading…|Loading maintenance/.test(document.querySelector('main')?.innerText || ''),
    small,
    smallFonts,
  }
}

const report = []
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 })
try {
  for (const [id, pages] of Object.entries(PAGES)) {
    if (only && !only.has(id)) continue
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.setDefaultNavigationTimeout(90000)
    const problems = []
    page.on('pageerror', (e) => problems.push(`pageerror ${e.message.slice(0, 120)}`))
    page.on('response', (r) => {
      if (/supabase\.co\//.test(r.url()) && r.status() >= 500) problems.push(`${r.status()} ${r.url().slice(-80)}`)
    })
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (isWrite(req)) {
        problems.push(`write ${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)}`)
        return req.abort()
      }
      return req.continue()
    })
    await page.setViewport({ width: 1440, height: 900 })
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((k, v, ik) => {
      localStorage.setItem(k, v)
      localStorage.setItem(ik, String(Date.now()))
    }, COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, choice: 'necessary', at: new Date().toISOString() }), INSTALL_DISMISS_KEY)
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', acct.email)
    await page.type('input[type="password"]', acct.password)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })

    for (const [name, url, clickText] of pages) {
      if (pageOnly && !pageOnly.has(name)) continue
      for (const vp of VIEWPORTS) {
        if (vpOnly && !vpOnly.has(vp.dir)) continue
        problems.length = 0
        const dir = join(outRoot, vp.dir)
        mkdirSync(dir, { recursive: true })
        await page.setViewport({ width: vp.width, height: vp.height, isMobile: Boolean(vp.touch), hasTouch: Boolean(vp.touch) })
        await page.goto(`${base}${url}`, { waitUntil: 'networkidle2' }).catch(() => null)
        await page.waitForFunction(() => document.querySelector('main h1, main h2'), { timeout: 30000 }).catch(() => null)
        await new Promise((r) => setTimeout(r, 1200))
        if (clickText) {
          const opened = await page.evaluate((text) => {
            const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === text)
            btn?.click()
            return Boolean(btn)
          }, clickText)
          if (!opened) problems.push(`no "${clickText}" button`)
          await new Promise((r) => setTimeout(r, 900))
        }
        const state = await page.evaluate(audit, { touch: vp.touch, phone: vp.phone })
        const stem = `${id}-${name}`
        // Capture only: unroll inner scroll containers so fullPage shows everything (audit already ran).
        // Modals stay as rendered (viewport shot) — unrolling would push a centered dialog off-screen.
        if (!clickText) await page.evaluate(() => {
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el)
            if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 2) continue
            for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
              n.style.setProperty('height', 'auto', 'important')
              n.style.setProperty('max-height', 'none', 'important')
              n.style.setProperty('overflow-y', 'visible', 'important')
            }
          }
        })
        await page.screenshot({ path: join(dir, `${stem}-full-page.png`), fullPage: !clickText })
        const tree = await page.accessibility.snapshot({ interestingOnly: true }).catch(() => null)
        writeFileSync(join(dir, `${stem}-accessibility-tree.txt`), JSON.stringify(tree, null, 1))
        writeFileSync(
          join(dir, `${stem}-touch-targets.md`),
          `# ${stem} @ ${vp.dir}\n\nTouch targets under 44px: ${state.small.length}\n\n${state.small.map((s) => `- ${s}`).join('\n')}\n\nForm controls under 16px (phone): ${state.smallFonts.length}\n\n${state.smallFonts.map((s) => `- ${s}`).join('\n')}\n`,
        )
        const issues = [...problems]
        if (state.overflow > 2) issues.push(`overflow ${state.overflow}px ${state.clipped.join('; ')}`)
        if (state.denied) issues.push('access denied')
        if (state.loading) issues.push('still loading')
        if (state.small.length) issues.push(`${state.small.length} small targets: ${state.small.slice(0, 4).join('; ')}`)
        if (state.smallFonts.length) issues.push(`${state.smallFonts.length} inputs <16px: ${state.smallFonts.slice(0, 3).join('; ')}`)
        report.push({ id, name, viewport: vp.dir, ...state, problems: [...problems], ok: !issues.length })
        check(`${stem} @${vp.dir}`, !issues.length, issues.join(' | '))
      }
    }
    await ctx.close()
  }
} catch (err) {
  check('validation finished', false, err.stack?.split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close().catch(() => null)
}

mkdirSync(outRoot, { recursive: true })
writeFileSync(join(outRoot, 'results.json'), JSON.stringify(report, null, 1))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`)
process.exit(failed.length ? 1 : 0)
