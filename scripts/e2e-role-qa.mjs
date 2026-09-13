/**
 * Role-matrix Puppeteer pack: login → home allow + one deny URL per persona.
 * Evidence: e2e-evidence/role-qa/
 *
 *   BASE_URL=http://127.0.0.1:5173 node scripts/e2e-role-qa.mjs
 *   Or omit BASE_URL — starts vite dev.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'role-qa')
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

function account(id) {
  return OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
}

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 200))
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
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
    }).catch(() => null)
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

async function shot(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

function isDeniedWall(url) {
  return /access-denied|forbidden|\/403/i.test(url)
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

async function expectAllow(page, base, path, label) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitSettled(page)
  const url = page.url()
  if (isLoginWallUrl(url) || isDeniedWall(url)) {
    fail(label, `blocked at ${url}`)
    await shot(page, `${label}-FAIL`)
    return false
  }
  pass(label, url)
  await shot(page, label.replace(/\./g, '-'))
  return true
}

async function expectDeny(page, base, path, label) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitSettled(page)
  const url = page.url()
  const stillOnForbidden = url.includes(path.split('?')[0])
  if (isDeniedWall(url) || !stillOnForbidden) {
    pass(label, url)
    await shot(page, label.replace(/\./g, '-'))
    return true
  }
  fail(label, `still on forbidden ${url}`)
  await shot(page, `${label}-FAIL`)
  return false
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5191'
  const base = `http://127.0.0.1:${port}`
  console.log(`Starting vite dev on ${base}…`)
  const preview = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    env: process.env,
  })
  let ready = false
  const onData = (buf) => {
    if (/Local:|ready in|5191|5173|http/i.test(String(buf))) ready = true
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

/** persona checks: demo id, home path, extra allow paths, deny path */
const PERSONAS = [
  { id: 'tl', wave: 'B', home: '/operations/queue', allow: ['/operations/attendance', '/operations/crew'], deny: '/operations/pos' },
  { id: 'admin', wave: 'B', home: '/operations/pos', allow: ['/operations/inventory', '/operations/queue'], deny: '/operations/finance' },
  { id: 'crew1', wave: 'B', home: '/operations/attendance', allow: ['/operations/my-tasks', '/operations/my-pay'], deny: '/operations/pos' },
  { id: 'boss', wave: 'C', home: '/operations/console', allow: ['/operations/finance', '/operations/payroll'], deny: null },
  { id: 'asa', wave: 'C', home: '/operations/console', allow: ['/operations/queue'], deny: null },
  { id: 'opslead', wave: 'C', home: '/operations/roadmap', allow: ['/operations/dashboard', '/operations/pos'], deny: '/operations/people' },
  { id: 'investor', wave: 'C', home: '/operations/finance', allow: [], deny: '/operations/pos' },
  { id: 'sales', wave: 'D', home: '/operations/bookings', allow: ['/operations/history'], deny: '/operations/queue' },
  { id: 'detailer', wave: 'D', home: '/operations/bookings', allow: ['/operations/attendance'], deny: '/operations/queue' },
  { id: 'marketing', wave: 'D', home: '/operations/crm', allow: ['/operations/planning'], deny: '/operations/pos' },
  { id: 'video', wave: 'D', home: '/operations/planning?tab=calendar', allow: ['/operations/my-tasks'], deny: '/operations/queue' },
]

const PUBLIC_UTILS = [
  { path: '/book', label: 'public.book' },
  { path: '/contact', label: 'public.contact' },
  { path: '/complaints', label: 'public.complaints' },
  { path: '/f/detailing-inquiry', label: 'public.form-detailing' },
]

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

  for (const persona of PERSONAS) {
    try {
      const acct = account(persona.id)
      if (!acct) {
        fail(`login.${persona.id}`, 'missing demo')
        continue
      }
      await clearSession(page, base)
      const ok = await opsLogin(page, base, acct.email, acct.password)
      if (!ok) {
        fail(`login.${persona.id}`, page.url())
        await shot(page, `login-${persona.id}-FAIL`)
        continue
      }
      pass(`login.${persona.id}`, page.url())
      await shot(page, `login-${persona.id}`)

      await expectAllow(page, base, persona.home, `${persona.id}.home`)
      for (const p of persona.allow) {
        await expectAllow(page, base, p, `${persona.id}.allow.${p.replace(/[/?=]/g, '-')}`)
      }
      if (persona.deny) {
        await expectDeny(page, base, persona.deny, `${persona.id}.deny`)
      }
    } catch (err) {
      fail(`persona.${persona.id}`, err?.message || String(err))
      await shot(page, `persona-${persona.id}-FAIL`).catch(() => null)
    }
  }

  // Customer portal
  await clearSession(page, base)
  await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
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
  const custOk = await customerLogin(page, base, CUSTOMER_DEMO_ACCOUNT.email, CUSTOMER_DEMO_ACCOUNT.password)
  if (custOk) {
    pass('customer.signin', page.url())
    await shot(page, 'customer-account')
    await expectAllow(page, base, '/account', 'customer.account')
    await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 800))
    const u = page.url()
    if (!u.includes('/operations/queue') || isDeniedWall(u) || /signin|login|account/i.test(u)) {
      pass('customer.deny.ops', u)
      await shot(page, 'customer-deny-ops')
    } else {
      fail('customer.deny.ops', u)
      await shot(page, 'customer-deny-ops-FAIL')
    }
  } else {
    fail('customer.signin', page.url())
    await shot(page, 'customer-signin-FAIL')
  }

  // Public utilities (no landing /home)
  await clearSession(page, base)
  for (const pub of PUBLIC_UTILS) {
    await page.goto(`${base}${pub.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await dismissCookieBanner(page)
    await new Promise((r) => setTimeout(r, 800))
    const url = page.url()
    if (url.includes(pub.path.split('?')[0]) || !isLoginWallUrl(url)) {
      pass(pub.label, url)
      await shot(page, pub.label.replace(/\./g, '-'))
    } else {
      fail(pub.label, url)
      await shot(page, `${pub.label.replace(/\./g, '-')}-FAIL`)
    }
  }

  await browser.close()
} catch (err) {
  fail('fatal', err?.message || String(err))
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}

const failed = results.filter((r) => !r.ok)
const summary = {
  ok: failed.length === 0,
  passed: results.length - failed.length,
  total: results.length,
  failed: failed.map((f) => ({ name: f.name, detail: f.detail })),
  evidence: 'e2e-evidence/role-qa',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  console.error('failed:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}
