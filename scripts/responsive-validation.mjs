/**
 * Responsive validation across 8 viewports + landscape.
 * Evidence: e2e-evidence/responsive/
 * Report: docs/qa/responsive-report.md
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/responsive-validation.mjs
 *   Or omit BASE_URL — builds + starts vite preview.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isLoginWallUrl, isOpsAuthedUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'responsive')
mkdirSync(outDir, { recursive: true })

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const VIEWPORTS = [
  { id: 'mobile-375', width: 375, height: 667, dpr: 2, flags: ['mobile', 'touch'] },
  { id: 'mobile-393', width: 393, height: 852, dpr: 3, flags: ['mobile', 'touch'] },
  { id: 'mobile-430', width: 430, height: 932, dpr: 3, flags: ['mobile', 'touch'] },
  { id: 'tablet-768', width: 768, height: 1024, dpr: 2, flags: ['mobile', 'touch'] },
  { id: 'tablet-1024', width: 1024, height: 1366, dpr: 2, flags: ['mobile', 'touch'] },
  { id: 'laptop-1280', width: 1280, height: 800, dpr: 1, flags: [] },
  { id: 'desktop-1440', width: 1440, height: 900, dpr: 1, flags: [] },
  { id: 'wide-1920', width: 1920, height: 1080, dpr: 1, flags: [] },
  { id: 'landscape-667x375', width: 667, height: 375, dpr: 2, flags: ['mobile', 'touch', 'landscape'] },
]

const PAGES = [
  { id: 'home', path: '/home', auth: null },
  { id: 'book', path: '/book', auth: null },
  { id: 'queue', path: '/operations/queue', auth: 'tl' },
  { id: 'pos', path: '/operations/pos', auth: 'admin' },
  { id: 'account', path: '/account', auth: 'customer' },
]

const cells = []

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 150))
}

async function clearSession(page, base) {
  const target = `${base}/signin`
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  }).catch(() => null)
  const client = await page.createCDPSession()
  await client.send('Network.clearBrowserCookies')
}

async function opsLogin(page, base, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"], input[name="password"]')
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 5 })
  await Promise.all([
    page.click('button[type="submit"]'),
    page
      .waitForFunction(
        () => location.pathname.startsWith('/operations') && !location.pathname.includes('/login'),
        { timeout: 60000 },
      )
      .catch(() => null),
  ])
  return isOpsAuthedUrl(page.url())
}

async function customerLogin(page, base, email, password) {
  await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await new Promise((r) => setTimeout(r, 500))
  const usedChip = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('.hakum-demo-chip')].find((b) =>
      /demo\.customer|Demo customer/i.test(b.textContent || ''),
    )
    if (chip) {
      chip.click()
      return true
    }
    return false
  })
  if (usedChip) {
    await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 }).catch(() => null)
    if (page.url().includes('/account')) return true
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Use email or plate instead/i.test(b.textContent || ''),
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  const emailSel = await page.$('input:not([type="password"]):not([type="hidden"])')
  const passSel = await page.$('input[type="password"]')
  if (!emailSel || !passSel) return false
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 }).catch(() => null)
  return page.url().includes('/account')
}

async function ensureAuth(page, base, auth) {
  if (!auth) return true
  if (auth === 'customer') {
    await clearSession(page, base)
    return customerLogin(page, base, CUSTOMER_DEMO_ACCOUNT.email, CUSTOMER_DEMO_ACCOUNT.password)
  }
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === auth) || OPS_DEMO_ACCOUNTS.find((a) => a.id === 'admin')
  await clearSession(page, base)
  return opsLogin(page, base, acct.email, acct.password)
}

async function measurePage(page, base, route, vp) {
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: Math.min(vp.dpr, 2),
    // Keep isMobile false — Chrome mobile layout viewport skews overflow math for this SPA.
    isMobile: false,
    hasTouch: vp.flags.includes('touch'),
  })
  await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await new Promise((r) => setTimeout(r, route.id === 'account' ? 2000 : 700))
  // Settle layout after fonts/images
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

  const url = page.url()
  const issues = []

  if (route.auth && route.auth !== 'customer' && isLoginWallUrl(url)) {
    issues.push('login_wall')
  }
  if (route.auth === 'customer' && !url.includes('/account')) {
    issues.push('customer_auth_failed')
  }
  if (route.path.startsWith('/operations') && route.auth && !isOpsAuthedUrl(url) && !isLoginWallUrl(url)) {
    /* may redirect to role home — still check overflow */
  }

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0)
    const clientWidth = doc.clientWidth
    const before = window.scrollX
    window.scrollBy(240, 0)
    const after = window.scrollX
    window.scrollTo(before, window.scrollY)
    const canScrollX = after > before + 1
    const buttons = [...document.querySelectorAll('a, button, [role="button"]')].slice(0, 40)
    const smallTargets = buttons.filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      return r.width < 40 || r.height < 40
    }).length
    const bodyFont = Number.parseFloat(getComputedStyle(body).fontSize) || 0
    return {
      scrollWidth,
      clientWidth,
      canScrollX,
      bleed: Math.max(0, scrollWidth - clientWidth),
      smallTargets,
      bodyFont,
    }
  })

  if (metrics.canScrollX) issues.push(`overflow_x (user_scroll bleed~${metrics.bleed}px)`)
  if (vp.flags.includes('mobile') && metrics.bodyFont > 0 && metrics.bodyFont < 14) {
    issues.push(`body_font_${metrics.bodyFont}px`)
  }
  const touchWarn = vp.flags.includes('touch') && metrics.smallTargets > 15

  const shotName = `${route.id}--${vp.id}.png`
  try {
    await page.screenshot({ path: join(outDir, shotName), fullPage: false })
  } catch (err) {
    issues.push(`screenshot_fail:${String(err?.message || err).slice(0, 80)}`)
  }

  let verdict = 'PASS'
  if (issues.some((i) => i === 'login_wall' || i === 'customer_auth_failed')) verdict = 'FAIL'
  else if (issues.some((i) => i.startsWith('overflow_x'))) verdict = 'FAIL'
  else if (touchWarn || issues.length) verdict = 'CONDITIONAL'

  return {
    page: route.id,
    viewport: vp.id,
    url,
    issues,
    touchWarn,
    metrics,
    shot: shotName,
    verdict,
  }
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5174'
  const base = `http://127.0.0.1:${port}`
  console.log(`Starting vite dev on ${base}…`)
  const preview = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    env: process.env,
  })
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) break
    } catch {
      if (i === 89) {
        preview.kill()
        throw new Error('vite dev not ready')
      }
    }
  }
  return { base, stop: async () => preview.kill('SIGTERM') }
}

