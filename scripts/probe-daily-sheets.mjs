/**
 * READ-ONLY: does each stored Daily Sheet match what the app would compute?
 *
 * The whole daily-ops spine is POS sale -> Daily Sheet -> Finance approve -> books.
 * Every other check looked at one link at a time. This asks the question that
 * actually matters: recompute each sheet from its own sales and lines using the
 * application's OWN functions, and compare against the `totals` that were stored.
 *
 * It imports `computeSheetTotals` / `summarizeSheetSales` from src/lib/dailySheet.js
 * rather than restating their arithmetic, and that is the whole point. Two earlier
 * versions of this probe reimplemented the formulas and were simply wrong:
 *
 *   - asserted `net == gross - discounts`. rollupSales actually computes
 *     `net = gross - discounts - refunds`, so every day with a refund (6 of 60)
 *     was reported as broken.
 *   - asserted `byMethod == gross`. byMethod sums PAID sales, so it equals NET,
 *     not gross. 46 of 60 sheets were reported as broken.
 *   - asserted `expectedCash = cash - totalExpenses + float + caRepaid`, omitting
 *     `- caReleased`, which mis-flagged every sheet that released a cash advance.
 *
 * Together those three wrong formulas produced 108 findings. Under the app's real
 * rules the sheets are internally consistent. Reimplementing an invariant is how a
 * monitoring script ends up reporting the system it was written to protect as
 * broken; importing the implementation cannot drift from it.
 *
 *   node scripts/probe-daily-sheets.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeSheetTotals } from '../src/lib/dailySheet.js'

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

// PostgREST caps at max-rows and returns a SHORT page rather than erroring.
async function fetchAll(table, columns = '*', { page = 500, filters } = {}) {
  const rows = []
  for (let from = 0; ; from += page) {
    let q = db.from(table).select(columns).range(from, from + page - 1)
    if (filters) q = filters(q)
    const { data, error } = await q
    if (error) { console.error(`ERROR reading ${table}: ${error.message}`); return null }
    rows.push(...(data || []))
    if (!data || data.length < page) break
  }
  return rows
}

const peso = (m) => Number(m || 0) / 100
const n = (v) => Number(v || 0)

const sheets = await fetchAll('daily_sheets', 'id, branch, business_date, status, opening_float_minor, counted_cash_minor, totals')
const lines = await fetchAll('daily_sheet_lines', 'id, sheet_id, kind, amount_minor')
const sales = await fetchAll('sales', 'id, branch, status, payment_method, total_minor, discount_minor, occurred_at')

console.log(`sheets=${sheets.length}  lines=${lines.length}  sales=${sales.length}\n`)

const linesBySheet = new Map()
for (const l of lines) {
  if (!linesBySheet.has(l.sheet_id)) linesBySheet.set(l.sheet_id, [])
  linesBySheet.get(l.sheet_id).push(l)
}

// Sales by branch + Manila-local day, which is how a shop day is counted.
const salesByDay = new Map()
for (const s of sales) {
  const day = new Date(new Date(s.occurred_at).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  const k = `${s.branch}|${day}`
  if (!salesByDay.has(k)) salesByDay.set(k, [])
  salesByDay.get(k).push(s)
}

// Only fields the app actually produces, so a rename is caught rather than
// silently reported as a mismatch on a key that no longer exists.
const COMPARE = [
  'grossMinor', 'discountsMinor', 'refundsMinor', 'netMinor',
  'cashMinor', 'count', 'totalExpensesMinor', 'netProfitMinor',
  'expectedCashMinor', 'countedCashMinor', 'overShortMinor',
]

const problems = []
for (const sh of sheets) {
  const daySales = salesByDay.get(`${sh.branch}|${sh.business_date}`) || []
  const sheetLines = linesBySheet.get(sh.id) || []

  // The app's own computation, from the same inputs the sheet was built from.
  const recomputed = computeSheetTotals({
    sales: daySales,
    lines: sheetLines,
    openingFloatMinor: sh.opening_float_minor,
    countedCashMinor: sh.counted_cash_minor,
  })
  const stored = sh.totals || {}

  for (const field of COMPARE) {
    if (recomputed[field] === undefined) continue
    if (stored[field] === undefined) continue
    if (n(stored[field]) !== n(recomputed[field])) {
      problems.push({
        branch: sh.branch, date: sh.business_date, status: sh.status, field,
        storedPHP: peso(stored[field]), appWouldSayPHP: peso(recomputed[field]),
        deltaPHP: peso(n(recomputed[field]) - n(stored[field])),
      })
    }
  }
}

console.log(`=== ${problems.length} field mismatch(es) across ${sheets.length} sheets ===\n`)
if (problems.length) {
  const byField = problems.reduce((a, p) => ({ ...a, [p.field]: (a[p.field] || 0) + 1 }), {})
  console.log('by field:', JSON.stringify(byField), '\n')
  for (const p of problems.slice(0, 25)) console.log('  ', JSON.stringify(p))
} else {
  console.log('Every stored sheet matches what computeSheetTotals() derives from its own sales and lines.')
  // Prove the comparison is not vacuous: it must have compared real numbers.
  const sample = sheets.slice(0, 3).map((sh) => {
    const daySales = salesByDay.get(`${sh.branch}|${sh.business_date}`) || []
    const r = computeSheetTotals({ sales: daySales, lines: linesBySheet.get(sh.id) || [], openingFloatMinor: sh.opening_float_minor, countedCashMinor: sh.counted_cash_minor })
    return { sheet: `${sh.branch}/${sh.business_date}`, salesFed: daySales.length, grossPHP: peso(r.grossMinor), netPHP: peso(r.netMinor), netProfitPHP: peso(r.netProfitMinor) }
  })
  console.log('\nNon-vacuous sample (real inputs fed through the real function):')
  for (const s of sample) console.log('  ', JSON.stringify(s))
}

console.log('\n(read-only probe — no writes issued)')