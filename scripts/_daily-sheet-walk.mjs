/* global document, location */
/**
 * Daily Sheet browser walk — BA fills + submits at POS → SA approves in Finance → P&L shows the posting.
 * Real demo logins, but every daily_sheets read / RPC, today's sales, attendance, CA requests and the
 * P&L view are served from an in-memory mock. Any other write to Supabase or /api is blocked and fails.
 * Server-side posting (approve → paid expenses) is proven separately by scripts/_daily-sheet-sql-check.mjs.
 * Run against a production preview — the dev server full-reloads on any file write (incl. this script's evidence).
 *   npm run build && npx vite preview --port 5176 --strictPort --host 127.0.0.1
 *   BASE_URL=http://127.0.0.1:5176 node scripts/_daily-sheet-walk.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../src/lib/cookieConsent.js'
import { DISMISS_KEY as INSTALL_DISMISS_KEY } from '../src/lib/installApp.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'daily-sheet')
mkdirSync(outDir, { recursive: true })
const base = (process.env.BASE_URL || 'http://127.0.0.1:5176').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
const at = (hhmm) => `${today}T${hhmm}:00+08:00`
const CREW_ID = '00000000-0000-4000-8000-0000000000d1'
const SHEET_ID = '00000000-0000-4000-8000-0000000000e1'
const line = (name, slug, pay, minor) => ({
  item_type: 'service', line_total_minor: minor, name, service_id: null, product_id: null,
  services: { name, slug, pay_category: pay, salary_pct: null }, products: null,
})
const SALES = [
  { id: '00000000-0000-4000-8000-00000000f001', branch: 'bacoor', status: 'paid', total_minor: 120000, discount_minor: 0, payment_method: 'cash', occurred_at: at('10:15'), booking_id: null, bookings: null, sale_line_items: [line('Carwash', 'carwash', 'wash', 120000)] },
  { id: '00000000-0000-4000-8000-00000000f002', branch: 'bacoor', status: 'paid', total_minor: 350000, discount_minor: 0, payment_method: 'gcash', occurred_at: at('13:40'), booking_id: null, bookings: null, sale_line_items: [line('Interior detailing', 'interior-detailing', 'detailing', 350000)] },
]
const ATTENDANCE = [
  { staff_id: CREW_ID, status: 'present', checked_in_at: at('08:00'), staff_profiles: { id: CREW_ID, full_name: 'Juan Walk', role: 'staff', daily_rate_minor: 50000, branch_slug: 'bacoor' } },
]
const CA_REQUESTS = [
  { id: '00000000-0000-4000-8000-0000000000c1', payload: { branch: 'bacoor', staff_id: CREW_ID, employee_name: 'Juan Walk', amount: 300 }, status: 'new', respondent_label: 'Juan Walk', created_at: at('09:00'), ops_forms: { kind: 'cash_advance' } },
]

let sheet = null
const notifyCalls = []
const blockedWrites = []
const rpcCalls = []
const failedRequests = []

/** Mirrors review_daily_sheet: approved sheet → one paid expense per expense/salary line with amount > 0. */
function plRows() {
  const rows = [{ branch: 'bacoor', period_date: today, kind: 'income', category: 'Sales', amount_minor: SALES.reduce((s, x) => s + x.total_minor, 0) }]
  if (sheet?.status !== 'approved') return rows
  for (const l of sheet.daily_sheet_lines) {
    if (!(l.amount_minor > 0)) continue
    if (l.kind === 'expense') rows.push({ branch: 'bacoor', period_date: today, kind: 'expense', category: l.account_label || 'Operating', amount_minor: l.amount_minor })
    if (l.kind === 'salary') rows.push({ branch: 'bacoor', period_date: today, kind: 'expense', category: 'Salaries & wages', amount_minor: l.amount_minor })
  }
  return rows
}

function matches(row, params) {
  for (const key of ['id', 'status', 'branch', 'business_date']) {
    for (const raw of params.getAll(key)) {
      const [op, ...rest] = raw.split('.')
      const v = rest.join('.')
      const cell = String(row[key] ?? '')
      if (op === 'eq' && cell !== v) return false
      if (op === 'gte' && cell < v) return false
      if (op === 'lte' && cell > v) return false
      if (op === 'in' && !v.replace(/[()]/g, '').split(',').includes(cell)) return false
    }
  }
  return true
}

