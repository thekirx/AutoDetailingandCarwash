/** Finance pure helpers: date presets, P&L rollup, payment-method breakdown, exports.
 * No React, no Supabase. Branch scope reuses the ops RBAC seam.
 */

import { getBranchScopeList } from '../auth/permissions.js'

export const FINANCE_TABS = [
  { id: 'overview', label: 'Dashboard', hint: 'Business overview for the selected window', group: 'Books' },
  { id: 'sales', label: 'Sales', hint: 'POS sales by day, branch, and payment method', group: 'Business' },
  { id: 'purchases', label: 'Bills & expenses', hint: 'Expenses and bills to pay', group: 'Business' },
  { id: 'pl', label: 'Profit and loss', hint: 'Income vs expenses by category', group: 'Accounting' },
  { id: 'shift-close', label: 'Shift reviews', hint: 'End-of-shift closes vs POS baseline', group: 'Accounting' },
  { id: 'expense-reports', label: 'Expense reports', hint: 'ASA category reports posted to expenses', group: 'Accounting' },
  { id: 'vendors', label: 'Vendors', hint: 'Supplier contacts for bills', group: 'Settings' },
  { id: 'quotes', label: 'Quotations', hint: 'Email quotations to CRM customers', group: 'Settings' },
  { id: 'corporate', label: 'Corporate', hint: 'HQ books, EOM roll-up, manual cash balance', group: 'Settings' },
  { id: 'categories', label: 'Categories', hint: 'Expense categories (POS daily-expense source)', group: 'Settings' },
  { id: 'reports', label: 'Reports', hint: 'Sales, operations, and retention exports', group: 'Reports' },
]

export const FINANCE_TAB_IDS = FINANCE_TABS.map((t) => t.id)

const FINANCE_TAB_ALIASES = { expenses: 'purchases' }

export function resolveFinanceTab(raw) {
  const key = FINANCE_TAB_ALIASES[raw] || raw
  return FINANCE_TAB_IDS.includes(key) ? key : 'overview'
}

export const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: '3mo', label: 'Last 3 months' },
  { value: '6mo', label: 'Last 6 months' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
]

export const COMPARE_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'previous', label: 'Previous period' },
  { value: 'previous_year', label: 'Previous year' },
]

function parseYmd(value) {
  const [y, m, d] = String(value || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Equal-length previous window, or same dates last year. Returns null for 'none'. */
export function financeCompareRange(startStr, endStr, mode) {
  if (!mode || mode === 'none') return null
  const start = parseYmd(startStr)
  const end = parseYmd(endStr)
  if (!start || !end) return null
  if (mode === 'previous_year') {
    start.setFullYear(start.getFullYear() - 1)
    end.setFullYear(end.getFullYear() - 1)
    return { start: formatYmd(start), end: formatYmd(end) }
  }
  const spanMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getTime() - spanMs)
  return { start: formatYmd(prevStart), end: formatYmd(prevEnd) }
}

/** Merge current + prior P&L rows by kind+category with delta / deltaPct. */
export function mergePlByCategory(currentRows, priorRows) {
  const map = new Map()
  for (const r of plByCategory(currentRows)) {
    map.set(`${r.kind}:${r.category}`, {
      kind: r.kind,
      category: r.category,
      current: r.amount_minor,
      prior: 0,
    })
  }
  for (const r of plByCategory(priorRows)) {
    const key = `${r.kind}:${r.category}`
    if (!map.has(key)) {
      map.set(key, { kind: r.kind, category: r.category, current: 0, prior: r.amount_minor })
    } else {
      map.get(key).prior = r.amount_minor
    }
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      amount_minor: r.current,
      delta: r.current - r.prior,
      deltaPct: r.prior === 0 ? (r.current === 0 ? 0 : 100) : Math.round(((r.current - r.prior) / Math.abs(r.prior)) * 1000) / 10,
    }))
    .sort((a, b) => b.current - a.current)
}

/** Returns {start, end} as Manila-calendar ISO date strings (YYYY-MM-DD). */
export function financeRange(preset, customStart, customEnd, now = new Date()) {
  const toManilaDay = (d) =>
    d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  if (preset === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd }
  }
  if (preset === 'today') {
    const d = toManilaDay(now)
    return { start: d, end: d }
  }
  if (preset === 'yesterday') {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    const day = toManilaDay(d)
    return { start: day, end: day }
  }
  if (preset === 'week') {
    const start = new Date(now)
    const day = start.getDay()
    const offset = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + offset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  if (preset === 'last_7') {
    const end = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  if (preset === 'last_30') {
    const end = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear(), 11, 31)
    return { start: toManilaDay(start), end: toManilaDay(end) }
  }
  const months = preset === '6mo' ? 6 : 3
  const end = new Date(now)
  const start = new Date(now)
  start.setMonth(start.getMonth() - months)
  return { start: toManilaDay(start), end: toManilaDay(end) }
}