let server = null
try {
  server = await ensurePreview()
  const { base } = server
  console.log('BASE', base)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  let page = await browser.newPage()

  const authCache = {}
  for (const route of PAGES) {
    try {
      if (page.isClosed()) page = await browser.newPage()
    } catch {
      page = await browser.newPage()
    }
    const key = route.auth || 'public'
    if (!authCache[key]) {
      authCache[key] = await ensureAuth(page, base, route.auth)
      if (route.auth && !authCache[key]) {
        console.error('auth failed for', route.auth, page.url())
      }
    } else if (route.auth) {
      const need =
        (route.auth === 'customer' && !page.url().includes('/account')) ||
        (route.auth !== 'customer' && isLoginWallUrl(page.url()))
      if (need) authCache[key] = await ensureAuth(page, base, route.auth)
    }

    for (const vp of VIEWPORTS) {
      try {
        if (page.isClosed()) page = await browser.newPage()
        if (route.auth) {
          // Re-auth when session dropped or role mismatch between pages
          const needAuth =
            (route.auth === 'customer' && !String(page.url()).includes('/account')) ||
            (route.auth !== 'customer' && (isLoginWallUrl(page.url()) || !authCache[route.auth]))
          if (needAuth || !authCache[route.auth]) {
            authCache[route.auth] = await ensureAuth(page, base, route.auth)
          }
        }
        const cell = await measurePage(page, base, route, vp)
        if (route.id === 'account' && cell.verdict === 'FAIL') {
          console.log('  account_debug', cell.url, cell.issues.join(';'))
        }
        cells.push(cell)
        console.log(cell.verdict, cell.page, cell.viewport, cell.issues.join(';') || 'ok')
      } catch (err) {
        cells.push({
          page: route.id,
          viewport: vp.id,
          verdict: 'FAIL',
          issues: [String(err?.message || err)],
          shot: null,
        })
        console.log('FAIL', route.id, vp.id, err?.message || err)
        try {
          page = await browser.newPage()
          authCache[route.auth || 'public'] = false
        } catch {
          /* ignore */
        }
      }
    }
  }

  await browser.close()
} catch (err) {
  console.error('fatal', err?.message || err)
  cells.push({
    page: 'fatal',
    viewport: '-',
    verdict: 'FAIL',
    issues: [String(err?.message || err)],
    shot: null,
  })
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}

