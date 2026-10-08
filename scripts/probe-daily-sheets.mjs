/**
 * READ-ONLY: does each Daily Sheet actually agree with the money it claims to
 * represent?
 *
 * The daily-ops spine is POS sale -> Daily Sheet -> Finance approve -> books, and
 * every prior check looked at one link at a time: sales reconcile to their own
 * line items, sheets have no duplicates or negatives. Nobody checked that the
 * sheet's `totals` block matches the sales it is supposed to summarise — so a
 * sheet could approve a figure the POS never recorded and every other check
 * would still be green.
 *
 * Four independent reconciliations per sheet:
 *   A  internal   net = gross - discounts, totalExpenses = expenses + salaries,
 *                 netProfit = net - totalExpenses
 *   B  cash       expectedCash = cash - totalExpenses + openingFloat + caRepaid
 *   C  external  the sheet's byMethod / gross against the real `sales` rows for
 *                 that branch and business date
 *   D  lines      the sheet's own lines sum to the totals they claim
 *
 *   node scripts/probe-daily-sheets.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// PostgREST caps at max-rows and returns a SHORT page rather than erroring, so
// paging must continue until a genuinely short page comes back.
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

const peso = (m) => (Number(m || 0) / 100)
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

// Sales keyed by branch + Manila-local date, the way a shop day is counted.
const salesByDay = new Map()
for (const s of sales) {
  const d = new Date(s.occurred_at)
  const manila = new Date(d.getTime() + 8 * 3600 * 1000)
  const day = manila.toISOString().slice(0, 10)
  const k = `${s.branch}|${day}`
  if (!salesByDay.has(k)) salesByDay.set(k, { total: 0, discount: 0, byMethod: {}, count: 0, paid: 0 })
  const b = salesByDay.get(k)
  b.total += n(s.total_minor)
  b.discount += n(s.discount_minor)
  b.byMethod[s.payment_method || 'unknown'] = (b.byMethod[s.payment_method || 'unknown'] || 0) + n(s.total_minor)
  b.count += 1
  if (s.status === 'paid') b.paid += 1
}

const problems = []
const add = (sev, sheet, kind, message, detail) =>
  problems.push({ sev, sheet: `${sheet.branch}/${sheet.business_date}`, status: sheet.status, kind, message, ...detail })

for (const sh of sheets) {
  const t = sh.totals || {}
  const id = sh.id

  // ── A. internal arithmetic ────────────────────────────────────────────
  if (t.netMinor !== undefined && t.grossMinor !== undefined && t.discountsMinor !== undefined) {
    const expectNet = n(t.grossMinor) - n(t.discountsMinor)
    if (expectNet !== n(t.netMinor)) {
      add('High', sh, 'A', 'net != gross - discounts', { gross: peso(t.grossMinor), discounts: peso(t.discountsMinor), net: peso(t.netMinor), expected: peso(expectNet) })
    }
  }
  if (t.expensesMinor !== undefined && t.salariesMinor !== undefined && t.totalExpensesMinor !== undefined) {
    const expectTot = n(t.expensesMinor) + n(t.salariesMinor)
    if (expectTot !== n(t.totalExpensesMinor)) {
      add('High', sh, 'A', 'totalExpenses != expenses + salaries', { expenses: peso(t.expensesMinor), salaries: peso(t.salariesMinor), total: peso(t.totalExpensesMinor), expected: peso(expectTot) })
    }
  }
  if (t.netMinor !== undefined && t.totalExpensesMinor !== undefined && t.netProfitMinor !== undefined) {
    const expectProfit = n(t.netMinor) - n(t.totalExpensesMinor)
    if (expectProfit !== n(t.netProfitMinor)) {
      add('High', sh, 'A', 'netProfit != net - totalExpenses', { net: peso(t.netMinor), expenses: peso(t.totalExpensesMinor), netProfit: peso(t.netProfitMinor), expected: peso(expectProfit) })
    }
  }

  // ── B. cash reconciliation ────────────────────────────────────────────
  // derived from the three sheets that do balance, so it is the live formula
  // and not one invented to fit the data.
  if (t.expectedCashMinor !== undefined) {
    const expectCash = n(t.cashMinor) - n(t.totalExpensesMinor) + n(sh.opening_float_minor) + n(t.caRepaidMinor)
    if (expectCash !== n(t.expectedCashMinor)) {
      add('High', sh, 'B', 'expectedCash does not follow the cash formula', {
        cash: peso(t.cashMinor), totalExpenses: peso(t.totalExpensesMinor),
        openingFloat: peso(sh.opening_float_minor), caRepaid: peso(t.caRepaidMinor),
        sheetSays: peso(t.expectedCashMinor), formulaSays: peso(expectCash),
        deltaPHP: peso(expectCash - n(t.expectedCashMinor)),
      })
    }
    if (t.overShortMinor !== undefined && t.countedCashMinor !== undefined) {
      const expectOverShort = n(t.countedCashMinor) - n(t.expectedCashMinor)
      if (expectOverShort !== n(t.overShortMinor)) {
        add('Medium', sh, 'B', 'overShort != counted - expected', { overShort: peso(t.overShortMinor), expected: peso(expectOverShort) })
      }
    }
  }

  // ── C. against the real sales ─────────────────────────────────────────
  const k = `${sh.branch}|${sh.business_date}`
  const day = salesByDay.get(k)
  if (day && t.grossMinor !== undefined) {
    // Only compare when the sheet actually claims to cover the whole day.
    const sheetMethodSum = t.byMethod ? Object.values(t.byMethod).reduce((a, b) => a + n(b), 0) : null
    if (sheetMethodSum !== null && sheetMethodSum !== n(t.grossMinor)) {
      add('Medium', sh, 'C', 'byMethod does not sum to grossMinor', { byMethodSum: peso(sheetMethodSum), gross: peso(t.grossMinor) })
    }
    const delta = day.total - n(t.grossMinor)
    if (delta !== 0) {
      add('High', sh, 'C', 'sheet gross does not match the POS sales for that branch/day', {
        sheetGross: peso(t.grossMinor), salesTotal: peso(day.total), deltaPHP: peso(delta),
        salesCount: day.count, sheetCount: t.count,
      })
    }
  }

  // ── D. the sheet's own lines ──────────────────────────────────────────
  const ls = linesBySheet.get(id) || []
  const sumKind = (kind) => ls.filter((l) => l.kind === kind).reduce((a, l) => a + n(l.amount_minor), 0)
  if (t.expensesMinor !== undefined) {
    const e = sumKind('expense')
    if (e !== n(t.expensesMinor)) add('Medium', sh, 'D', 'expense lines != expensesMinor', { lines: peso(e), total: peso(t.expensesMinor) })
  }
  if (t.salariesMinor !== undefined) {
    const s = sumKind('salary')
    if (s !== n(t.salariesMinor)) add('Medium', sh, 'D', 'salary lines != salariesMinor', { lines: peso(s), total: peso(t.salariesMinor) })
  }
}

console.log(`=== ${problems.length} discrepancy(ies) across ${sheets.length} sheets ===\n`)
const bySev = problems.reduce((a, p) => ({ ...a, [p.sev]: (a[p.sev] || 0) + 1 }), {})
console.log(JSON.stringify(bySev))
for (const p of problems) {
  console.log(`\n[${p.sev}] ${p.sheet} (${p.status}) — ${p.kind}: ${p.message}`)
  console.log(`   ${JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => !['sev', 'sheet', 'status', 'kind', 'message'].includes(k))))}`)
}

console.log('\n(read-only probe — no writes issued)')