const json = (req, body, status = 200, extra = {}) =>
  req.respond({
    status,
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json', ...extra },
    body: body === undefined ? '' : JSON.stringify(body),
  })

function listResponse(req, rows) {
  const url = new URL(req.url())
  const offset = Number(url.searchParams.get('offset') || 0)
  const page = offset ? [] : rows
  const range = `${page.length ? `0-${page.length - 1}` : '*'}/${rows.length}`
  if (req.method() === 'HEAD') return json(req, undefined, 200, { 'content-range': range })
  if (/vnd\.pgrst\.object/.test(req.headers().accept || '')) {
    return page.length ? json(req, page[0]) : json(req, { code: 'PGRST116', message: 'no rows' }, 406)
  }
  return json(req, page, 200, { 'content-range': range })
}

function saveSheet(p) {
  const lines = (p.lines || []).map((l, i) => ({
    ...l,
    id: l.id || `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    sort: i,
    staff_profiles: l.staff_id === CREW_ID ? { full_name: 'Juan Walk', role: 'staff' } : null,
    expense_categories: null,
    account_label: l.account_id ? accountLabels.get(l.account_id) || null : null,
  }))
  sheet = {
    id: SHEET_ID,
    branch: p.branch,
    business_date: p.business_date,
    status: sheet?.status === 'returned' ? 'returned' : 'draft',
    opening_float_minor: p.opening_float_minor,
    counted_cash_minor: p.counted_cash_minor,
    notes: p.notes,
    totals: p.totals,
    review_note: sheet?.review_note || null,
    submitted_by: 'ba',
    staff_profiles: { full_name: 'Bacoor Branch Admin' },
    daily_sheet_lines: lines,
  }
  return { id: SHEET_ID, status: sheet.status }
}
const accountLabels = new Map()

async function intercept(page) {
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    const url = req.url()
    const method = req.method()
    if (method === 'OPTIONS') return req.continue()
    const rest = url.match(/\/rest\/v1\/([^?]+)/)?.[1] || ''
    try {
      if (rest.startsWith('rpc/')) {
        const fn = rest.slice(4)
        const body = JSON.parse(req.postData() || '{}')
        const p = body.payload || {}
        rpcCalls.push(fn)
        if (fn === 'save_daily_sheet') return json(req, saveSheet(p))
        if (fn === 'submit_daily_sheet') {
          sheet.status = 'submitted'
          return json(req, { id: sheet.id, status: 'submitted', totals: sheet.totals })
        }
        if (fn === 'review_daily_sheet') {
          sheet.status = p.action === 'approve' ? 'approved' : 'returned'
          sheet.review_note = p.review_note || null
          return json(req, { id: sheet.id, status: sheet.status, posted: sheet.daily_sheet_lines.filter((l) => ['expense', 'salary'].includes(l.kind) && l.amount_minor > 0).length })
        }
        blockedWrites.push(`${method} rpc/${fn}`)
        return req.abort()
      }
      if (rest.startsWith('daily_sheets')) {
        if (method !== 'GET' && method !== 'HEAD') {
          blockedWrites.push(`${method} ${rest}`)
          return req.abort()
        }
        const params = new URL(url).searchParams
        return listResponse(req, sheet && matches(sheet, params) ? [sheet] : [])
      }
      if (method === 'GET' || method === 'HEAD') {
        if (rest.startsWith('sales')) return listResponse(req, SALES)
        if (rest.startsWith('staff_attendance')) return listResponse(req, ATTENDANCE)
        if (rest.startsWith('ops_form_submissions') && url.includes('cash_advance')) return listResponse(req, CA_REQUESTS)
        if (rest.startsWith('finance_daily_pl')) return listResponse(req, plRows())
        if (rest.startsWith('finance_daily_line_kind')) return listResponse(req, [])
        return req.continue()
      }
      if (url.includes('/api/notify-ops-event')) {
        notifyCalls.push(JSON.parse(req.postData() || '{}').event)
        return json(req, { ok: true, mocked: true })
      }
      if (url.includes('/auth/v1/token') || url.includes('/auth/v1/logout')) return req.continue()
      if (url.includes('/rest/v1/') || url.includes('/storage/v1/') || url.includes('/api/')) {
        blockedWrites.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 120)}`)
        return req.abort()
      }
      return req.continue()
    } catch (err) {
      console.error('intercept error', rest, err.message)
      return req.abort()
    }
  })
  page.on('response', async (res) => {
    if (!res.url().includes('/rest/v1/expense_categories') || res.request().method() !== 'GET') return
    try {
      for (const c of await res.json()) accountLabels.set(c.id, c.name)
    } catch {
      /* preflight / empty */
    }
  })
}

