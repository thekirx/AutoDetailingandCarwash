/**
 * Multi-role QA harness — one command, every persona, real journeys.
 *
 * Replaces the ad-hoc per-wave role probes with a single pack that:
 *   1. logs in every persona in src/lib/demoAccounts.js,
 *   2. asserts the landing page matches redirectForRole(),
 *   3. walks that role's own dock/nav entries and asserts each opens,
 *   4. asserts a denied route actually denies,
 *   5. collects console errors per page (a role can "pass" while throwing),
 *   6. checks the money path only for the roles allowed to touch it,
 *   7. confirms the retired routes redirect instead of rendering.
 *
 * Evidence: e2e-evidence/role-qa-wave/  (PNG per check + summary.json)
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-role-qa-wave.mjs
 *   Or omit BASE_URL — starts vite dev on 5191.
 *
 * Puppeteer, not Playwright: the other 10 e2e scripts use Puppeteer and mixing
 * drivers would mean installing and maintaining a second one.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import {
  OPS_DEMO_ACCOUNTS,
  CUSTOMER_DEMO_ACCOUNT,
} from '../src/lib/demoAccounts.js'
import {
  ROLES,
  redirectForRole,
  allowRoute,
  getOperationsNav,
  getTeamLeadDock,
  getSalesDock,
  getStaffDock,
  canSeeForPaymentLane,
  canWriteFinance,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'role-qa-wave')
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

const results = []
function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.error('✖', name, detail)
}

function isDeniedWall(url) {
  return /access-denied|forbidden|\/403/i.test(url)
}

// ── Personas ──────────────────────────────────────────────────────────────
// `deny` is deliberately the one surface a role must NOT open. Each was taken
// from the role's own documented boundary, not guessed.

const PERSONAS = [
  { id: 'boss', role: ROLES.SUPER_ADMIN, deny: null, money: true },
  { id: 'asa', role: ROLES.ASSISTANT_SUPER_ADMIN, deny: null, money: true },
  { id: 'admin', role: ROLES.ADMIN, deny: '/operations/finance', money: true },
  { id: 'opslead', role: ROLES.OPERATIONS_LEAD, deny: '/operations/people', money: false },
  { id: 'tl', role: ROLES.TEAM_LEAD, deny: '/operations/pos', money: false },
  { id: 'sales', role: ROLES.SALES, deny: '/operations/queue', money: false },
  { id: 'crew1', role: ROLES.STAFF, deny: '/operations/pos', money: false },
  { id: 'detailer', role: ROLES.DETAILER, deny: '/operations/queue', money: false },
  { id: 'marketing', role: ROLES.MARKETING, deny: '/operations/pos', money: false },
  { id: 'video', role: ROLES.VIDEO_EDITOR, deny: '/operations/queue', money: false },
  { id: 'investor', role: ROLES.INVESTOR, deny: '/operations/pos', money: false },
]

/**
 * Retired on 2026-10-01 with the Daily Sheet cutover. These must not render a
 * page of their own — the contract is "does not land back on itself and stays
 * inside the operations app". `expect` is the immediate redirect target in the
 * router; it may forward again (e.g. /operations -> the role's own home).
 */
const RETIRED_ROUTES = [
  { from: '/operations/my-pay', expect: '/operations', label: 'My Pay retired' },
  { from: '/operations/payroll', expect: '/operations/finance?tab=sheets', label: 'Payroll retired' },
  { from: '/operations/settings/payroll', expect: '/operations/settings/daily-sheet', label: 'Payroll settings retired' },
  { from: '/admin', expect: '/operations/login', label: 'legacy /admin' },
]

// ── Page helpers ─────────────────────────────────────────────────────────

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 200))
}

async function waitSettled(page) {
  await dismissCookieBanner(page)
  await page
    .waitForFunction(
      () => {
        const t = (document.body?.innerText || '').toUpperCase()
        return !t.includes('VERIFYING ACCESS') && !document.querySelector('[data-loading="true"]')
      },
      { timeout: 30000 },
    )
    .catch(() => null)
  await new Promise((r) => setTimeout(r, 400))
}

async function shot(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true }).catch(() => null)
  return file
}

