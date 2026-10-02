/**
 * Xero-style books views over finance_daily_pl rows ({ branch, period_date, kind, category, amount_minor }).
 * Pure: rows in, tables out. Used by Finance Home (watchlist, YTD chart) and P&L (periods / branches).
 */

const amount = (v) => Number(v) || 0
const pad = (n) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function lastDayOfMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** One calendar period (month / quarter / year) that contains ymd, shifted back `back` periods. */
export function calendarPeriod(ymd, unit = 'month', back = 0) {
  const [y0, m0] = String(ymd).split('-').map(Number)
  if (unit === 'year') {
    const y = y0 - back
    return { key: String(y), label: String(y), start: `${y}-01-01`, end: `${y}-12-31` }
  }
  const span = unit === 'quarter' ? 3 : 1
  const first = unit === 'quarter' ? Math.floor((m0 - 1) / 3) * 3 + 1 : m0
  const idx = y0 * 12 + (first - 1) - back * span
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const endM = m + span - 1
  const label = unit === 'quarter' ? `Q${Math.floor((m - 1) / 3) + 1} ${y}` : `${MONTHS[m - 1]} ${y}`
  return { key: `${y}-${pad(m)}`, label, start: `${y}-${pad(m)}-01`, end: `${y}-${pad(endM)}-${pad(lastDayOfMonth(y, endM))}` }
}

export const PL_LAYOUTS = [
  { id: '', label: 'Statement' },
  { id: 'fy', label: 'This year by month' },
  { id: 'compare', label: 'Compare periods' },
  { id: 'branches', label: 'Compare branches' },
]
export const PERIOD_UNITS = [
  { id: 'month', label: 'Months' },
  { id: 'quarter', label: 'Quarters' },
  { id: 'year', label: 'Years' },
]

/** URL `by` → P&L layout. `by=month|quarter|year` means "compare with `n` (1–12) previous periods". */
export function parsePlLayout(by, n) {
  const unit = PERIOD_UNITS.some((u) => u.id === by) ? by : null
  const layout = unit ? 'compare' : PL_LAYOUTS.some((l) => l.id === by && l.id !== 'compare') ? by : ''
  const count = Math.max(1, Math.min(12, Math.round(Number(n) || 1)))
  return { layout, unit: unit || 'month', count }
}

/** The period holding `end` plus `count` (0–12) earlier ones, oldest first — Xero "Compare with N periods". */
export function buildComparePeriods({ end, unit = 'month', count = 0 } = {}) {
  const n = Math.max(0, Math.min(12, Math.round(Number(count) || 0)))
  return Array.from({ length: n + 1 }, (_, i) => calendarPeriod(end, unit, n - i))
}

/** Jan → Dec of the year holding `today` (Xero "Current financial year by month"). */
export function yearMonths(today) {
  const y = String(today).slice(0, 4)
  return Array.from({ length: 12 }, (_, i) => calendarPeriod(`${y}-${pad(i + 1)}-01`, 'month', 0))
}

/**
 * Pivot P&L rows into account × column amounts. colOf(row) → column index, or -1 to skip.
 * Returns { income, expense, totals } where each account row is { category, values[], total }.
 */
