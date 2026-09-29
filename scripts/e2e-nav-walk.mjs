/**
 * Nav walk: every ops persona → every sidebar link they actually see.
 * Fails on login/denied wall, error boundary, blank main, uncaught page error, or 5xx.
 * PostgREST/API 4xx are recorded as backend findings (not failures).
 * Evidence: e2e-evidence/nav-walk/
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/e2e-nav-walk.mjs
 *   NAV_WALK_PERSONAS=boss,asa node scripts/e2e-nav-walk.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'nav-walk')
mkdirSync(outDir, { recursive: true })

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    if (!process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const base = (process.env.BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const personaIds = (process.env.NAV_WALK_PERSONAS ||
  'boss,asa,admin,opslead,tl,crew1,investor,sales,detailer,marketing,video').split(',')

const results = []
const findings = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function resetSession(page) {
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
  await client.send('Network.clearBrowserCookies').catch(() => null)
}

async function opsLogin(page, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const cookie = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (cookie) await cookie.click().catch(() => null)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  await page.type('input[type="email"], input[name="email"]', email, { delay: 5 })
  await page.type('input[type="password"], input[name="password"]', password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), {
      timeout: 60000,
    })
    .catch(() => null)
  await sleep(800)
  return isOpsAuthedUrl(page.url())
}

async function waitSettled(page) {
  await page
    .waitForFunction(
      () => {
        const t = (document.body?.innerText || '').toUpperCase()
        return !t.includes('VERIFYING ACCESS') && !document.querySelector('[data-loading="true"]')
      },
      { timeout: 30000 },
    )
    .catch(() => null)
  await sleep(1200)
}

async function navLinks(page) {
  await page.waitForSelector('.command-rail a[href^="/operations"], .floor-rail-nav a[href^="/operations"]', { timeout: 20000 }).catch(() => null)
  return page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('.command-rail a[href^="/operations"], .floor-rail-nav a[href^="/operations"]')].map((a) =>
        a.getAttribute('href'),
      ),
    ),
  ])
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

let current = null
page.on('pageerror', (err) => current?.pageErrors.push(String(err?.message || err).slice(0, 300)))
page.on('response', (res) => {
  if (!current) return
  const url = res.url()
  const status = res.status()
  if (!/supabase\.co|\/api\//.test(url)) return
  if (status >= 500) current.serverErrors.push(`${status} ${url.split('?')[0]}`)
  else if (status >= 400 && status !== 401) current.clientErrors.push(`${status} ${url.split('?')[0]}`)
})

try {
  for (const id of personaIds) {
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
    if (!acct) {
      results.push({ ok: false, persona: id, path: '(login)', detail: 'missing demo account' })
      continue
    }
    await resetSession(page)
    if (!(await opsLogin(page, acct.email, acct.password))) {
      results.push({ ok: false, persona: id, path: '(login)', detail: page.url() })
      console.error('✖', id, 'login', page.url())
      continue
    }
    await waitSettled(page)
    const links = await navLinks(page)
    if (!links.length) {
      results.push({ ok: false, persona: id, path: '(nav)', detail: 'no sidebar links rendered' })
      console.error('✖', id, 'no nav links')
      continue
    }

    for (const path of links) {
      current = { pageErrors: [], serverErrors: [], clientErrors: [] }
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const url = page.url()
      const state = await page.evaluate(() => {
        const crashed = !!document.querySelector('.not-found-page') && /stalled/i.test(document.body.innerText)
        const main = document.querySelector('main') || document.body
        return { crashed, textLen: (main.innerText || '').trim().length }
      })
      const problems = []
      if (isLoginWallUrl(url)) problems.push(`login wall ${url}`)
      if (/access-denied|forbidden|\/403/i.test(url)) problems.push(`denied ${url}`)
      if (state.crashed) problems.push('error boundary')
      if (state.textLen < 40) problems.push(`blank main (${state.textLen} chars)`)
      problems.push(...current.pageErrors.map((e) => `pageerror: ${e}`))
      problems.push(...current.serverErrors.map((e) => `5xx: ${e}`))

      const label = `${id}${path.replace(/[/?=&]/g, '-')}`
      await page.screenshot({ path: join(outDir, `${label}${problems.length ? '-FAIL' : ''}.png`), fullPage: false })
      for (const e of new Set(current.clientErrors)) findings.push({ persona: id, path, response: e })
      results.push({ ok: problems.length === 0, persona: id, path, detail: problems.join(' | ') || url })
      console.log(problems.length ? '✖' : '✔', id, path, problems.join(' | '))
    }
    current = null
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
const summary = {
  ok: failed.length === 0,
  base,
  passed: results.length - failed.length,
  total: results.length,
  failed,
  backendFindings: findings,
  evidence: 'e2e-evidence/nav-walk',
  at: new Date().toISOString(),
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\npassed ${summary.passed}/${summary.total} · backend 4xx findings ${findings.length}`)
if (failed.length) process.exit(1)