/**
 * Console/page errors seen since the last reset. A role can render "successfully"
 * while the page throws behind it, so every navigation reports its own bucket.
 */
function collectErrors(page) {
  const bucket = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text().slice(0, 300)}`)
  })
  page.on('pageerror', (err) => bucket.push(`pageerror: ${String(err?.message || err).slice(0, 300)}`))
  return {
    take: () => bucket.splice(0, bucket.length),
  }
}

async function clearSession(page, base) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await new Promise((r) => setTimeout(r, 400))
  try {
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* navigation race — retry once */
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
    await page
      .evaluate(() => {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {
          /* ignore */
        }
      })
      .catch(() => null)
  }
  try {
    const client = await page.createCDPSession()
    await client.send('Network.clearBrowserCookies')
  } catch {
    /* ignore */
  }
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 300))
}

async function opsLogin(page, base, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"], input[name="password"]')
  if (!emailSel || !passSel) return false
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(
      () => {
        const p = location.pathname
        return p.startsWith('/operations') && p !== '/operations/login' && !p.startsWith('/operations/login/')
      },
      { timeout: 60000 },
    )
    .catch(() => null)
  await new Promise((r) => setTimeout(r, 800))
  return isOpsAuthedUrl(page.url())
}

async function customerLogin(page, base, email, password) {
  await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await new Promise((r) => setTimeout(r, 400))
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
    await new Promise((r) => setTimeout(r, 800))
    if (page.url().includes('/account')) return true
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Use email or plate instead/i.test(b.textContent || ''),
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  const idSel = await page.$('input:not([type="password"]):not([type="hidden"])')
  const passSel = await page.$('input[type="password"]')
  if (!idSel || !passSel) return false
  await idSel.click({ clickCount: 3 })
  await idSel.type(email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 }).catch(() => null)
  await new Promise((r) => setTimeout(r, 800))
  return page.url().includes('/account')
}

/** Walk the pages a role is actually given, from its own dock/nav builder. */
function dockFor(profile) {
  const links = new Set()
  for (const item of getOperationsNav(profile) || []) links.add(item.to)
  for (const dock of [getTeamLeadDock, getSalesDock, getStaffDock]) {
    try {
      for (const item of dock(profile) || []) links.add(item.to)
    } catch {
      /* a dock that rejects this role simply contributes nothing */
    }
  }
  return [...links].filter((to) => String(to).startsWith('/operations'))
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5191'
  const base = `http://127.0.0.1:${port}`
  console.log(`Starting vite dev on ${base}…`)
  const preview = spawn(
    isWin ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, env: process.env },
  )
  let ready = false
  const onData = (buf) => {
    if (/Local:|ready in|http/i.test(String(buf))) ready = true
  }
  preview.stdout.on('data', onData)
  preview.stderr.on('data', onData)
  for (let i = 0; i < 90 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) ready = true
    } catch {
      /* wait */
    }
  }
  if (!ready) {
    preview.kill()
    throw new Error('vite dev server did not become ready')
  }
  return {
    base,
    stop: async () => {
      try {
        if (process.platform === 'win32' && preview.pid) {
          spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
        } else {
          preview.kill('SIGTERM')
        }
      } catch {
        preview.kill('SIGKILL')
      }
    },
  }
}

// ── Run ───────────────────────────────────────────────────────────────────

