/**
 * BUG-067 — force the hypothesised mechanism instead of waiting for a coincidence.
 *
 * The wave has produced 8 clean sweeps against an observed ~1-in-3 failure rate, so
 * the event is rare enough that waiting for it buys nothing. The standing hypothesis
 * is specific and testable: `clearSession()` scrubs localStorage and cookies while
 * the page is still running and the Supabase client still believes it has a session
 * (`persistSession: true, autoRefreshToken: true`), so a request can leave with a
 * token the server no longer honours — a 401 on a route the role can otherwise open.
 *
 * This replicates clearSession() step for step and drains the recorder after every
 * phase, so a 401 is attributed to *which* step produced it: the scrub itself, the
 * login that follows it, or the page under test.
 *
 * Read-only: signs in with a demo account and browses. It writes nothing.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { existsSync, readFileSync } from 'node:fs'

import { isOpsAuthedUrl } from './screenshotAuth.mjs'
import { collectErrors } from './lib/collect-errors.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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

const CYCLES = Number(process.env.CYCLES || 3)
// marketing is the persona the 401 was originally attributed to.
const ROTATION = ['admin', 'marketing', 'tl', 'sales', 'crew1', 'opslead']
const PROBE_ROUTE = '/operations/bookings'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
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
    await sleep(500)
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) ready = true
    } catch { /* not up yet */ }
  }
  if (!ready) {
    preview.kill()
    throw new Error('vite dev server did not become ready')
  }
  return {
    base,
    stop: async () => {
      try {
        if (isWin && preview.pid) spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
        else preview.kill('SIGTERM')
      } catch {
        preview.kill('SIGKILL')
      }
    },
  }
}

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (btn) await btn.click().catch(() => null)
  await sleep(150)
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
  await sleep(400)
}

/** Byte-for-byte the wave's clearSession: scrub storage, never call auth.signOut(). */
async function clearSession(page, base) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(400)
  try {
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear() } catch { /* private mode */ }
    })
  } catch {
    await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
    await page
      .evaluate(() => {
        try { localStorage.clear(); sessionStorage.clear() } catch { /* private mode */ }
      })
      .catch(() => null)
  }
  try {
    const client = await page.createCDPSession()
    await client.send('Network.clearBrowserCookies')
  } catch { /* ignore */ }
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(300)
}

async function opsLogin(page, base, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  const ready = await page
    .waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  if (!ready) return false
  const e = await page.$('input[type="email"], input[name="email"]')
  const p = await page.$('input[type="password"], input[name="password"]')
  if (!e || !p) return false
  await e.click({ clickCount: 3 }); await e.type(email, { delay: 5 })
  await p.click({ clickCount: 3 }); await p.type(password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(
      () => {
        const p2 = location.pathname
        return p2.startsWith('/operations') && p2 !== '/operations/login' && !p2.startsWith('/operations/login/')
      },
      { timeout: 60000 },
    )
    .catch(() => null)
  await sleep(800)
  return isOpsAuthedUrl(page.url())
}

/** Drain the recorder and return only genuine auth failures. */
const authOnly = (bucket) => bucket.filter((l) => /^http (401|403)/.test(l))

/**
 * Positive control. A probe that reports "0 auth failures" is worthless unless the
 * instrument is shown to be capable of reporting a failure at all — a broken
 * recorder and a genuinely clean run look identical from the outside. So once per
 * cycle we issue one request that is guaranteed to be rejected, bracketed by drains
 * on the *same* recorder, and require it to be caught. If the control is missed the
 * run is NOT evidence of anything.
 *
 * The control must use the REAL anon apikey with a bad JWT. A bogus apikey is
 * rejected by the gateway *before* PostgREST, and that rejection carries no CORS
 * headers — so the browser blocks it, no `response` event fires, and the probe
 * "misses" a 401 that genuinely happened. That is not a bug in the app; it is a
 * control that silently measures nothing.
 */
async function positiveControl(page, errors) {
  errors.take() // discard whatever the last step left behind
  await page
    .evaluate(
      async ({ supabaseUrl, anonKey }) => {
        await fetch(`${supabaseUrl}/rest/v1/bookings?select=id&limit=1`, {
          headers: { apikey: anonKey, Authorization: 'Bearer not-a-real-token' },
        }).catch(() => null)
      },
      { supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY },
    )
    .catch(() => null)
  await sleep(1200)
  return authOnly(errors.take())
}

let server = null
try {
  server = await ensurePreview()
  const { base } = server
  console.log('BASE', base, `| cycles=${CYCLES} rotation=${ROTATION.join(',')}`)

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const errors = collectErrors(page)

  // The control needs the real anon key. Without it every control silently misses and the
  // whole run becomes meaningless, so refuse before spending twenty minutes finding out.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    await browser.close()
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required: the positive control cannot run without them')
  }

  let failures = 0
  let logins = 0
  let controlsPassed = 0
  let controlsMissed = 0
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    // Prove the instrument works before trusting anything it reports this cycle.
    const control = await positiveControl(page, errors)
    if (control.length) {
      controlsPassed++
      console.log(`cycle ${cycle}: positive control caught (${control[0].slice(0, 110)})`)
    } else {
      controlsMissed++
      console.log(`cycle ${cycle}: POSITIVE CONTROL MISSED — this cycle proves nothing`)
    }

    for (const id of ROTATION) {
      const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
      if (!acct) continue
      const tag = `cycle${cycle}/${id}`

      authOnly(errors.take()) // discard anything left from the previous step
      await clearSession(page, base)
      const afterScrub = authOnly(errors.take())
      if (afterScrub.length) {
        failures++
        console.log(`  ✖ ${tag} during clearSession:`)
        afterScrub.forEach((l) => console.log(`      ${l}`))
      }

      const ok = await opsLogin(page, base, acct.email, acct.password)
      const afterLogin = authOnly(errors.take())
      if (!ok) console.log(`  … ${tag} login did not land (${page.url()})`)
      else logins++
      if (afterLogin.length) {
        failures++
        console.log(`  ✖ ${tag} during login:`)
        afterLogin.forEach((l) => console.log(`      ${l}`))
      }
      if (!ok) continue

      await page.goto(`${base}${PROBE_ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitSettled(page)
      const afterPage = authOnly(errors.take())
      if (afterPage.length) {
        failures++
        console.log(`  ✖ ${tag} on ${PROBE_ROUTE} (${page.url()}):`)
        afterPage.forEach((l) => console.log(`      ${l}`))
      }
    }
    console.log(`cycle ${cycle}/${CYCLES} done — ${logins} logins, ${failures} phase(s) with an auth failure so far`)
  }

  await browser.close()
  console.log(`\npositive control: ${controlsPassed} caught / ${controlsMissed} missed over ${CYCLES} cycle(s)`)
  if (controlsMissed > 0) {
    console.log('RESULT: INCONCLUSIVE — the instrument failed its own control, so a clean run means nothing.')
    process.exitCode = 3
  } else if (failures === 0) {
    console.log(
      `RESULT: 0 incidental auth failures across ${CYCLES} x ${ROTATION.length} persona cycles, with the ` +
      'control passing every cycle — the scrub did NOT reproduce a 401 under this harness.',
    )
    process.exitCode = 0
  } else {
    console.log(`RESULT: ${failures} phase(s) produced a 401/403, with the control passing. See the lines above.`)
    process.exitCode = 1
  }
} catch (err) {
  console.error('probe failed:', err?.message || String(err))
  process.exitCode = 2
} finally {
  if (server?.stop) await server.stop().catch(() => null)
}