/**
 * Real Web Push delivery in installed browsers (not fake endpoints).
 * Per browser × persona: fresh profile → login → enable alerts via the UI → "Test alert" (real /api/send-push)
 * → wait for the service worker's displayed notification → desktop screenshot (Windows toast) + page shot.
 * Then one real business event (notifyBookingStatus) must reach customer + ops devices.
 * Subscriptions created here are deleted at the end.
 *
 *   BASE_URL=http://127.0.0.1:5176 node scripts/e2e-push-real.mjs
 *   PUSH_BROWSERS=chrome,edge,brave PUSH_PERSONAS=customer,boss,tl node scripts/e2e-push-real.mjs
 *   PUSH_AUDIT=1 PUSH_BROWSERS=chrome node scripts/e2e-push-real.mjs   # event × recipient × landing matrix (scripts/push-audit-events.mjs)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT = process.env.PUSH_AUDIT === '1'
const outDir = join(root, 'e2e-evidence', AUDIT ? 'push-audit' : 'push-real')
mkdirSync(outDir, { recursive: true })
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !line.startsWith('#') && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}
const { notifyBookingStatus } = await import('../server/notifyBooking.mjs')

const base = (process.env.BASE_URL || 'http://127.0.0.1:5176').replace(/\/$/, '')
const BROWSERS = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  brave: 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  firefox: process.env.FIREFOX_PATH || join(homedir(), '.cache/puppeteer/firefox/win64-stable_156.0.1/core/firefox.exe'),
}
// Automation can't click Firefox's permission doorhanger, so this pre-grants it (like overridePermissions does in Chromium).
const FIREFOX_PREFS = {
  'dom.push.enabled': true,
  'dom.push.connection.enabled': true,
  'dom.push.serverURL': 'wss://push.services.mozilla.com/',
  'dom.serviceWorkers.enabled': true,
  'dom.webnotifications.enabled': true,
  // PUSH_FF_PROMPT=1 leaves the real prompt: "no alerts-on state" = prompt shown (gesture kept); "permission blocked" = gesture lost.
  ...(process.env.PUSH_FF_PROMPT === '1' ? {} : { 'permissions.default.desktop-notification': 1 }),
}
const browserIds = (process.env.PUSH_BROWSERS || 'chrome,edge,brave').split(',')
const personaIds = (process.env.PUSH_PERSONAS ||
  'customer,boss,asa,admin,opslead,tl,crew1,investor,sales,detailer,marketing,video').split(',')

const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const endpoints = []

/** Bottom-right of the primary screen only (where Windows toasts appear) — avoids capturing unrelated windows. */
function desktopShot(file) {
  const ps = [
    `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name U -Namespace W`,
    '[void][W.U]::SetProcessDPIAware()',
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
    '$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$w=[Math]::Min(900,$s.Width);$h=[Math]::Min(700,$s.Height)',
    '$m=New-Object Drawing.Bitmap $w,$h;$g=[Drawing.Graphics]::FromImage($m)',
    '$g.CopyFromScreen($s.Right-$w,$s.Bottom-$h,0,0,$m.Size)',
    `$m.Save('${file.replace(/'/g, "''")}')`,
  ].join(';')
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 15000 })
    return true
  } catch {
    return false
  }
}

async function clickByText(page, selector, re) {
  return page.evaluate(
    (sel, src) => {
      const rx = new RegExp(src, 'i')
      const el = [...document.querySelectorAll(sel)].find((e) => rx.test(e.textContent || e.getAttribute('aria-label') || '') && !e.disabled)
      if (!el) return false
      el.click()
      return true
    },
    selector,
    re.source,
  )
}

