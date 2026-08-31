/**
 * Capture ops + public pages at desktop (1440) and mobile (375).
 * Usage:
 *   BASE_URL=http://127.0.0.1:5173 node scripts/screenshot-audit.mjs
 *   node scripts/screenshot-audit.mjs --public-only   # skip auth pages
 *
 * Auth (required for ops): AUDIT_EMAIL + AUDIT_PASSWORD for Super Admin session.
 * Without auth, only public routes are captured (or fail if ops expected).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isLoginWallUrl, isOpsAuthedUrl } from './screenshotAuth.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const stamp = '2026-08-31'
const outDir = join(root, 'docs/audits', stamp, 'screenshots')
mkdirSync(outDir, { recursive: true })

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const publicOnly = process.argv.includes('--public-only')
const email = process.env.AUDIT_EMAIL || process.env.VITE_AUDIT_EMAIL || ''
const password = process.env.AUDIT_PASSWORD || process.env.VITE_AUDIT_PASSWORD || ''

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]

const PUBLIC_ROUTES = [
  { slug: 'home', path: '/home' },
  { slug: 'services', path: '/services' },
  { slug: 'packages', path: '/packages' },
  { slug: 'book', path: '/book' },
  { slug: 'queue', path: '/queue' },
  { slug: 'branches', path: '/branches' },
  { slug: 'contact', path: '/contact' },
  { slug: 'events', path: '/events' },
  { slug: 'blog', path: '/blog' },
]

const OPS_ROUTES = [
  { slug: 'console', path: '/operations/console' },
  { slug: 'dashboard', path: '/operations/dashboard' },
  { slug: 'queue', path: '/operations/queue' },
  { slug: 'crew', path: '/operations/crew' },
  { slug: 'attendance--clock', path: '/operations/attendance' },
  { slug: 'attendance--register', path: '/operations/attendance?tab=register' },
  { slug: 'attendance--settings', path: '/operations/attendance?tab=settings' },
  { slug: 'kpi--crew', path: '/operations/kpi' },
  { slug: 'kpi--compare', path: '/operations/kpi?tab=compare' },
  { slug: 'kpi--service', path: '/operations/kpi?tab=service' },
  { slug: 'kpi--sales', path: '/operations/kpi?tab=sales' },
  { slug: 'pos', path: '/operations/pos' },
  { slug: 'inventory', path: '/operations/inventory' },
  { slug: 'bookings', path: '/operations/bookings' },
  { slug: 'finance--overview', path: '/operations/finance' },
  { slug: 'finance--sales', path: '/operations/finance?tab=sales' },
  { slug: 'finance--purchases', path: '/operations/finance?tab=purchases' },
  { slug: 'finance--pl', path: '/operations/finance?tab=pl' },
  { slug: 'finance--shift-close', path: '/operations/finance?tab=shift-close' },
  { slug: 'finance--expense-reports', path: '/operations/finance?tab=expense-reports' },
  { slug: 'finance--reports', path: '/operations/finance?tab=reports' },
  { slug: 'payroll', path: '/operations/payroll' },
  { slug: 'crm', path: '/operations/crm' },
  { slug: 'planning', path: '/operations/planning' },
  { slug: 'settings', path: '/operations/settings' },
  { slug: 'people', path: '/operations/people' },
  { slug: 'branches', path: '/operations/branches' },
  { slug: 'cars', path: '/operations/cars' },
  { slug: 'audit', path: '/operations/audit' },
  { slug: 'data-center', path: '/operations/data-center' },
  { slug: 'notifications', path: '/operations/notifications' },
]

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 200))
}

async function shot(page, route, viewport) {
  const name = `${route.slug}--${viewport.name}.png`
  const file = join(outDir, name)
  try {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2', timeout: 45000 })
    await dismissCookieBanner(page)
    await new Promise((r) => setTimeout(r, 800))
    const url = page.url()
    // Ops routes must not silently capture the login wall.
    if (route.path.startsWith('/operations') && isLoginWallUrl(url)) {
      return { ok: false, file: name, error: `login wall at ${url}` }
    }
    await page.screenshot({ path: file, fullPage: true })
    return { ok: true, file: name, url }
  } catch (err) {
    return { ok: false, file: name, error: String(err?.message || err) }
  }
}

async function tryLogin(page) {
  if (!email || !password) return false
  await page.goto(`${BASE}/operations/login`, { waitUntil: 'networkidle2', timeout: 45000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"], input[name="password"]')
  if (!emailSel || !passSel) return false
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 10 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 10 })
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(
      () => {
        const p = location.pathname
        return p.startsWith('/operations') && !p.includes('/login')
      },
      { timeout: 45000 },
    ).catch(() => null),
  ])
  await new Promise((r) => setTimeout(r, 500))
  return isOpsAuthedUrl(page.url())
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
const results = []

let authed = false
if (!publicOnly) {
  try {
    authed = await tryLogin(page)
    if (!authed && email && password) {
      results.push({
        ok: false,
        step: 'login',
        error: `login failed — still at ${page.url()} (cookie banner dismissed; check credentials)`,
      })
    }
  } catch (err) {
    results.push({ ok: false, step: 'login', error: String(err?.message || err) })
  }
}

const routes = [...PUBLIC_ROUTES.map((r) => ({ ...r, slug: `public--${r.slug}` }))]
if (authed) routes.push(...OPS_ROUTES)
else if (!publicOnly) {
  results.push({
    ok: false,
    step: 'auth',
    error: 'Ops screenshots skipped — set AUDIT_EMAIL / AUDIT_PASSWORD or pass --public-only',
  })
}

for (const viewport of VIEWPORTS) {
  for (const route of routes) {
    results.push(await shot(page, route, viewport))
  }
}

await browser.close()

const failed = results.filter((r) => r.ok === false)
const summary = {
  ok: failed.length === 0,
  base: BASE,
  outDir: `docs/audits/${stamp}/screenshots`,
  captured: results.filter((r) => r.ok).length,
  failed: failed.length,
  authed,
  results,
}
writeFileSync(join(root, 'docs/audits', stamp, 'screenshots-manifest.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
process.exit(failed.length > 0 ? 1 : 0)