/** Compact human window for headers: "1–31 Aug 2026" or "11 Aug 2026". */
export function formatFinanceWindow(startStr, endStr) {
  const start = parseYmd(startStr)
  const end = parseYmd(endStr)
  if (!start || !end) return `${startStr || '—'} to ${endStr || '—'}`
  const sameDay = startStr === endStr
  const dayMonthYear = { day: 'numeric', month: 'short', year: 'numeric' }
  if (sameDay) return start.toLocaleDateString('en-PH', dayMonthYear)
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
  if (sameMonth) {
    const monthYear = end.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
    return `${start.getDate()}–${end.getDate()} ${monthYear}`
  }
  return `${start.toLocaleDateString('en-PH', dayMonthYear)} – ${end.toLocaleDateString('en-PH', dayMonthYear)}`
}

/** Percent change vs prior; null when prior is zero and current is zero. */
export function pctChange(current, prior) {
  const c = Number(current) || 0
  const p = Number(prior) || 0
  if (p === 0) return c === 0 ? null : 100
  return Math.round(((c - p) / Math.abs(p)) * 1000) / 10
}

/** Manila-calendar ISO timestamps for Supabase range queries. */
export function financeRangeIso(preset, customStart, customEnd, now = new Date()) {
  const { start, end } = financeRange(preset, customStart, customEnd, now)
  return {
    startIso: `${start}T00:00:00+08:00`,
    endIso: `${end}T23:59:59.999+08:00`,
    start,
    end,
  }
}

export function scopeBranch(query, profile, branchFilter) {
  const list = branchScopeList(profile)
  if (list === null) {
    if (branchFilter && branchFilter !== 'all') return query.eq('branch', branchFilter)
    return query
  }
  if (branchFilter && branchFilter !== 'all' && list.includes(branchFilter)) {
    return query.eq('branch', branchFilter)
  }
  if (list.length === 1) return query.eq('branch', list[0])
  if (list.length > 1) {
    if (branchFilter && branchFilter !== 'all') return query.eq('branch', '__none__')
    return query.in('branch', list)
  }
  return query.eq('branch', '__none__')
}

/** Same Branch scope seam as ops RBAC. BossMich is `BossMich`, never `super_admin`. */
export function branchScopeList(profile) {
  if (!profile) return []
  return getBranchScopeList(profile)
}

/** Sum a key across rows (minor units). */
export function sumMinor(rows, key) {
  return (rows || []).reduce((acc, r) => acc + Number(r?.[key] || 0), 0)
}

/** P&L rollup: income, expenses, net, margin %. */
export function rollupPl(rows) {
  let income = 0
  let expenses = 0
  for (const r of rows || []) {
    const amt = Number(r.amount_minor || 0)
    if (r.kind === 'income') income += amt
    else if (r.kind === 'expense') expenses += amt
  }
  const net = income - expenses
  const margin = income > 0 ? Math.round((net / income) * 1000) / 10 : 0
  return { income, expenses, net, margin }
}

/** Group P&L rows by category → {category, kind, amount_minor}. */
export function plByCategory(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = `${r.kind}:${r.category}`
    if (!map.has(key)) {
      map.set(key, { kind: r.kind, category: r.category, amount_minor: 0 })
    }
    map.get(key).amount_minor += Number(r.amount_minor || 0)
  }
  return [...map.values()].sort((a, b) => b.amount_minor - a.amount_minor)
}

/** Group sales by day → [{sale_date, total_sales_minor, cash, gcash, card, online, paid_count}]. */
export function salesByDay(salesRows) {
  const map = new Map()
  for (const r of salesRows || []) {
    const key = r.sale_date
    if (!map.has(key)) {
      map.set(key, {
        sale_date: key,
        total_sales_minor: 0,
        cash_minor: 0,
        gcash_minor: 0,
        card_minor: 0,
        online_minor: 0,
        paid_count: 0,
        transaction_count: 0,
      })
    }
    const row = map.get(key)
    row.total_sales_minor += Number(r.total_sales_minor || 0)
    row.cash_minor += Number(r.cash_sales_minor || 0)
    row.gcash_minor += Number(r.gcash_sales_minor || 0)
    row.card_minor += Number(r.card_sales_minor || 0)
    row.online_minor += Number(r.online_sales_minor || 0)
    row.paid_count += Number(r.paid_count || 0)
    row.transaction_count += Number(r.transaction_count || 0)
  }
  return [...map.values()].sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1))
}

