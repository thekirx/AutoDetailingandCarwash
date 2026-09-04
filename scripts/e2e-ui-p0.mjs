/**
 * P0 Puppeteer UI flows: ops login (admin/TL/staff), customer sign-in,
 * queue/POS/attendance pages (authed, not login wall).
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/e2e-ui-p0.mjs
 *   Or omit BASE_URL — script builds + starts vite preview.
 *
 * Evidence: e2e-evidence/ui-p0/
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'ui-p0')
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
  await page.goto(`${base}/operations/login`, { waitUntil: 'networkidle2', timeout: 60000 })
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
  await new Promise((r) => setTimeout(r, 500))

  // Prefer demo chip (auto sign-in) when enabled in DEV
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

  // Fallback: email mode form
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

async function assertOpsPage(page, base, path, label) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await new Promise((r) => setTimeout(r, 1200))
  const url = page.url()
  if (isLoginWallUrl(url)) {
    fail(label, `login wall at ${url}`)
    await shot(page, `${label}-FAIL`)
    return false
  }
  if (!isOpsAuthedUrl(url)) {
    fail(label, `unexpected url ${url}`)
    await shot(page, `${label}-FAIL`)
    return false
  }
  pass(label, url)
  await shot(page, label.replace(/\./g, '-'))
  return true
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }

  // Customer portal needs Vite middleware (/api/customer-auth-lookup) — use dev, not preview.
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5173'
  const base = `http://127.0.0.1:${port}`
  console.log(`Starting vite dev on ${base}…`)
  const preview = spawn(
    isWin ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
      env: process.env,
    },
  )
  let ready = false
  const onData = (buf) => {
    const t = String(buf)
    if (/Local:|ready in|5173|http/i.test(t)) ready = true
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
      preview.kill('SIGTERM')
    },
  }
}

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

  // --- Ops logins ---
  for (const id of ['admin', 'tl', 'crew1']) {
    const acct = account(id)
    if (!acct) {
      fail(`login.${id}`, 'missing demo account')
      continue
    }
    await clearSession(page, base)
    const ok = await opsLogin(page, base, acct.email, acct.password)
    if (ok) {
      pass(`login.${id}`, page.url())
      await shot(page, `login-${id}`)
    } else {
      fail(`login.${id}`, page.url())
      await shot(page, `login-${id}-FAIL`)
    }
  }

  // --- TL floor pages ---
  {
    const tl = account('tl')
    await clearSession(page, base)
    const ok = await opsLogin(page, base, tl.email, tl.password)
    if (!ok) fail('floor.tl.session', page.url())
    else {
      await assertOpsPage(page, base, '/operations/queue', 'floor.queue')
      // Team Lead has no POS (canAccessPos = admin/SA/ASA/opslead only)
      await assertOpsPage(page, base, '/operations/attendance', 'floor.attendance')
    }
  }

  // --- Admin POS ---
  {
    const admin = account('admin')
    await clearSession(page, base)
    const ok = await opsLogin(page, base, admin.email, admin.password)
    if (!ok) fail('floor.admin.session', page.url())
    else {
      await assertOpsPage(page, base, '/operations/pos', 'floor.admin.pos')
      await assertOpsPage(page, base, '/operations/inventory', 'floor.admin.inventory')
    }
  }

  // --- Customer portal ---
  await clearSession(page, base)
  // Customer uses /signin — clear again on that origin path
  await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  }).catch(() => null)
  const custOk = await customerLogin(
    page,
    base,
    CUSTOMER_DEMO_ACCOUNT.email,
    CUSTOMER_DEMO_ACCOUNT.password,
  )
  if (custOk) {
    pass('customer.signin', page.url())
    await shot(page, 'customer-account')
    await page.goto(`${base}/account`, { waitUntil: 'networkidle2', timeout: 60000 })
    if (page.url().includes('/account')) pass('customer.account', page.url())
    else fail('customer.account', page.url())
  } else {
    fail('customer.signin', page.url())
    await shot(page, 'customer-signin-FAIL')
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
  evidence: 'e2e-evidence/ui-p0',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  console.log('FAILURES:')
  for (const f of failed) console.log(' -', f.name, f.detail)
}
process.exit(failed.length ? 1 : 0)
