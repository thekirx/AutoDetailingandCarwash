/**
 * Probe the intermittent 401 on /operations/bookings (BUG-067).
 *
 * The role-QA wave reports this failure roughly once in three runs, and each
 * wave takes minutes and walks 179 checks across every persona. That is a poor
 * way to isolate a single request, so this probe does the minimum instead:
 * sign in, load the one page, and record every failing response with its URL
 * and whether it carried an Authorization header.
 *
 * Why the header matters — it splits the two candidate causes apart:
 *   - no `Authorization` header  -> the request went out before the session was
 *     attached, or from a client with no session at all
 *   - an `Authorization` header -> a token WAS sent and was rejected, which
 *     points at expiry/refresh rather than at a missing session
 *
 * Read-only: it signs in, navigates and observes. It never writes.
 *
 *   node scripts/probe-bookings-401.mjs            # 6 reloads of /operations/bookings
 *   node scripts/probe-bookings-401.mjs 12 marketing
 *   node scripts/probe-bookings-401.mjs 3 admin walk   # mirror the wave: walk this role's own dock
 *
 * Two modes, because the first result was a null one. Ten reloads of
 * /operations/bookings as Branch Admin produced zero 4xx/5xx, so "this page
 * fires an unauthenticated request whenever it mounts" is ruled out. What
 * differs in the wave is the *sequence*: a fresh sign-in followed by a walk of
 * the role's own dock. `walk` reproduces that for one persona in about a minute
 * instead of a seven-minute, 179-check wave.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import {
  ROLES,
  getOperationsNav,
  getTeamLeadDock,
  getSalesDock,
  getStaffDock,
} from '../src/auth/permissions.js'
import { safeEvaluate } from './lib/safe-evaluate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}

const VISITS = Number(process.argv[2]) || 6
const PERSONA_ID = process.argv[3] || 'admin'
const MODE = process.argv[4] === 'walk' ? 'walk' : 'reload'
const ROUTE = '/operations/bookings'

/** Persona id → role, mirroring PERSONAS in scripts/e2e-role-qa-wave.mjs. */
const ROLE_BY_ID = {
  boss: ROLES.SUPER_ADMIN,
  asa: ROLES.ASSISTANT_SUPER_ADMIN,
  admin: ROLES.ADMIN,
  opslead: ROLES.OPERATIONS_LEAD,
  tl: ROLES.TEAM_LEAD,
  sales: ROLES.SALES,
  crew1: ROLES.STAFF,
  detailer: ROLES.DETAILER,
  marketing: ROLES.MARKETING,
  investor: ROLES.INVESTOR,
}

function roleOfPersona(id) {
  const role = ROLE_BY_ID[id]
  if (!role) throw new Error(`no role mapped for persona "${id}" — add it to ROLE_BY_ID`)
  return role
}

/** The same dock the wave walks for this role, built from the app's own nav. */
function dockFor(role) {
  const links = new Set()
  for (const item of getOperationsNav({ role, branch_slug: 'bacoor', permission_grants: {} }) || []) links.add(item.to)
  for (const dock of [getTeamLeadDock, getSalesDock, getStaffDock]) {
    try {
      for (const item of dock({ role, branch_slug: 'bacoor', permission_grants: {} }) || []) links.add(item.to)
    } catch { /* a dock that rejects this role contributes nothing */ }
  }
  return [...links].filter((to) => String(to).startsWith('/operations'))
}

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const isWin = process.platform === 'win32'
  const port = process.env.PROBE_PORT || '5197'
  const base = `http://127.0.0.1:${port}`
  const preview = spawn(
    isWin ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, env: process.env },
  )
  let ready = false
  const onData = (buf) => { if (/Local:|ready in|http/i.test(String(buf))) ready = true }
  preview.stdout.on('data', onData)
  preview.stderr.on('data', onData)
  for (let i = 0; i < 120 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) ready = true
    } catch { /* not up yet */ }
  }
  if (!ready) {
    if (isWin && preview.pid) spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
    else preview.kill('SIGTERM')
    throw new Error('vite dev server did not become ready')
  }
  return {
    base,
    stop: async () => {
      try {
        if (isWin && preview.pid) spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
        else preview.kill('SIGTERM')
      } catch { preview.kill('SIGKILL') }
    },
  }
}

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 250))
}

let server = null
let browser = null
try {
  const persona = OPS_DEMO_ACCOUNTS.find((a) => a.id === PERSONA_ID)
  if (!persona) throw new Error(`no demo account with id "${PERSONA_ID}"`)

  server = await ensurePreview()
  const { base } = server
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  // A request's headers are read off the `request` event, not the response, so
  // correlation is by URL. Responses and requests arrive in the same order for
  // the same exchange, and we only ever record one entry per failing URL.
  const authed = new Map()
  page.on('request', (req) => {
    authed.set(req.url(), Boolean(req.headers()?.authorization || req.headers()?.Authorization))
  })

  const failures = []
  page.on('response', (res) => {
    const status = res.status()
    if (status < 400) return
    failures.push({
      status,
      method: res.request().method(),
      url: res.url(),
      hadAuthHeader: authed.get(res.url()),
      at: page.url(),
    })
  })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const email = await page.$('input[type="email"], input[name="email"]')
  const pass = await page.$('input[type="password"]')
  await email.click({ clickCount: 3 })
  await email.type(persona.email, { delay: 5 })
  await pass.click({ clickCount: 3 })
  await pass.type(persona.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), { timeout: 60000 })
    .catch(() => null)
  if (page.url().includes('/login')) throw new Error('sign-in failed')
  console.log(`signed in as ${persona.id} (${persona.email}) -> ${page.url()}`)

  const dock = dockFor(roleOfPersona(PERSONA_ID))
  console.log(`dock for ${PERSONA_ID}: ${dock.join(', ') || '(none)'}`)
  const targets = MODE === 'walk' ? dock : Array(VISITS).fill(ROUTE)

  for (let i = 1; i <= targets.length; i++) {
    const to = targets[i - 1]
    failures.length = 0
    const mode = MODE === 'walk' ? 'dock walk' : (i % 2 === 1 ? 'cold navigation' : 'hard reload')
    if (MODE === 'walk' || i % 2 === 1) await page.goto(`${base}${to}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    else await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 3000))

    const landed = await safeEvaluate(page, () => location.pathname).catch(() => '(unknown)')
    console.log(`visit ${i}/${targets.length} [${mode}] -> ${to} landed=${landed} failures=${failures.length}`)
    for (const f of failures) {
      console.log(`    ${f.status} ${f.method} ${f.url.slice(0, 160)}  hadAuthHeader=${f.hadAuthHeader}`)
    }
    consoleErrors.length = 0
  }

  console.log('\n--- summary ---')
  const scope = MODE === 'walk' ? `${targets.length} dock routes as ${persona.id}` : `${VISITS} reloads of ${ROUTE} as ${persona.id}`
  if (!failures.length) {
    console.log(`No 4xx/5xx across ${scope}.`)
    console.log('The race did not reproduce in this window — that is a null result, not a clearance.')
  } else {
    const byUrl = new Map()
    for (const f of failures) byUrl.set(`${f.status} ${f.url}`, f)
    console.log(`${byUrl.size} distinct failing request(s):`)
    for (const f of byUrl.values()) {
      console.log(`  ${f.status} ${f.method} ${f.url}`)
      console.log(`     hadAuthHeader=${f.hadAuthHeader} seenOn=${f.at}`)
    }
  }
} catch (err) {
  console.error('PROBE FAILED:', err?.message || err)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => null)
  if (server?.stop) await server.stop().catch(() => null)
}