export function pivotPl(plRows, columnCount, colOf) {
  const sections = { income: new Map(), expense: new Map() }
  const totals = { income: Array(columnCount).fill(0), expenses: Array(columnCount).fill(0), net: Array(columnCount).fill(0) }
  for (const r of plRows || []) {
    const map = sections[r?.kind]
    if (!map) continue
    const col = colOf(r)
    if (col < 0 || col >= columnCount) continue
    const key = r.category || 'Uncategorized'
    if (!map.has(key)) map.set(key, { category: key, values: Array(columnCount).fill(0), total: 0 })
    const row = map.get(key)
    row.values[col] += amount(r.amount_minor)
    row.total += amount(r.amount_minor)
    totals[r.kind === 'income' ? 'income' : 'expenses'][col] += amount(r.amount_minor)
  }
  totals.net = totals.income.map((v, i) => v - totals.expenses[i])
  const sorted = (map) => [...map.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
  return { income: sorted(sections.income), expense: sorted(sections.expense), totals }
}

export function plByPeriods(plRows, periods) {
  return pivotPl(plRows, periods.length, (r) => periods.findIndex((p) => r.period_date >= p.start && r.period_date <= p.end))
}

export function plByBranches(plRows, branchSlugs) {
  return pivotPl(plRows, branchSlugs.length, (r) => branchSlugs.indexOf(r.branch))
}

/** Expense accounts sorted by code (Xero chart order); rows without a code go last. */
export function accountOrder(accounts = []) {
  const byName = new Map((accounts || []).map((a) => [a.name, a]))
  return (category) => {
    const code = byName.get(category)?.code
    return code ? Number(code) : 999
  }
}

/** Xero "Account watchlist": income first, then each expense account with This month and YTD. */
export function accountWatchlist(plRows, accounts, { today } = {}) {
  const month = String(today).slice(0, 7)
  const year = String(today).slice(0, 4)
  const rows = new Map()
  const touch = (kind, category) => {
    const key = `${kind}:${category}`
    if (!rows.has(key)) rows.set(key, { kind, category, monthMinor: 0, ytdMinor: 0 })
    return rows.get(key)
  }
  for (const a of accounts || []) if (a.code) touch('expense', a.name)
  for (const r of plRows || []) {
    const d = String(r?.period_date || '')
    if (!['income', 'expense'].includes(r?.kind) || d.slice(0, 4) !== year || d > today) continue
    const row = touch(r.kind, r.category || 'Uncategorized')
    row.ytdMinor += amount(r.amount_minor)
    if (d.slice(0, 7) === month) row.monthMinor += amount(r.amount_minor)
  }
  const codeOf = new Map((accounts || []).map((a) => [a.name, a.code || '']))
  const order = accountOrder(accounts)
  return [...rows.values()]
    .map((r) => ({ ...r, code: r.kind === 'income' ? '' : codeOf.get(r.category) || '' }))
    .sort((a, b) => (a.kind === b.kind ? order(a.category) - order(b.category) || a.category.localeCompare(b.category) : a.kind === 'income' ? -1 : 1))
}

/** Net profit by month for the year holding `today`, with last year's net as a ghost series (pesos). */
export function monthlyProfitYtd(plRows, { today } = {}) {
  const y = Number(String(today).slice(0, 4))
  const rows = MONTHS.map((label, i) => ({ month: label, key: pad(i + 1), income: 0, expenses: 0, net: 0, priorNet: 0 }))
  for (const r of plRows || []) {
    const d = String(r?.period_date || '')
    const ry = Number(d.slice(0, 4))
    const m = Number(d.slice(5, 7)) - 1
    if (m < 0 || m > 11 || !['income', 'expense'].includes(r?.kind)) continue
    const sign = r.kind === 'income' ? 1 : -1
    const pesos = amount(r.amount_minor) / 100
    if (ry === y && d <= today) {
      rows[m][r.kind === 'income' ? 'income' : 'expenses'] += pesos
      rows[m].net += sign * pesos
    } else if (ry === y - 1) {
      rows[m].priorNet += sign * pesos
    }
  }
  return rows.map((r) => ({ ...r, income: round2(r.income), expenses: round2(r.expenses), net: round2(r.net), priorNet: round2(r.priorNet) }))
}

const round2 = (n) => Math.round(n * 100) / 100

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Line amount in centavos: qty × unit price (pesos text like "1,250.50"). NaN when invalid. */
export function billLineMinor(line) {
  const qty = Number(line?.quantity)
  const unit = Number(String(line?.unit_price ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0 || String(line?.unit_price ?? '').trim() === '') return NaN
  return Math.round(qty * Math.round(unit * 100))
}

/**
 * Xero "New bill" → one expenses row per line. Header: vendor_id, date, due_date, reference.
 * Lines: item, description, quantity, unit_price, category_id, branch. Dated at noon Manila on `date`.
 */
export function buildBillRows(header, lines) {
  const fail = (error) => ({ ok: false, error, rows: [], totalMinor: 0 })
  if (!header?.vendor_id) return fail('Choose who the bill is from.')
  if (!YMD.test(header?.date || '')) return fail('Enter the bill date.')
  if (header.due_date && (!YMD.test(header.due_date) || header.due_date < header.date)) return fail('Due date must be on or after the bill date.')
  const reference = String(header.reference || '').trim()
  if (reference.length > 80) return fail('Reference is too long (80 characters max).')
  const filled = (lines || []).filter((l) => String(l?.item || '').trim() || String(l?.unit_price || '').trim())
  if (!filled.length) return fail('Add at least one line.')
  const rows = []
  for (const [i, l] of filled.entries()) {
    const n = i + 1
    if (!String(l.item || '').trim()) return fail(`Line ${n}: enter the item.`)
    const total = billLineMinor(l)
    if (!Number.isFinite(total)) return fail(`Line ${n}: enter a quantity above 0 and a unit price.`)
    if (!l.category_id) return fail(`Line ${n}: choose an account.`)
    if (!l.branch) return fail(`Line ${n}: choose a branch.`)
    rows.push({
      title: String(l.item).trim(),
      description: String(l.description || '').trim() || null,
      quantity: Number(l.quantity),
      unit_cost_minor: Math.round(Number(String(l.unit_price).replace(/,/g, '')) * 100),
      total_minor: total,
      branch: l.branch,
      category_id: l.category_id,
      vendor_id: header.vendor_id,
      bill_reference: reference || null,
      due_date: header.due_date || null,
      created_at: `${header.date}T12:00:00+08:00`,
    })
  }
  return { ok: true, error: '', rows, totalMinor: rows.reduce((s, r) => s + r.total_minor, 0) }
}

export const DISCOUNTS_ROW = 'Discounts and adjustments'

/**
 * Trading income by service family. Replaces each branch-day POS income row with one row per family
 * (paid line totals from finance_daily_line_kind) plus a "Discounts and adjustments" row for the
 * difference, so income still sums exactly to the paid sale totals.
 */
export function tradingIncomeRows(plRows, kindRows, labels = {}) {
  if (!kindRows?.length) return plRows || []
  const fam = new Map()
  for (const k of kindRows) {
    const key = `${k.branch}|${k.period_date}`
    if (!fam.has(key)) fam.set(key, [])
    fam.get(key).push(k)
  }
  const out = []
  for (const r of plRows || []) {
    if (r?.kind !== 'income') {
      out.push(r)
      continue
    }
    const lines = fam.get(`${r.branch}|${r.period_date}`) || []
    let familySum = 0
    for (const k of lines) {
      familySum += amount(k.amount_minor)
      out.push({ branch: r.branch, period_date: r.period_date, kind: 'income', category: labels[k.line_kind] || 'Other sales', amount_minor: amount(k.amount_minor) })
    }
    const diff = amount(r.amount_minor) - familySum
    if (diff) out.push({ branch: r.branch, period_date: r.period_date, kind: 'income', category: DISCOUNTS_ROW, amount_minor: diff })
  }
  return out
}

/** Flatten a pivot into export rows (CSV / Excel / PDF): one row per account, one column per heading. */
export function pivotExportRows(pivot, headings) {
  const line = (section, category, values, total) => ({
    section,
    account: category,
    ...Object.fromEntries(headings.map((h, i) => [h, ((values[i] || 0) / 100).toFixed(2)])),
    total: (total / 100).toFixed(2),
  })
  const sum = (arr) => arr.reduce((s, v) => s + v, 0)
  return [
    ...pivot.income.map((r) => line('Trading income', r.category, r.values, r.total)),
    line('Trading income', 'Total trading income', pivot.totals.income, sum(pivot.totals.income)),
    ...pivot.expense.map((r) => line('Operating expenses', r.category, r.values, r.total)),
    line('Operating expenses', 'Total operating expenses', pivot.totals.expenses, sum(pivot.totals.expenses)),
    line('Bottom line', 'Net profit', pivot.totals.net, sum(pivot.totals.net)),
  ]
}
