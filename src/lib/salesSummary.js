/** Square-style sales summary helpers (Finance Dashboard + Reports).
 * Pure: rows in, numbers out. Money stays in minor units unless noted.
 * ponytail: rollups run in the browser over raw `sales` rows. Ceiling is roughly one year
 * of sales (tens of thousands of rows) per page load; upgrade path is a server
 * `finance_sales_summary` view once migrations can be applied again.
 */
import { financeCompareRange, pctChange } from './financeData.js'

const COUNTED = new Set(['paid', 'refunded'])
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const METHOD_BUCKET = { cash: 'cash', gcash: 'gcash', card: 'card', online: 'card' }
const PAYMENT_LABELS = { cash: 'Cash', gcash: 'GCash', card: 'Card', other: 'Other' }

/** Gross / net / discounts / refunds / count / average + paid payment buckets. */
export function rollupSales(rows = []) {
  const out = {
    grossMinor: 0,
    discountsMinor: 0,
    refundsMinor: 0,
    netMinor: 0,
    count: 0,
    avgMinor: 0,
    byMethod: { cash: 0, gcash: 0, card: 0, other: 0 },
    collectedMinor: 0,
  }
  for (const r of rows || []) {
    if (!COUNTED.has(r?.status)) continue
    const total = Number(r.total_minor) || 0
    const discount = Number(r.discount_minor) || 0
    out.grossMinor += total + discount
    out.discountsMinor += discount
    out.count += 1
    if (r.status === 'refunded') {
      out.refundsMinor += total
      continue
    }
    out.netMinor += total
    out.byMethod[METHOD_BUCKET[r.payment_method] || 'other'] += total
  }
  out.collectedMinor = out.netMinor
  out.avgMinor = out.count ? Math.round(out.grossMinor / out.count) : 0
  return out
}

/** Cash / GCash / Card (+ Other only when non-zero) with % of total collected. */
export function paymentTypes(summary) {
  const collected = summary?.collectedMinor || 0
  return Object.entries(summary?.byMethod || {})
    .filter(([id, minor]) => id !== 'other' || minor > 0)
    .map(([id, minor]) => ({
      id,
      label: PAYMENT_LABELS[id],
      minor,
      share: collected > 0 ? Math.round((minor / collected) * 1000) / 10 : 0,
    }))
}

/** Square shows N/A when there is nothing to compare against. */
export function vsPrior(current, prior) {
  return Number(prior) ? pctChange(current, prior) : null
}

export function laborPct(laborMinorValue, netMinor) {
  return netMinor > 0 ? Math.round((laborMinorValue / netMinor) * 1000) / 10 : null
}

/** Paid/posted crew pay: salary_* expense kinds or a payroll-kind category. */
export function laborMinor(expenses = [], categories = [], branch = null) {
  const payrollCats = new Set((categories || []).filter((c) => c.kind === 'payroll').map((c) => c.id))
  let total = 0
  for (const e of expenses || []) {
    if (e.status !== 'paid' && e.status !== 'posted') continue
    if (branch && e.branch !== branch) continue
    const isLabor = String(e.expense_kind || '').startsWith('salary_') || payrollCats.has(e.category_id)
    if (isLabor) total += Number(e.total_minor) || 0
  }
  return total
}

/** Square "Locations" rows: net, transactions, labor %, change vs prior. */
export function salesByLocation(rows = [], priorRows = [], laborByBranch = {}) {
  const branches = new Set([...(rows || []), ...(priorRows || [])].map((r) => r.branch).filter(Boolean))
  return [...branches]
    .map((branch) => {
      const cur = rollupSales(rows.filter((r) => r.branch === branch))
      const prior = rollupSales(priorRows.filter((r) => r.branch === branch))
      return {
        branch,
        netMinor: cur.netMinor,
        count: cur.count,
        netPct: vsPrior(cur.netMinor, prior.netMinor),
        countPct: vsPrior(cur.count, prior.count),
        laborPct: laborPct(laborByBranch[branch] || 0, cur.netMinor),
      }
    })
    .sort((a, b) => b.netMinor - a.netMinor)
}

