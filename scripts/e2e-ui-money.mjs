/**
 * BUG-007 money path UI pack (Puppeteer).
 * Seams:
 *   TL → POS denied
 *   Admin → queue + POS + End of shift wizard opens (no submit)
 *   Boss → finance?tab=shift-close reachable
 *
 * Does NOT post shift_close or complete_pos_sale (non-destructive).
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5260 node scripts/e2e-ui-money.mjs
 * Evidence: e2e-evidence/ui-money/
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'ui-money')
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

async function shot(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function ensureDev() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const isWin = process.platform === 'win32'
  const port = process.env.DEV_PORT || process.env.PREVIEW_PORT || '5173'
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
      preview.kill('SIGTERM')
    },
  }
}

let server = null
try {
  server = await ensureDev()
  const { base } = server
  console.log('BASE', base)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  // --- money.tl.pos_denied ---
  {
    const tl = account('tl')
    await clearSession(page, base)
    const ok = await opsLogin(page, base, tl.email, tl.password)
    if (!ok) {
      fail('money.tl.pos_denied', `login failed ${page.url()}`)
      await shot(page, 'tl-login-FAIL')
    } else {
      await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await new Promise((r) => setTimeout(r, 1200))
      const url = page.url()
      const denied = /access-denied|forbidden/i.test(url)
      if (denied || !isOpsAuthedUrl(url)) {
        pass('money.tl.pos_denied', url)
        await shot(page, 'tl-pos-denied')
      } else {
        fail('money.tl.pos_denied', `TL reached POS: ${url}`)
        await shot(page, 'tl-pos-DENIED-FAIL')
      }
    }
  }

  // --- money.admin.queue / pos / eos_wizard ---
  {
    const admin = account('admin')
    await clearSession(page, base)
    const ok = await opsLogin(page, base, admin.email, admin.password)
    if (!ok) {
      fail('money.admin.queue', `login failed ${page.url()}`)
      fail('money.admin.pos', 'skipped')
      fail('money.admin.eos_wizard', 'skipped')
    } else {
      await page.goto(`${base}/operations/queue`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await dismissCookieBanner(page)
      await new Promise((r) => setTimeout(r, 1200))
      if (isLoginWallUrl(page.url()) || !isOpsAuthedUrl(page.url())) {
        fail('money.admin.queue', page.url())
        await shot(page, 'admin-queue-FAIL')
      } else {
        pass('money.admin.queue', page.url())
        await shot(page, 'admin-queue')
      }

      await page.goto(`${base}/operations/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await dismissCookieBanner(page)
      await new Promise((r) => setTimeout(r, 1500))
      if (isLoginWallUrl(page.url()) || !isOpsAuthedUrl(page.url())) {
        fail('money.admin.pos', page.url())
        await shot(page, 'admin-pos-FAIL')
        fail('money.admin.eos_wizard', 'pos not reachable')
      } else {
        pass('money.admin.pos', page.url())
        await shot(page, 'admin-pos')

        const clicked = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) =>
            /End of shift/i.test(b.textContent || ''),
          )
          if (!btn) return false
          btn.click()
          return true
        })
        await new Promise((r) => setTimeout(r, 1000))
        const wizardOpen = await page.evaluate(() => {
          const t = document.body?.innerText || ''
          return /End of shift/i.test(t) && (/Cash|baseline|attested|wizard|step/i.test(t) || document.querySelector('[role="dialog"], [data-slot="sheet-content"]'))
        })
        if (clicked && wizardOpen) {
          pass('money.admin.eos_wizard', 'End of shift sheet open')
          await shot(page, 'admin-eos-wizard')
        } else {
          fail('money.admin.eos_wizard', `clicked=${clicked} wizardOpen=${wizardOpen}`)
          await shot(page, 'admin-eos-wizard-FAIL')
        }
      }
    }
  }

  // --- money.boss.finance_shift_close ---
  {
    const boss = account('boss')
    await clearSession(page, base)
    const ok = await opsLogin(page, base, boss.email, boss.password)
    if (!ok) {
      fail('money.boss.finance_shift_close', `login failed ${page.url()}`)
      await shot(page, 'boss-login-FAIL')
    } else {
      await page.goto(`${base}/operations/finance?tab=shift-close`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await dismissCookieBanner(page)
      await new Promise((r) => setTimeout(r, 1500))
      const url = page.url()
      const bodyOk = await page.evaluate(() => {
        const t = document.body?.innerText || ''
        return /shift|close|finance|accept|review/i.test(t)
      })
      if (isOpsAuthedUrl(url) && bodyOk && !/access-denied/i.test(url)) {
        pass('money.boss.finance_shift_close', url)
        await shot(page, 'boss-finance-shift-close')
      } else {
        fail('money.boss.finance_shift_close', `${url} bodyOk=${bodyOk}`)
        await shot(page, 'boss-finance-shift-close-FAIL')
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
  evidence: 'e2e-evidence/ui-money',
  at: new Date().toISOString(),
  note: 'Non-destructive: does not submit shift_close or complete_pos_sale',
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total}`)
if (failed.length) {
  console.log('FAILURES:')
  for (const f of failed) console.log(' -', f.name, f.detail)
}
process.exit(failed.length ? 1 : 0)