async function login(page, persona) {
  const cookie = async () => {
    const b = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
    if (b) await b.click().catch(() => null)
  }
  if (persona === 'customer') {
    await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await cookie()
    await sleep(600)
    const chip = await clickByText(page, '.hakum-demo-chip', /demo\.customer|Demo customer/)
    if (!chip) {
      await clickByText(page, 'button', /Use email or plate instead/)
      await sleep(300)
      await page.type('input:not([type="password"]):not([type="hidden"])', CUSTOMER_DEMO_ACCOUNT.email)
      await page.type('input[type="password"]', CUSTOMER_DEMO_ACCOUNT.password)
      await page.click('button[type="submit"]')
    }
    await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 })
    return
  }
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === persona)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await cookie()
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.type('input[type="email"]', acct.email)
  await page.type('input[type="password"]', acct.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), {
    timeout: 60000,
  })
}

/** Firefox sometimes detaches the first frame mid-login; one retry on a fresh page. */
async function loginWithRetry(browser, persona) {
  let page = (await browser.pages())[0] || (await browser.newPage())
  try {
    await login(page, persona)
  } catch (err) {
    if (!/detached|Navigat|Execution context|timeout|Target closed/i.test(String(err.message))) throw err
    await sleep(2000)
    page = await browser.newPage()
    await login(page, persona)
  }
  return page
}

/** Returns the endpoint after the UI reports alerts on. */
async function enableViaUi(page, persona) {
  if (persona === 'customer') {
    await page.goto(`${base}/account/more?tab=alerts`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.capp-switch', { timeout: 30000 })
    await sleep(2500)
    await clickByText(page, '[role="dialog"] button', /^\s*Not now\s*$/)
    await sleep(500)
    await page.waitForFunction(() => [...document.querySelectorAll('.capp-pref')].some((p) => /Push alerts off/.test(p.textContent) && !p.querySelector('.capp-switch')?.disabled), {
      timeout: 30000,
    })
    await page.evaluate(() => [...document.querySelectorAll('.capp-pref')].find((p) => /Push alerts off/.test(p.textContent)).querySelector('.capp-switch').click())
  } else {
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('button')].some((b) => /^\s*Account\s*$/.test(b.textContent) || b.getAttribute('aria-label') === 'Settings'),
        { timeout: 45000 },
      )
      .catch(() => null)
    await sleep(2500)
    await clickByText(page, '[role="dialog"] button', /^\s*Not now\s*$/)
    const opened =
      (await clickByText(page, 'button', /^\s*Account\s*$/)) || (await clickByText(page, 'button[aria-label="Settings"]', /Settings/))
    if (!opened) throw new Error('settings button not found')
    // The chip stays disabled until the service worker is ready.
    await page.waitForFunction(() => [...document.querySelectorAll('.push-chip')].some((b) => /Enable alerts/.test(b.textContent) && !b.disabled), {
      timeout: 30000,
    })
    await clickByText(page, '.push-chip', /Enable alerts/)
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.push-modal button')].some((b) => /Enable alerts/.test(b.textContent)), {
    timeout: 20000,
  })
  // Trusted mouse click: Firefox ignores permission requests from script-dispatched clicks.
  const enableBtn = await page.evaluateHandle(() => [...document.querySelectorAll('.push-modal button')].find((b) => /Enable alerts/.test(b.textContent)))
  await enableBtn.asElement().click()
  const ok = await page
    .waitForFunction(
      () =>
        document.querySelector('.push-chip-on') ||
        [...document.querySelectorAll('.capp-pref strong')].some((s) => s.textContent.trim() === 'Push alerts on') ||
        [...document.querySelectorAll('[data-sonner-toast]')].some((t) => /blocked|failed|not supported|error|unable|expired/i.test(t.textContent)),
      { timeout: 45000 },
    )
    .then(() =>
      page.evaluate(
        () =>
          Boolean(document.querySelector('.push-chip-on')) ||
          [...document.querySelectorAll('.capp-pref strong')].some((s) => s.textContent.trim() === 'Push alerts on'),
      ),
    )
    .catch(() => false)
  if (!ok) {
    const toast = await page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent).join(' | '))
    throw new Error(`enable failed: ${toast || 'no alerts-on state'}`)
  }
  return page.evaluate(async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.endpoint || null)
}