let server = null
try {
  server = await ensurePreview()
  const { base } = server
  console.log('BASE', base)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const errors = collectErrors(page)

  for (const persona of PERSONAS) {
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === persona.id)
    if (!acct) {
      fail(`login.${persona.id}`, 'missing demo account')
      continue
    }
    const profile = { role: persona.role, branch_slug: 'bacoor', permission_grants: {} }

    await clearSession(page, base)
    const loggedIn = await opsLogin(page, base, acct.email, acct.password)
    if (!loggedIn) {
      fail(`login.${persona.id}`, page.url())
      await shot(page, `login-${persona.id}-FAIL`)
      continue
    }
    pass(`login.${persona.id}`, page.url())

    // The landing page must be the one this role is actually sent to. This is
    // the check that caught boss/asa pointing at the removed /operations/console.
    const landing = redirectForRole(persona.role)
    const landed = new URL(page.url()).pathname
    if (landed === new URL(landing, base).pathname) {
      pass(`${persona.id}.landing`, landed)
    } else {
      fail(`${persona.id}.landing`, `expected ${landing}, landed on ${landed}`)
      await shot(page, `${persona.id}-landing-FAIL`)
    }

    // Every page this role is handed must actually open.
    const dock = dockFor(profile)
    for (const to of dock) {
      await page.goto(`${base}${to}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      const label = `${persona.id}.open.${to.replace(/[/?=&]/g, '-')}`
      if (isLoginWallUrl(url) || isDeniedWall(url)) {
        fail(label, `${to} is in ${persona.role}'s own nav but blocked at ${url}`)
        await shot(page, `${label}-FAIL`)
      } else {
        pass(label, url)
        await shot(page, label)
      }
    }

    // A page that "opens" while throwing is not a pass.
    const pageErrors = errors.take().filter((e) => !/favicon|ResizeObserver/i.test(e))
    if (pageErrors.length) {
      fail(`${persona.id}.console`, pageErrors.slice(0, 3).join(' | '))
    } else {
      pass(`${persona.id}.console`, 'clean')
    }

    // The denied surface must actually deny.
    if (persona.deny) {
      await page.goto(`${base}${persona.deny}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      const stillOpen = new URL(url).pathname === persona.deny && !isDeniedWall(url)
      if (stillOpen) {
        fail(`${persona.id}.deny`, `${persona.deny} opened for ${persona.role}`)
        await shot(page, `${persona.id}-deny-FAIL`)
      } else {
        pass(`${persona.id}.deny`, url)
        await shot(page, `${persona.id}-deny`)
      }
    }

    // Money surfaces are asserted only where the gate says the role has them AND
    // the role can actually reach the page that renders them. Branch Admin is
    // console-tier for For Payment but is denied the Queue outright (BUG-043,
    // settled 2026-10-04), so its lane grant is unreachable — see BUG-055.
    const canReachQueue = allowRoute(profile, 'queue')
    if (canSeeForPaymentLane(profile) && canReachQueue) {
      await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      // The board labels the lane "PAYMENT" (STATUS_SHORT_LABELS) with the
      // hint "Collect at POS" — not "For Payment", which is the status label
      // used elsewhere. Matching the wrong one gave a false negative.
      const lane = await page.evaluate(() =>
        /collect at pos/i.test(document.body?.innerText || '') ||
        /\bpayment\b/i.test(document.body?.innerText || ''),
      )
      if (lane) pass(`${persona.id}.forPaymentLane`, 'lane visible')
      else fail(`${persona.id}.forPaymentLane`, 'console tier cannot see the For Payment lane')
      await shot(page, `${persona.id}-for-payment-lane`)
    } else if (!canReachQueue) {
      pass(`${persona.id}.noForPaymentLane`, 'Queue denied, so the lane is not reachable either')
    } else {
      // The other half of the same gate: a role that must not see it, does not.
      await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      if (!isDeniedWall(page.url())) {
        const lane = await page.evaluate(() => /collect at pos/i.test(document.body?.innerText || ''))
        if (lane) {
          fail(`${persona.id}.noForPaymentLane`, `${persona.role} must not see the For Payment lane`)
          await shot(page, `${persona.id}-for-payment-leak-FAIL`)
        } else {
          pass(`${persona.id}.noForPaymentLane`, 'lane hidden')
        }
      }
    }

    // The route gate is what actually governs, so assert against allowRoute — the
    // same function OpsRoleGate calls. canAccessFinance() answers true for a
    // Branch Admin while the route denies them (BUG-054); the route is the one
    // that is enforced, so it is the one the harness must hold the product to.
    if (allowRoute(profile, 'finance')) {
      await page.goto(`${base}/operations/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      if (isDeniedWall(url)) {
        fail(`${persona.id}.finance`, `${url} — allowRoute allows finance but the route denies`)
      } else {
        pass(`${persona.id}.finance`, url)
        await shot(page, `${persona.id}-finance`)
      }
    }

    if (!canWriteFinance(profile)) {
      // A role that cannot write the books must not find a write affordance.
      await page.goto(`${base}/operations/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const write = await page.evaluate(() =>
        /add vendor|new vendor|post to books|approve sheet/i.test(document.body?.innerText || ''),
      )
      if (write && !isDeniedWall(page.url())) {
        fail(`${persona.id}.financeWriteHidden`, `${persona.role} cannot write finance but sees a write control`)
        await shot(page, `${persona.id}-finance-write-FAIL`)
      } else {
        pass(`${persona.id}.financeWriteHidden`, 'no write affordance')
      }
    }
  }

  // ── Retired routes ─────────────────────────────────────────────────────
  await clearSession(page, base)
  await opsLogin(page, base, OPS_DEMO_ACCOUNTS[0].email, OPS_DEMO_ACCOUNTS[0].password)
  for (const r of RETIRED_ROUTES) {
    await page.goto(`${base}${r.from}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitSettled(page)
    const url = new URL(page.url())
    const landed = `${url.pathname}${url.search}`
    // The retired page must not survive, and the role must stay inside the
    // operations app. /operations and /operations/login both forward once more
    // to the role's own home, so the final hop is not the one asserted here.
    const stayedPut = url.pathname === r.from
    const leftTheApp = !url.pathname.startsWith('/operations') && !url.pathname.startsWith('/admin')
    if (!stayedPut && !leftTheApp) {
      pass(`retired.${r.from}`, `${r.from} → ${landed}`)
    } else {
      fail(
        `retired.${r.from}`,
        stayedPut ? `${r.label}: ${r.from} still renders` : `${r.label}: escaped to ${landed}`,
      )
      await shot(page, `retired-${r.from.replace(/\W+/g, '-')}-FAIL`)
    }
  }

  // ── Customer portal ────────────────────────────────────────────────────
  await clearSession(page, base)
  const custOk = await customerLogin(page, base, CUSTOMER_DEMO_ACCOUNT.email, CUSTOMER_DEMO_ACCOUNT.password)
  if (custOk) {
    pass('customer.signin', page.url())
    await shot(page, 'customer-account')
    for (const to of ['/account', '/account/queue', '/account/bookings', '/account/loyalty']) {
      await page.goto(`${base}${to}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      if (isLoginWallUrl(url) || isDeniedWall(url) || !new URL(url).pathname.startsWith('/account')) {
        fail(`customer.open.${to}`, url)
        await shot(page, `customer-${to.replace(/\W+/g, '-')}-FAIL`)
      } else {
        pass(`customer.open.${to}`, url)
        await shot(page, `customer-${to.replace(/\W+/g, '-')}`)
      }
    }
    await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitSettled(page)
    const u = page.url()
    if (new URL(u).pathname.startsWith('/operations/queue') && !isDeniedWall(u)) {
      fail('customer.deny.ops', u)
      await shot(page, 'customer-deny-ops-FAIL')
    } else {
      pass('customer.deny.ops', u)
      await shot(page, 'customer-deny-ops')
    }
  } else {
    fail('customer.signin', page.url())
    await shot(page, 'customer-signin-FAIL')
  }

  // ── Public utilities stay reachable without a session ──────────────────
  await clearSession(page, base)
  for (const to of ['/book', '/contact', '/complaints', '/queue', '/branches', '/events', '/services']) {
    await page.goto(`${base}${to}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitSettled(page)
    const url = page.url()
    if (isLoginWallUrl(url)) {
      fail(`public.${to}`, 'public page demanded a login')
      await shot(page, `public-${to.replace(/\W+/g, '-')}-FAIL`)
    } else {
      pass(`public.${to}`, url)
      await shot(page, `public-${to.replace(/\W+/g, '-')}`)
    }
  }

  await browser.close()
} catch (err) {
  fail('fatal', err?.message || String(err))
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}

const failed = results.filter((r) => !r.ok)
const byRole = {}
for (const r of results) {
  const role = r.name.split('.')[0]
  byRole[role] = byRole[role] || { pass: 0, fail: 0 }
  byRole[role][r.ok ? 'pass' : 'fail'] += 1
}

const summary = {
  ok: failed.length === 0,
  passed: results.length - failed.length,
  total: results.length,
  byRole,
  failed: failed.map((f) => ({ name: f.name, detail: f.detail })),
  evidence: 'e2e-evidence/role-qa-wave',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  console.error('failed:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}