const text = (page) => page.evaluate(() => document.body.innerText)
const settle = async (page) => {
  await page.waitForFunction(() => !/VERIFYING ACCESS/i.test(document.body?.innerText || ''), { timeout: 30000 }).catch(() => null)
  await sleep(1200)
}
/** "(₱150.00)" is accounting-negative. */
const pesoNum = (s) => {
  const n = Number(String(s).replace(/[^\d.]/g, '')) || 0
  return /\(.*\)|^-/.test(String(s).trim()) ? -n : n
}

async function login(browser, id) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(90000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)} ${r.failure()?.errorText || ''}`))
  await intercept(page)
  await page.setViewport({ width: 1440, height: 900 })
  const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === id)
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((consentKey, consent, installKey) => {
    localStorage.setItem(consentKey, consent)
    localStorage.setItem(installKey, String(Date.now()))
    sessionStorage.clear()
  }, COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, choice: 'necessary', at: new Date().toISOString() }), INSTALL_DISMISS_KEY)
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', acct.email)
  await page.type('input[type="password"]', acct.password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForFunction(() => location.pathname.startsWith('/operations') && !location.pathname.includes('login'), { timeout: 60000 })
  } catch (err) {
    await page.screenshot({ path: join(outDir, `login-fail-${id}.png`) })
    throw new Error(`${id} login stuck at ${page.url()}: ${(await text(page)).slice(0, 300).replace(/\s+/g, ' ')}`, { cause: err })
  }
  return { page, errors }
}

async function summaryRow(page, label) {
  return page.evaluate((lab) => {
    const aside = document.querySelector('aside.ds-summary')
    const rows = [...(aside?.querySelectorAll('.ds-row, div') || [])]
    const row = rows.find((r) => r.children.length >= 2 && r.children[0].textContent.trim() === lab)
    return row ? row.children[row.children.length - 1].textContent.trim() : null
  }, label)
}

async function setValue(page, selector, value) {
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.type(selector, value)
}

async function shoot(page, name, widths = [375, 768, 1440]) {
  for (const w of widths) {
    await page.setViewport({ width: w, height: w === 375 ? 812 : 900 })
    await sleep(700)
    await page.screenshot({ path: join(outDir, `${name}-${w}.png`), fullPage: w !== 1440 })
  }
  await page.setViewport({ width: 1440, height: 900 })
  await sleep(400)
}

const watchdog = setTimeout(() => {
  console.log('FAIL walk watchdog: still running after 6 minutes')
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ today, results, rpcCalls, notifyCalls, blockedWrites, watchdog: true }, null, 2))
  process.exit(1)
}, 6 * 60 * 1000)
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 60000 })
try {
  // ── Branch Admin fills and submits ──
  const ba = await login(browser, 'admin')
  await ba.page.goto(`${base}/operations/pos?tab=sheet`, { waitUntil: 'domcontentloaded' })
  await settle(ba.page)
  await ba.page.waitForSelector('section[aria-label="Money out"]', { timeout: 30000 })
  let body = await text(ba.page)
  check('BA: sheet loads for today', /Daily sheet/i.test(body) && /Money out/.test(body), today)
  check('BA: mocked sales feed Net sales ₱4,700', /4,700\.00/.test((await summaryRow(ba.page, 'Net sales')) || ''), await summaryRow(ba.page, 'Net sales'))
  check('BA: clocked-in crew gets a suggested salary line', /Juan Walk/.test(body) && /Suggested/.test(body))
  check('BA: submit blocked until float + count entered', await ba.page.$eval('aside .ds-submit', (b) => b.disabled))

  const buttons = async (re) => ba.page.$$eval('button', (els, src) => els.filter((e) => new RegExp(src).test(e.textContent)).length, re.source)
  check('BA: CA request shows as a one-tap chip', (await buttons(/Juan Walk · /)) > 0)
  await ba.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Juan Walk · /.test(b.textContent))?.click())
  await sleep(300)

  await ba.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Add expense/i.test(b.textContent))?.click())
  await sleep(300)
  const expDesc = await ba.page.$('input[id^="ds-exp-d-"]')
  check('BA: expense line added', Boolean(expDesc))
  await expDesc.type('Ice and soap')
  const firstAccount = await ba.page.$eval('select[id^="ds-exp-a-"]', (sel) => {
    const opt = [...sel.options].find((o) => o.value && !/payroll|salar/i.test(o.textContent)) || [...sel.options].find((o) => o.value)
    return opt ? { value: opt.value, label: opt.textContent } : null
  }).catch(() => null)
  if (firstAccount) await ba.page.select('select[id^="ds-exp-a-"]', firstAccount.value)
  const accountPicked = firstAccount?.label
  check('BA: expense account picked from chart', Boolean(accountPicked), accountPicked || 'no select / options')
  const expAmt = await ba.page.$('input[id^="ds-exp-m-"]')
  check('BA: new expense amount starts empty (no leading 0)', (await expAmt.evaluate((i) => i.value)) === '')
  await expAmt.type('150')
  await setValue(ba.page, '#ds-float', '1000')
  await sleep(400)
  const expected = await summaryRow(ba.page, 'Expected cash')
  await setValue(ba.page, '#ds-count', String(pesoNum(expected)))
  await sleep(2200)

  const net = pesoNum(await summaryRow(ba.page, 'Net sales'))
  const exp = pesoNum(await summaryRow(ba.page, 'Expenses'))
  const sal = pesoNum(await summaryRow(ba.page, 'Salaries'))
  const profit = pesoNum(await summaryRow(ba.page, 'Net profit'))
  const caOut = pesoNum(await summaryRow(ba.page, 'CA given out'))
  const exp2 = pesoNum(await summaryRow(ba.page, 'Expected cash'))
  check('BA: Net profit = Net sales − Expenses − Salaries', Math.abs(net + exp + sal - profit) < 0.01, `${net} ${exp} ${sal} → ${profit}`)
  check('BA: Expected cash = float + cash sales − expenses − salaries − CA out', Math.abs(1000 + 1200 + exp + sal + caOut - exp2) < 0.01, `1000+1200${exp}${sal}${caOut} → ${exp2}`)
  check('BA: CA release ₱300 counted in drawer', Math.abs(caOut + 300) < 0.01, String(caOut))
  check('BA: autosave called save_daily_sheet', rpcCalls.includes('save_daily_sheet'))
  check('BA: over/short is zero', /0\.00/.test((await summaryRow(ba.page, 'Over / short')) || ''), await summaryRow(ba.page, 'Over / short'))
  await shoot(ba.page, 'ba-sheet-filled')

  const canSubmit = await ba.page.$eval('aside .ds-submit', (b) => !b.disabled)
  check('BA: Submit enabled once complete', canSubmit, (await ba.page.$$eval('.ds-missing li', (l) => l.map((x) => x.textContent))).join(' | '))
  await ba.page.click('aside .ds-submit')
  await ba.page.waitForFunction(() => /Waiting for approval/.test(document.body.innerText), { timeout: 15000 }).catch(() => null)
  body = await text(ba.page)
  check('BA: submit RPC called and sheet locked', rpcCalls.includes('submit_daily_sheet') && /Waiting for approval/.test(body) && !(await ba.page.$('aside .ds-submit')), `rpc: ${rpcCalls.join(',')} · failed: ${failedRequests.join(' | ')}`)
  check('BA: sheet_submitted push requested (mocked)', notifyCalls.includes('sheet_submitted'), notifyCalls.join(','))
  await shoot(ba.page, 'ba-sheet-submitted', [375, 1440])

  // ── Super Admin approves in Finance ──
  const sa = await login(browser, 'boss')
  await sa.page.goto(`${base}/operations/finance?tab=sheets&period=today`, { waitUntil: 'domcontentloaded' })
  await settle(sa.page)
  await sa.page.waitForFunction(() => /One sheet per branch per day/.test(document.body.innerText), { timeout: 30000 }).catch(() => null)
  body = await text(sa.page)
  check('SA: Daily sheets inbox lists the submitted sheet', body.includes(today) && /Waiting for approval/.test(body), '')
  await shoot(sa.page, 'sa-inbox')
  await sa.page.evaluate((d) => [...document.querySelectorAll('button.ds-link')].find((b) => b.textContent.trim() === d)?.click(), today)
  const drawerText = () => sa.page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].find((d) => /Review daily sheet/.test(d.innerText))?.innerText || '')
  await sa.page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /Review daily sheet/.test(d.innerText) && /Ice and soap/.test(d.innerText)), { timeout: 20000 }).catch(() => null)
  body = await drawerText()
  check('SA: review drawer shows lines read-only', /Ice and soap/.test(body) && /Juan Walk/.test(body) && !(await sa.page.$('[role="dialog"] input[id^="ds-exp-d-"]')), body.slice(0, 120).replace(/\s+/g, ' '))
  const drawerWidth = await sa.page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].find((d) => /Review daily sheet/.test(d.innerText))?.getBoundingClientRect().width || 0)
  check('SA: review drawer is wide enough to read the sheet at 1440 (≥ 900px)', drawerWidth >= 900, `${Math.round(drawerWidth)}px`)
  check('SA: drawer totals match BA summary (net profit)', body.includes(`₱${profit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`), String(profit))
  await shoot(sa.page, 'sa-review')
  await sa.page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Approve')?.click())
  await sa.page.waitForFunction(() => !/Review daily sheet/.test(document.body.innerText), { timeout: 15000 }).catch(() => null)
  check('SA: approve RPC called', rpcCalls.includes('review_daily_sheet') && sheet?.status === 'approved', sheet?.status)
  check('SA: sheet_reviewed push requested (mocked)', notifyCalls.includes('sheet_reviewed'), notifyCalls.join(','))

  // ── P&L reflects the posting ──
  await sa.page.goto(`${base}/operations/finance?tab=pl&period=today`, { waitUntil: 'domcontentloaded' })
  await settle(sa.page)
  await sa.page.waitForFunction(() => /Total operating expenses/.test(document.body.innerText), { timeout: 30000 }).catch(() => null)
  body = await text(sa.page)
  const postedMinor = sheet.daily_sheet_lines.filter((l) => ['expense', 'salary'].includes(l.kind)).reduce((s, l) => s + l.amount_minor, 0)
  const postedText = (postedMinor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })
  check('P&L: salaries posted under Salaries & wages', /Salaries & wages/.test(body))
  check(`P&L: total operating expenses = sheet expenses + salaries (₱${postedText})`, body.includes(postedText.replace(/\.00$/, '')), postedText)
  check('P&L: income ₱4,700 from sales', /4,700/.test(body))
  await shoot(sa.page, 'sa-pl')

  // ── Old shift closes are history only ──
  await sa.page.goto(`${base}/operations/finance?tab=shift-close&period=month`, { waitUntil: 'domcontentloaded' })
  await settle(sa.page)
  await sa.page.waitForFunction(() => /Read-only history/.test(document.body.innerText), { timeout: 30000 }).catch(() => null)
  const shiftButtons = await sa.page.$$eval('button', (els) => els.map((e) => e.textContent.trim()).filter((t) => /^(Accept|Reject|Lock day|Reopen for a new count)$/.test(t)))
  check('Old shift closes: read-only (no Accept / Reject / Lock)', /Read-only history/.test(await text(sa.page)) && shiftButtons.length === 0, shiftButtons.join(','))

  // ── BA sees approval ──
  await ba.page.goto(`${base}/operations/pos?tab=sheet`, { waitUntil: 'domcontentloaded' })
  await settle(ba.page)
  await ba.page.waitForFunction(() => /Approved/.test(document.body.innerText), { timeout: 20000 }).catch(() => null)
  check('BA: sees Approved: release pay', /Approved: release pay/.test(await text(ba.page)))

  check('no blocked production writes', blockedWrites.length === 0, blockedWrites.join(' | '))
  check('no page errors', !ba.errors.length && !sa.errors.length, [...ba.errors, ...sa.errors].join(' | ').slice(0, 300))
} catch (err) {
  check('walk finished', false, err.stack?.split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close().catch(() => null)
  clearTimeout(watchdog)
}

writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ today, results, rpcCalls, notifyCalls, blockedWrites }, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