/** Firefox can detach the tab's frame (SW update reload); any same-origin tab can read the SW's notifications. */
async function waitShown(page, titleRe, ms = 45000) {
  const check = (p) =>
    p.waitForFunction(
      async (src) => {
        const reg = await navigator.serviceWorker.ready
        const list = await reg.getNotifications()
        return list.some((n) => new RegExp(src, 'i').test(`${n.title} ${n.body}`))
      },
      { timeout: ms, polling: 500 },
      titleRe.source,
    )
  try {
    await check(page)
    return true
  } catch (err) {
    if (!/detached|context/i.test(String(err.message))) return false
    const fresh = (await page.browser().pages().catch(() => [])).at(-1)
    return fresh ? check(fresh).then(() => true, () => false) : false
  }
}

async function clearShown(page) {
  try {
    await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).forEach((n) => n.close()))
  } catch {
    /* detached tab: nothing to clear */
  }
}

const EVENT_PERSONAS = new Set(['customer', 'boss', 'tl', 'admin'])
const startedAt = new Date().toISOString()
const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const idByEmail = (email) => userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
const userIds = Object.fromEntries([
  ['customer', idByEmail(CUSTOMER_DEMO_ACCOUNT.email)],
  ...OPS_DEMO_ACCOUNTS.map((a) => [a.id, idByEmail(a.email)]),
])