/** Top items by gross with a sold count (sum of quantity, default 1 per line). */
export function topItems(lines = [], limit = 10) {
  const map = new Map()
  for (const line of lines || []) {
    const name = line.name || 'Unknown'
    const key = `${line.item_type || 'item'}:${name}`
    const row = map.get(key) || { name, count: 0, grossMinor: 0 }
    row.count += Number(line.quantity) || 1
    row.grossMinor += Number(line.line_total_minor) || 0
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.grossMinor - a.grossMinor).slice(0, limit)
}

function manilaParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    month: Number(p.month) - 1,
    hour: Number(p.hour),
    minute: Number(p.minute),
    time: `${p.hour}:${p.minute}:${p.second}`,
  }
}

const utc = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const ymdOf = (date) => date.toISOString().slice(0, 10)

function addDays(ymd, n) {
  const d = utc(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return ymdOf(d)
}

function addMonths(ymd, n) {
  const d = utc(ymd)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return ymdOf(d)
}

const fmt = (ymd, opts) => utc(ymd).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })

function formatDay(ymd) {
  return fmt(ymd, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSpan(start, end) {
  if (start === end) return formatDay(start)
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${fmt(start, { month: 'short', day: 'numeric' })} to ${formatDay(end)}`
  }
  return `${formatDay(start)} to ${formatDay(end)}`
}

function clockLabel(hour, minute) {
  const h = hour % 12 || 12
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`
}

const TO_DATE_SHIFT = {
  today: (ymd) => addDays(ymd, -7),
  week: (ymd) => addDays(ymd, -7),
  month: (ymd) => addMonths(ymd, -1),
  quarter: (ymd) => addMonths(ymd, -3),
  year: (ymd) => addMonths(ymd, -12),
}

/** Square "vs" window: prior period up to the same point (Today = same weekday last week). */
export function salesCompareWindow(preset, range, now = new Date()) {
  const shift = TO_DATE_SHIFT[preset]
  const clock = manilaParts(now)
  const today = clock.ymd
  if (shift && range?.start && today >= range.start && today <= range.end) {
    const start = shift(range.start)
    let end = shift(today)
    const priorPeriodEnd = addDays(range.start, -1)
    if (preset !== 'today' && end > priorPeriodEnd) end = priorPeriodEnd
    const cutoffIso = `${end}T${clock.time}+08:00`
    const label =
      preset === 'today'
        ? `vs ${formatDay(end)} (up to ${clockLabel(clock.hour, clock.minute)})`
        : `vs ${formatSpan(start, end)}`
    return { start, end, startIso: `${start}T00:00:00+08:00`, endIso: cutoffIso, cutoffIso, label }
  }
  const prev = financeCompareRange(range?.start, range?.end, 'previous')
  if (!prev) return null
  return {
    ...prev,
    startIso: `${prev.start}T00:00:00+08:00`,
    endIso: `${prev.end}T23:59:59.999+08:00`,
    cutoffIso: null,
    label: `vs ${formatSpan(prev.start, prev.end)}`,
  }
}

/** "Today, Sep 28, 2026" · "This year, 2026" · "This quarter, Q3 2026". */
export function salesPeriodLabel(preset, range) {
  const { start, end } = range || {}
  if (!start || !end) return ''
  if (preset === 'today') return `Today, ${formatDay(start)}`
  if (preset === 'week') return `This week, ${formatSpan(start, end)}`
  if (preset === 'month') return `This month, ${fmt(start, { month: 'short', year: 'numeric' })}`
  if (preset === 'quarter') return `This quarter, Q${Math.floor(utc(start).getUTCMonth() / 3) + 1} ${start.slice(0, 4)}`
  if (preset === 'year') return `This year, ${start.slice(0, 4)}`
  return formatSpan(start, end)
}

/** Gross sales per Manila month, Jan through the current month (pesos, for charts). */
export function grossByMonth(rows = [], priorRows = [], now = new Date()) {
  const months = manilaParts(now).month + 1
  const series = MONTHS.slice(0, months).map((month) => ({ month, current: 0, prior: 0 }))
  const add = (list, key) => {
    for (const r of list || []) {
      if (!COUNTED.has(r?.status) || !r.occurred_at) continue
      const m = manilaParts(new Date(r.occurred_at)).month
      if (m >= months) continue
      series[m][key] += ((Number(r.total_minor) || 0) + (Number(r.discount_minor) || 0)) / 100
    }
  }
  add(rows, 'current')
  add(priorRows, 'prior')
  return series
}
