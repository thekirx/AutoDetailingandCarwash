/**
 * READ-ONLY: does the Finance Daily-sheets screen show the numbers the database
 * actually holds?
 *
 * The chain has been verified link by link and never end to end:
 *   sales -> line items        verified (sale totals reconcile)
 *   sales + lines -> totals    verified (computeSheetTotals matches all 60 sheets)
 *   totals -> THE SCREEN       never checked
 *
 * The last link is the one an owner actually looks at. A wrong format, a stale
 * cache, a per-branch filter silently applied, or a column reading the wrong
 * field would all leave the database correct and the screen wrong, and nothing
 * in the test suite would notice — the wave checks that the page opens and that
 * RBAC holds, never what it says.
 *
 * Reads the rendered table and compares it to the stored `totals` for the same
 * branch/date. Read-only: it logs in, navigates, and reads. It writes nothing.
 *
 *   node scripts/check-sheet-ui.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { safeEvaluate } from './lib/safe-evaluate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const FROM = '2026-09-01'
const TO = '2026-09-30'

async function ensurePreview() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  const isWin = process.platform === 'win32'
  const port = process.env.PREVIEW_PORT || process.env.DEV_PORT || '5199'
  const base = `http://127.0.0.1:${port}`
  console.log(`Starting vite dev on ${base}…`)
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
    } catch { /* wait */ }
  }
  if (!ready) { preview.kill(); throw new Error('vite dev server did not become ready') }
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

/**
 * Wait for the sheets table to actually finish loading.
 *
 * `waitSettled` only waits for the auth gate to clear; the Finance page then
 * renders its own skeleton ("Loading…") while the sheet query runs. Reading the
 * table during that window yields zero rows and looks identical to a real
 * empty result, which is how a "no discrepancies" pass could be manufactured
 * out of a page that never loaded.
 */
async function waitForSheetsTable(page) {
  for (let i = 0; i < 40; i++) {
    const state = await safeEvaluate(page, () => ({
      loading: /loading…/i.test(document.body?.innerText || ''),
      rows: document.querySelectorAll('table tbody tr').length,
      tables: document.querySelectorAll('table').length,
    })).catch(() => ({ loading: true, rows: 0, tables: 0 }))
    if (!state.loading && (state.rows > 0 || state.tables > 0)) return state
    await new Promise((r) => setTimeout(r, 1000))
  }
  return { loading: true, rows: 0, tables: 0 }
}

/** Parse the rendered money back into minor units. */
function parseMoney(text) {
  const t = String(text || '').trim()
  if (!t || t === '—' || t === '-') return null
  const negative = /^\(.*\)$/.test(t) || t.startsWith('-')
  const digits = t.replace(/[^0-9.]/g, '')
  if (!digits) return null
  const v = Number(digits) * 100
  return negative ? -v : v
}

let server = null
let browser = null
let failures = 0