const sessions = []
try {
  for (const b of browserIds) {
    for (const persona of personaIds) {
      const label = `${b}-${persona}`
      const entry = { browser: b, persona, ok: false, steps: [] }
      results.push(entry)
      // ponytail: one retry on a fresh profile absorbs browser/push-service hiccups; the first error stays in the summary.
      for (let attempt = 1; attempt <= 2 && !entry.ok; attempt++) {
        if (attempt === 2) {
          entry.firstError = entry.error
          entry.steps = []
          delete entry.error
          console.log('↻', label, 'retry after:', entry.firstError)
        }
        const profile = join(tmpdir(), `hakum-push-${label}-${Date.now()}`)
        if (b === 'brave') {
          // Brave ships with push off; this is the "Use Google services for push messaging" setting.
          mkdirSync(join(profile, 'Default'), { recursive: true })
          writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify({ brave: { gcm: { channel_status: true } } }))
        }
        let browser
        try {
          browser =
            b === 'firefox'
              ? await puppeteer.launch({
                  browser: 'firefox',
                  executablePath: BROWSERS[b],
                  headless: false,
                  userDataDir: profile,
                  defaultViewport: { width: 1280, height: 860 },
                  extraPrefsFirefox: FIREFOX_PREFS,
                })
              : await puppeteer.launch({
                  executablePath: BROWSERS[b],
                  headless: false,
                  userDataDir: profile,
                  defaultViewport: { width: 1280, height: 860 },
                  ignoreDefaultArgs: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions'],
                  args: ['--no-first-run', '--no-default-browser-check', '--window-size=1300,950'],
                })
          if (b !== 'firefox') await browser.defaultBrowserContext().overridePermissions(base, ['notifications'])
          const page = await loginWithRetry(browser, persona)
          entry.steps.push('login')
          const endpoint = await enableViaUi(page, persona)
          if (!endpoint) throw new Error('no PushManager subscription')
          endpoints.push(endpoint)
          entry.endpointHost = new URL(endpoint).host
          entry.steps.push(`subscribed:${entry.endpointHost}`)
          await sleep(800)
          const testBtn = (await clickByText(page, 'button', /^\s*Test alert\s*$/)) || (await clickByText(page, 'button', /Send test push/))
          if (!testBtn) throw new Error('test alert button missing')
          const shown = await waitShown(page, /Hakum alerts ready|Push is working/)
          if (!shown) throw new Error('self-test push not displayed within 45s')
          entry.steps.push('selfTest:displayed')
          desktopShot(join(outDir, `${label}-selftest-desktop.png`))
          await page.screenshot({ path: join(outDir, `${label}-selftest-page.png`) })
          await clearShown(page)
          entry.ok = true
          console.log('✔', label, entry.steps.join(' → '))
          if (AUDIT || EVENT_PERSONAS.has(persona)) sessions.push({ browser, page, entry, persona, profile })
          else {
            await browser.close().catch(() => null)
            rmSync(profile, { recursive: true, force: true })
          }
        } catch (err) {
          entry.error = String(err.message || err).slice(0, 300)
          console.error('✖', label, entry.error)
          if (browser) {
            const pages = await browser.pages().catch(() => [])
            if (pages[0]) await pages[0].screenshot({ path: join(outDir, `${label}-FAIL.png`) }).catch(() => null)
            await browser.close().catch(() => null)
          }
          rmSync(profile, { recursive: true, force: true })
        }
      }
    }

    if (!sessions.length) continue
    if (AUDIT) {
      const { runPushAudit } = await import('./push-audit-events.mjs')
      const audit = await runPushAudit({ base, db, sessions, userIds, outDir, desktopShot, clearShown, browserId: b })
      results.push({ audit: { browser: b, rows: audit } })
      for (const row of audit) if (!row.ok) sessions[0].entry.ok = false
      if (audit.some((r) => !r.ok)) sessions[0].entry.error = `audit: ${audit.filter((r) => !r.ok).length} event(s) failed`
      for (const s of sessions) {
        await s.browser.close().catch(() => null)
        rmSync(s.profile, { recursive: true, force: true })
      }
      sessions.length = 0
      continue
    }
    // Real business event: booking → waiting. Customer gets the visit update; branch ops (TL/admin) + global SA get the floor alert.
    const plate = `PUSHQA${b.slice(0, 2).toUpperCase()}`
    const notify = await notifyBookingStatus(
      { id: randomUUID(), customer_id: userIds.customer, customer_phone: null, customer_name: 'Demo Customer', branch: 'bacoor', vehicle_plate: plate, status: 'waiting' },
      'waiting',
    )
    const eventSummary = { browser: b, plate, customerPush: notify.push, opsPush: notify.ops?.push, opsTargets: notify.ops?.targets }
    console.log('event', JSON.stringify(eventSummary))
    results.push({ event: eventSummary })
    for (const s of sessions) {
      const shown = await waitShown(s.page, new RegExp(plate), 30000)
      s.entry.businessEvent = shown ? 'displayed' : 'not-displayed'
      if (shown) {
        desktopShot(join(outDir, `${b}-${s.persona}-event-desktop.png`))
        await s.page.screenshot({ path: join(outDir, `${b}-${s.persona}-event-page.png`) }).catch(() => null)
      } else {
        s.entry.ok = false
        s.entry.error = `business event ${plate} not displayed`
      }
      console.log(shown ? '✔' : '✖', `${b}-${s.persona}`, 'business event', s.entry.businessEvent)
      await s.browser.close().catch(() => null)
      rmSync(s.profile, { recursive: true, force: true })
    }
    sessions.length = 0
    await db.from('user_notifications').delete().like('body', `%${plate}%`)
  }
} finally {
  for (const s of sessions) {
    await s.browser.close().catch(() => null)
    rmSync(s.profile, { recursive: true, force: true })
  }
  if (endpoints.length) await db.from('push_subscriptions').delete().in('endpoint', endpoints)
  await db
    .from('user_notifications')
    .delete()
    .eq('kind', 'self_test')
    .in('user_id', Object.values(userIds).filter(Boolean))
    .gte('created_at', startedAt)
}

const rows = results.filter((r) => r.browser)
const failed = rows.filter((r) => !r.ok)
const summary = { ok: failed.length === 0, base, passed: rows.length - failed.length, total: rows.length, results, at: new Date().toISOString() }
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n---\nreal push ${summary.passed}/${summary.total}`)
if (failed.length) process.exit(1)