const fails = cells.filter((c) => c.verdict === 'FAIL')
const conditionals = cells.filter((c) => c.verdict === 'CONDITIONAL')
const overall = fails.length ? 'FAIL' : conditionals.length ? 'CONDITIONAL' : 'PASS'

const byViewport = {}
for (const c of cells) {
  if (!byViewport[c.viewport]) byViewport[c.viewport] = { layout: 'OK', touch: 'OK', content: 'OK', verdict: 'PASS' }
  if (c.verdict === 'FAIL') byViewport[c.viewport].verdict = 'FAIL'
  else if (c.verdict === 'CONDITIONAL' && byViewport[c.viewport].verdict !== 'FAIL') {
    byViewport[c.viewport].verdict = 'CONDITIONAL'
  }
  if (c.issues.some((i) => i.startsWith('overflow') || i === 'login_wall')) {
    byViewport[c.viewport].layout = 'ISSUE'
  }
  if (c.touchWarn) byViewport[c.viewport].touch = 'WARN'
}

const reportLines = [
  '# Responsive Validation Report',
  '',
  `**Date:** ${new Date().toISOString()}`,
  `**Pages:** ${PAGES.map((p) => p.id).join(', ')}`,
  `**Viewports:** ${VIEWPORTS.length}`,
  `**Overall verdict:** ${overall}`,
  '',
  '## Viewport Results',
  '',
  '| Viewport | Layout | Touch | Content | Verdict |',
  '|----------|--------|-------|---------|---------|',
]
for (const vp of VIEWPORTS) {
  const row = byViewport[vp.id] || { layout: '—', touch: '—', content: '—', verdict: '—' }
  reportLines.push(`| ${vp.id} | ${row.layout} | ${row.touch} | ${row.content} | ${row.verdict} |`)
}
reportLines.push('', '## Issues', '')
const issueRows = cells.filter((c) => c.issues?.length || c.touchWarn)
if (!issueRows.length) reportLines.push('None.')
else {
  for (const c of issueRows) {
    reportLines.push(
      `- **${c.page} @ ${c.viewport}**: ${(c.issues || []).join(', ') || 'touch targets compact'}${c.shot ? ` (\`${c.shot}\`)` : ''}`,
    )
  }
}
reportLines.push('', `## Overall Verdict: ${overall}`, '')

writeFileSync(join(root, 'docs', 'qa', 'responsive-report.md'), reportLines.join('\n'))
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ overall, cells }, null, 2))
console.log(`\nOverall: ${overall} (fail=${fails.length} conditional=${conditionals.length})`)
process.exit(fails.length ? 1 : 0)