try {
  // ── What the database holds ────────────────────────────────────────────
  const sheets = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db
      .from('daily_sheets')
      .select('id, branch, business_date, status, totals')
      .gte('business_date', FROM)
      .lte('business_date', TO)
      .range(from, from + 499)
    if (error) { console.error('DB read failed:', error.message); process.exit(1) }
    sheets.push(...(data || []))
    if (!data || data.length < 500) break
  }
  const { data: branches } = await db.from('branches').select('slug, name')
  // The screen renders `branchName(slug)`, which falls back to the raw slug when
  // the branch is missing from its options list — and it is missing for bacoor.
  // Keying only on the name therefore mismatches every bacoor row and looks
  // like 60 discrepancies when the figures are identical. Accept either form.
  const labelToSlug = new Map()
  for (const b of branches || []) {
    labelToSlug.set(b.slug, b.slug)
    if (b.name) labelToSlug.set(b.name, b.slug)
  }
  const expected = new Map()
  for (const s of sheets) {
    expected.set(`${s.business_date}|${s.branch}`, {
      slug: s.branch,
      net: Number(s.totals?.netMinor || 0),
      profit: Number(s.totals?.netProfitMinor || 0),
      expenses: Number(s.totals?.expensesMinor || 0),
      salaries: Number(s.totals?.salariesMinor || 0),
    })
  }
  console.log(`DB: ${sheets.length} sheet(s) between ${FROM} and ${TO}\n`)

  server = await ensurePreview()
  const { base } = server
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e?.message || e).slice(0, 200)}`))

  // Sign in as Super Admin, who can review sheets.
  const account = OPS_DEMO_ACCOUNTS[0]
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const email = await page.$('input[type="email"], input[name="email"]')
  const pass = await page.$('input[type="password"]')
  await email.click({ clickCount: 3 })
  await email.type(account.email, { delay: 5 })
  await pass.click({ clickCount: 3 })
  await pass.type(account.password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.startsWith('/operations/login'), { timeout: 60000 }).catch(() => null)
  await new Promise((r) => setTimeout(r, 800))
  console.log(`signed in -> ${page.url()}`)
  if (page.url().includes('/login')) throw new Error('sign-in failed')

  // The tab defaults to `status=submitted` — it is a review inbox by design
  // (FinancePage.jsx: `status={extras.status || 'submitted'}`), which is correct
  // product behaviour but shows only the sheets awaiting a decision. Ask for
  // all of them so the comparison covers the month rather than the queue.
  const target = `${base}/operations/finance?tab=sheets&period=custom&from=${FROM}&to=${TO}&branch=all&status=all`
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  const ready = await waitForSheetsTable(page)
  console.log(`opened ${target}`)
  console.log(`load state: tables=${ready.tables} rows=${ready.rows} stillLoading=${ready.loading}\n`)

  // Column order in FinanceDailySheetsTab: [checkbox, date, branch, submitted by,
  // net sales, expenses, salaries, net profit, over/short, status]
  const rows = await safeEvaluate(page, () => {
    const out = []
    for (const tr of document.querySelectorAll('table tbody tr')) {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())
      if (cells.length >= 9) out.push({ date: cells[1], branch: cells[2], net: cells[4], expenses: cells[5], salaries: cells[6], profit: cells[7] })
    }
    return out
  })

  console.log(`UI: ${rows.length} row(s) rendered`)
  if (!rows.length) {
    // Diagnose rather than shrug. An empty table has several very different
    // causes — a page error, a range that filtered everything out, a role that
    // cannot see sheets, or a table that moved — and they must not be reported
    // as one undifferentiated failure.
    const diag = await safeEvaluate(page, () => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 1500),
      tables: document.querySelectorAll('table').length,
      tableHeads: [...document.querySelectorAll('table thead')].map((t) => t.innerText.replace(/\s+/g, ' ').slice(0, 200)),
    }))
    const errors = consoleErrors.splice(0, 8)
    console.log('\n--- diagnosis ---')
    console.log(`url            : ${diag.url}`)
    console.log(`tables in page : ${diag.tables}`)
    for (const h of diag.tableHeads) console.log(`thead          : ${h}`)
    console.log(`console errors : ${errors.length ? errors.join(' | ') : '(none)'}`)
    console.log('visible text   :')
    console.log(diag.text)
    await page.screenshot({ path: join(root, 'e2e-evidence', 'db-audit', 'sheet-ui-empty.png'), fullPage: false }).catch(() => null)

    console.log('\nNOT VERIFIED — the table rendered no rows, so nothing could be compared.')
    console.log('This is NOT a pass. See the diagnosis above and e2e-evidence/db-audit/sheet-ui-empty.png')
    failures++
  } else {
    const problems = []
    for (const r of rows) {
      const slug = labelToSlug.get(String(r.branch).trim())
      const key = `${r.date}|${slug || r.branch}`
      const want = expected.get(key)
      if (!want) {
        problems.push({ key, renderedBranch: r.branch, why: 'no matching sheet in the database for this range/branch label' })
        continue
      }
      for (const [field, rendered] of [['net', r.net], ['expenses', r.expenses], ['salaries', r.salaries], ['profit', r.profit]]) {
        const got = parseMoney(rendered)
        if (got === null) { problems.push({ key, why: `${field} could not be parsed from "${rendered}"` }); continue }
        if (Math.abs(got - want[field]) > 0.5) {
          problems.push({ key, field, rendered, renderedMinor: got, dbMinor: want[field], deltaPHP: (got - want[field]) / 100 })
        }
      }
    }
    const covered = new Set(rows.map((r) => `${r.date}|${labelToSlug.get(String(r.branch).trim()) || r.branch}`))
    console.log(`matched ${covered.size} of ${expected.size} sheet(s) in range`)
    if (rows.length <= 5) {
      console.log('rows actually rendered:')
      for (const r of rows) console.log('  ', JSON.stringify(r))
    }

    if (problems.length) {
      failures++
      console.log(`\n${problems.length} DISCREPANCY(IES) between the screen and the database:`)
      for (const p of problems.slice(0, 20)) console.log('  ', JSON.stringify(p))
    } else {
      console.log('\nOK — every rendered figure equals the stored total for that branch/date.')
    }
    if (covered.size < expected.size) {
      console.log(`\nNOTE: only ${covered.size}/${expected.size} sheets were visible in this range, so this proves the`)
      console.log('figures that WERE shown, not the whole month.')
    }
  }
} catch (err) {
  failures++
  console.error('\nFAILED:', err?.message || err)
} finally {
  if (browser) await browser.close().catch(() => null)
  if (server?.stop) await server.stop().catch(() => null)
}

console.log(failures === 0 ? '\nPASS' : '\nNOT PASS')
process.exit(failures === 0 ? 0 : 1)