/** Branch × day ledger rows for Sales tab (preserves multi-branch accuracy). */
export function salesLedgerRows(salesRows) {
  return [...(salesRows || [])]
    .map((r) => ({
      branch: r.branch,
      sale_date: r.sale_date,
      total_sales_minor: Number(r.total_sales_minor || 0),
      cash_minor: Number(r.cash_sales_minor || 0),
      gcash_minor: Number(r.gcash_sales_minor || 0),
      card_minor: Number(r.card_sales_minor || 0),
      online_minor: Number(r.online_sales_minor || 0),
      paid_count: Number(r.paid_count || 0),
      transaction_count: Number(r.transaction_count || 0),
      average_ticket_minor: Number(r.average_ticket_minor || 0),
    }))
    .sort((a, b) => {
      if (a.sale_date !== b.sale_date) return a.sale_date < b.sale_date ? 1 : -1
      return String(a.branch || '').localeCompare(String(b.branch || ''))
    })
}

/** Group sales by branch → [{branch, total_sales_minor, paid_count, transaction_count}]. */
export function salesByBranch(salesRows) {
  const map = new Map()
  for (const r of salesRows || []) {
    const key = r.branch
    if (!map.has(key)) {
      map.set(key, { branch: key, total_sales_minor: 0, paid_count: 0, transaction_count: 0 })
    }
    const row = map.get(key)
    row.total_sales_minor += Number(r.total_sales_minor || 0)
    row.paid_count += Number(r.paid_count || 0)
    row.transaction_count += Number(r.transaction_count || 0)
  }
  return [...map.values()].sort((a, b) => b.total_sales_minor - a.total_sales_minor)
}

