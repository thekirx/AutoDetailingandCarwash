/**
 * Money-path deep UI pack (non-destructive).
 * BA POS tabs + EoS wizard open; Boss Finance/Payroll tabs; Investor finance; TL POS deny.
 * Evidence: e2e-evidence/money-path/
 *
 *   DEV_PORT=5291 npm run e2e:money-path
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'money-path')
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
  await new Promise((r) => setTimeout(r, 300))
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
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  }
  try {
    const client = await page.createCDPSession()
    await client.send('Network.clearBrowserCookies')
  } catch {
    /* ignore */
  }
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
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

async function waitSettled(page) {
  await dismissCookieBanner(page)
  await page
    .waitForFunction(
      () => {
        const t = (document.body?.innerText || '').toUpperCase()
        return !t.includes('VERIFYING ACCESS')
      },
      { timeout: 30000 },
    )
    .catch(() => null)
  await new Promise((r) => setTimeout(r, 500))
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true })
}

async function gotoShot(page, base, path, label) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitSettled(page)
  const url = page.url()
  if (isLoginWallUrl(url) || /access-denied|forbidden/i.test(url)) {
    fail(label, url)
    await shot(page, `${label}-FAIL`)
    return false
  }
  pass(label, url)
  await shot(page, label)
  return true
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5291'
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
    if (/Local:|ready in|5291|5173|http/i.test(String(buf))) ready = true
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
    throw new Error('vite did not become ready')
  }
  return {
    base,
    stop: async () => {
      try {
        if (isWin && preview.pid) {
          spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
        } else preview.kill('SIGTERM')
      } catch {
        preview.kill('SIGKILL')
      }
    },
  }
}

const POS_TABS = ['checkout', 'pending', 'expenses', 'dashboard']
const FINANCE_TABS = ['overview', 'sales', 'purchases', 'pl', 'shift-close', 'reports']
const PAYROLL_TABS = ['home', 'run', 'cash-advance', 'packages', 'history', 'rules']

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

  // TL POS denied
  {
    const tl = account('tl')
    await clearSession(page, base)
    if (!(await opsLogin(page, base, tl.email, tl.password))) fail('tl.login', page.url())
    else {
      await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      if (/access-denied|forbidden/i.test(url) || !url.includes('/pos')) {
        pass('tl.pos_denied', url)
        await shot(page, 'tl-pos-denied')
      } else {
        fail('tl.pos_denied', url)
        await shot(page, 'tl-pos-denied-FAIL')
      }
    }
  }

  // Admin POS tabs + EoS wizard
  {
    const admin = account('admin')
    await clearSession(page, base)
    if (!(await opsLogin(page, base, admin.email, admin.password))) fail('admin.login', page.url())
    else {
      for (const tab of POS_TABS) {
        const path = tab === 'checkout' ? '/operations/pos' : `/operations/pos?tab=${tab}`
        await gotoShot(page, base, path, `admin-pos-${tab}`)
      }
      await page.goto(`${base}/operations/pos?tab=dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const opened = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => /End of shift/i.test(b.textContent || ''))
        if (btn) {
          btn.click()
          return true
        }
        return false
      })
      await new Promise((r) => setTimeout(r, 1200))
      if (opened) {
        pass('admin.eos_wizard', 'opened')
        await shot(page, 'admin-eos-wizard')
        await page.keyboard.press('Escape').catch(() => null)
      } else {
        fail('admin.eos_wizard', 'button not found')
        await shot(page, 'admin-eos-wizard-FAIL')
      }
    }
  }

  // Boss finance + payroll
  {
    const boss = account('boss')
    await clearSession(page, base)
    if (!(await opsLogin(page, base, boss.email, boss.password))) fail('boss.login', page.url())
    else {
      for (const tab of FINANCE_TABS) {
        await gotoShot(page, base, `/operations/finance?tab=${tab}`, `boss-finance-${tab}`)
      }
      for (const tab of PAYROLL_TABS) {
        await gotoShot(page, base, `/operations/payroll?tab=${tab}`, `boss-payroll-${tab}`)
      }
    }
  }

  // Investor finance read
  {
    const inv = account('investor')
    await clearSession(page, base)
    if (!(await opsLogin(page, base, inv.email, inv.password))) fail('investor.login', page.url())
    else {
      await gotoShot(page, base, '/operations/finance?tab=overview', 'investor-finance-overview')
      await gotoShot(page, base, '/operations/finance?tab=reports', 'investor-finance-reports')
      await page.goto(`${base}/operations/payroll`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      if (/access-denied|forbidden/i.test(url) || !url.includes('/payroll')) {
        pass('investor.payroll_denied', url)
        await shot(page, 'investor-payroll-denied')
      } else {
        fail('investor.payroll_denied', url)
        await shot(page, 'investor-payroll-denied-FAIL')
      }
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
  evidence: 'e2e-evidence/money-path',
  note: 'Non-destructive: does not submit shift_close or complete_pos_sale',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  console.error('failed:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}