/** Daily cash-flow series from finance_daily_pl (oldest → newest). Chart values in pesos. */
export function plTrendByDay(plRows) {
  const map = new Map()
  for (const r of plRows || []) {
    const key = r.period_date
    if (!key) continue
    if (!map.has(key)) map.set(key, { date: key, income_minor: 0, expenses_minor: 0 })
    const row = map.get(key)
    const amt = Number(r.amount_minor || 0)
    if (r.kind === 'income') row.income_minor += amt
    else if (r.kind === 'expense') row.expenses_minor += amt
  }
  return [...map.values()]
    .map((r) => ({
      date: r.date,
      income: r.income_minor / 100,
      expenses: r.expenses_minor / 100,
      net: (r.income_minor - r.expenses_minor) / 100,
      income_minor: r.income_minor,
      expenses_minor: r.expenses_minor,
      net_minor: r.income_minor - r.expenses_minor,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Top expense categories for horizontal bars (pesos + minor). */
export function topExpenseCategories(plRows, limit = 6) {
  return plByCategory(plRows)
    .filter((r) => r.kind === 'expense' && r.amount_minor > 0)
    .slice(0, limit)
    .map((r) => ({
      category: r.category,
      amount: r.amount_minor / 100,
      amount_minor: r.amount_minor,
    }))
}

/**
 * Principal-owner readouts from POS + P&L in the window.
 * Pure helpers — no fake fill when books are empty.
 */
export function financeOwnerInsights(salesRows, plRows) {
  const pl = rollupPl(plRows)
  const paidCount = (salesRows || []).reduce((acc, r) => acc + Number(r.paid_count || 0), 0)
  const salesTotal = sumMinor(salesRows, 'total_sales_minor')
  const cash = sumMinor(salesRows, 'cash_sales_minor')
  const avgTicketMinor = paidCount > 0 ? Math.round(salesTotal / paidCount) : 0
  const cashShare = salesTotal > 0 ? Math.round((cash / salesTotal) * 1000) / 10 : 0
  const expenseRatio = pl.income > 0 ? Math.round((pl.expenses / pl.income) * 1000) / 10 : null
  const byDay = salesByDay(salesRows)
  const busiest = byDay.length
    ? [...byDay].sort((a, b) => b.total_sales_minor - a.total_sales_minor)[0]
    : null

  const cues = []
  if (pl.income === 0 && pl.expenses === 0) {
    cues.push({
      tone: 'neutral',
      text: 'No paid sales or posted expenses in this window. Close POS days or post bills to populate books.',
    })
  } else {
    if (expenseRatio != null && expenseRatio >= 80) {
      cues.push({
        tone: 'warn',
        text: `Expenses are ${expenseRatio}% of income — open Profit and loss and cut the top categories.`,
      })
    }
    if (pl.margin < 15 && pl.income > 0) {
      cues.push({
        tone: 'warn',
        text: `Net margin is ${pl.margin}% — raise average ticket or trim operating spend.`,
      })
    }
    if (cashShare >= 65 && salesTotal > 0) {
      cues.push({
        tone: 'info',
        text: `Cash is ${cashShare}% of sales — reconcile till vs GCash/card before shift close.`,
      })
    }
    if (busiest) {
      cues.push({
        tone: 'info',
        text: `Strongest POS day in window: ${busiest.sale_date}. Staff that day pattern on busy weeks.`,
      })
    }
    if (paidCount > 0 && avgTicketMinor > 0) {
      cues.push({
        tone: 'info',
        text: `${paidCount} paid tickets · watch average ticket in Sales when running promos.`,
      })
    }
  }

  return {
    paidCount,
    avgTicketMinor,
    cashShare,
    expenseRatio,
    busiestDay: busiest?.sale_date || null,
    busiestSalesMinor: busiest?.total_sales_minor || 0,
    cues,
  }
}

/** CSV via papaparse (already installed). Returns a string. */
export function toCsv(rows, columns) {
  const header = columns.map((c) => c.label)
  const data = (rows || []).map((row) =>
    columns.map((c) => {
      const v = c.value ? c.value(row) : row[c.key]
      return v == null ? '' : String(v)
    }),
  )
  // papaparse is loaded as a global in the browser bundle; in Node tests we fall back.
  const unparse = (typeof window !== 'undefined' && window.Papa && window.Papa.unparse) ? window.Papa.unparse : null
  // eslint-disable-next-line no-undef
  const globalPapa = (typeof Papa !== 'undefined' && Papa.unparse) ? Papa.unparse : null
  if (unparse) return unparse({ fields: header, data })
  if (globalPapa) return globalPapa({ fields: header, data })
  // Fallback: RFC 4180 minimal CSV.
  const esc = (s) => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s)
  return [header, ...data].map((line) => line.map(esc).join(',')).join('\n')
}

/** Excel via HTML table — opens in Excel/Sheets with proper columns. */
export function toExcelHtml(rows, columns, title = 'Hakum Finance') {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
  const body = (rows || [])
    .map((row) =>
      `<tr>${columns
        .map((c) => {
          const v = c.value ? c.value(row) : row[c.key]
          return `<td>${v == null ? '' : escapeHtml(String(v))}</td>`
        })
        .join('')}</tr>`,
    )
    .join('')
  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Trigger a browser download for a Blob with the given filename + mime. */
export function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(rows, columns, filename) {
  downloadBlob(toCsv(rows, columns), filename, 'text/csv;charset=utf-8;')
}

export function downloadExcel(rows, columns, filename, title) {
  downloadBlob(toExcelHtml(rows, columns, title), filename, 'application/vnd.ms-excel')
}

/** Open a print-friendly window with the table; user picks "Save as PDF". */
export function printAsPdf(rows, columns, title, subtitle = '') {
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups for this site to export PDF.')
    return
  }
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
  const body = (rows || [])
    .map((row) =>
      `<tr>${columns
        .map((c) => {
          const v = c.value ? c.value(row) : row[c.key]
          return `<td>${v == null ? '' : escapeHtml(String(v))}</td>`
        })
        .join('')}</tr>`,
    )
    .join('')
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #475569; font-size: 12px; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #020a31; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { @page { margin: 16mm; } }
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
  </body></html>`)
  win.document.close()
}

/** Retention buckets: new (1 paid sale), returning (2-4), loyal (5+). */
export function retentionBuckets(customers) {
  let fresh = 0
  let returning = 0
  let loyal = 0
  for (const c of customers || []) {
    const n = Number(c.paid_sales || 0)
    if (n <= 0) continue
    if (n === 1) fresh += 1
    else if (n < 5) returning += 1
    else loyal += 1
  }
  return { fresh, returning, loyal, total: fresh + returning + loyal }
}

/** Collapse per-branch retention rows into one customer when Finance is on All branches. */
export function rollupRetentionByCustomer(rows = []) {
  const byId = new Map()
  for (const row of rows || []) {
    const id = row?.customer_id
    if (!id) continue
    const cur = byId.get(id)
    if (!cur) {
      byId.set(id, {
        ...row,
        paid_sales: Number(row.paid_sales) || 0,
        total_spent_minor: Number(row.total_spent_minor) || 0,
      })
      continue
    }
    cur.paid_sales += Number(row.paid_sales) || 0
    cur.total_spent_minor += Number(row.total_spent_minor) || 0
    if (row.first_paid_at && (!cur.first_paid_at || row.first_paid_at < cur.first_paid_at)) {
      cur.first_paid_at = row.first_paid_at
    }
    if (row.last_paid_at && (!cur.last_paid_at || row.last_paid_at > cur.last_paid_at)) {
      cur.last_paid_at = row.last_paid_at
    }
  }
  return [...byId.values()].sort((a, b) => b.total_spent_minor - a.total_spent_minor)
}

/** Chart hover: peso amount's share of the series total. */
export function shareOfTotal(value, total) {
  const n = Number(value) || 0
  const t = Number(total) || 0
  const percent = t <= 0 ? 0 : Math.round((Math.abs(n) / t) * 1000) / 10
  return { value: n, percent }
}
