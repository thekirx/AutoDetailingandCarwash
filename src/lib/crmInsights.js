/** Part 7 CRM Insights helpers — pure aggregates over sales / line items. */

export function hourInTimeZone(iso, timeZone = 'Asia/Manila') {
  const raw = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  }).format(new Date(iso))
  const h = Number(raw)
  if (!Number.isFinite(h)) return 0
  return h === 24 ? 0 : h
}

export function aggregateSalesByHour(sales = [], timeZone = 'Asia/Manila') {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, total_minor: 0 }))
  for (const sale of sales) {
    if (!sale?.occurred_at) continue
    const hour = hourInTimeZone(sale.occurred_at, timeZone)
    hours[hour].count += 1
    hours[hour].total_minor += Number(sale.total_minor || 0)
  }
  return hours
}

export function peakSalesHour(hourly = []) {
  let best = null
  for (const row of hourly) {
    if (!best || row.count > best.count || (row.count === best.count && row.total_minor > best.total_minor)) {
      best = row
    }
  }
  return best?.count ? best : null
}

/** Display order Mon..Sun; `id` is the JS weekday (0 = Sunday). */
export const WEEKDAYS = [
  { id: 1, short: 'Mon', long: 'Monday' },
  { id: 2, short: 'Tue', long: 'Tuesday' },
  { id: 3, short: 'Wed', long: 'Wednesday' },
  { id: 4, short: 'Thu', long: 'Thursday' },
  { id: 5, short: 'Fri', long: 'Friday' },
  { id: 6, short: 'Sat', long: 'Saturday' },
  { id: 0, short: 'Sun', long: 'Sunday' },
]
export const ALL_WEEKDAYS = WEEKDAYS.map((d) => d.id)

const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 'YYYY-MM-DD' of an instant in Asia/Manila. */
export function manilaDateKey(value = new Date()) {
  return manilaDay.format(new Date(value))
}

function keyToUtc(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDaysToKey(key, n) {
  return new Date(keyToUtc(key) + n * 86400000).toISOString().slice(0, 10)
}

export function weekdayOfKey(key) {
  return new Date(keyToUtc(key)).getUTCDay()
}

export const INSIGHT_DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'week', label: 'This week' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: '3mo', label: 'Last 3 months' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom range' },
]

const isKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))

/** Inclusive Manila date range for an Insights preset; null when a custom range is incomplete. */
export function insightsDateRange(preset, customStart, customEnd, today = manilaDateKey()) {
  const [ty, tm] = today.split('-').map(Number)
  const firstOfMonth = (y, m) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
  switch (preset) {
    case 'today': return { start: today, end: today }
    case 'yesterday': { const y = addDaysToKey(today, -1); return { start: y, end: y } }
    case 'last7': return { start: addDaysToKey(today, -6), end: today }
    case 'last30': return { start: addDaysToKey(today, -29), end: today }
    case 'week': return { start: addDaysToKey(today, -((weekdayOfKey(today) + 6) % 7)), end: today }
    case 'month': return { start: firstOfMonth(ty, tm), end: today }
    case 'last_month': {
      const start = firstOfMonth(tm === 1 ? ty - 1 : ty, tm === 1 ? 12 : tm - 1)
      return { start, end: addDaysToKey(firstOfMonth(ty, tm), -1) }
    }
    case '3mo': {
      const dayOfMonth = Math.min(Number(today.slice(8)), new Date(Date.UTC(ty, tm - 3, 0)).getUTCDate())
      return { start: new Date(Date.UTC(ty, tm - 4, dayOfMonth)).toISOString().slice(0, 10), end: today }
    }
    case 'year': return { start: `${ty}-01-01`, end: today }
    case 'custom': {
      if (!isKey(customStart) || !isKey(customEnd)) return null
      return customStart <= customEnd ? { start: customStart, end: customEnd } : { start: customEnd, end: customStart }
    }
    default: return { start: firstOfMonth(ty, tm), end: today }
  }
}

/** How many of each weekday fall in [start, min(end, today)]. Future days earn nothing yet, so they don't count. */
export function countWeekdays(start, end, today = manilaDateKey()) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const last = end < today ? end : today
  for (let k = start; k <= last; k = addDaysToKey(k, 1)) counts[weekdayOfKey(k)] += 1
  return counts
}

export function filterSalesByWeekdays(sales = [], days = ALL_WEEKDAYS) {
  if (days.length >= 7) return sales
  const keep = new Set(days)
  return sales.filter((s) => s?.occurred_at && keep.has(weekdayOfKey(manilaDateKey(s.occurred_at))))
}

/**
 * Revenue per weekday (Mon..Sun order, only `days`). `avg_minor` is revenue per calendar day of that
 * weekday in range, so a month with five Saturdays does not win on count alone.
 */
export function aggregateSalesByWeekday(sales = [], { start, end, days = ALL_WEEKDAYS, today = manilaDateKey() } = {}) {
  const occurrences = start && end ? countWeekdays(start, end, today) : null
  const map = {}
  for (const id of days) map[id] = { day: id, count: 0, total_minor: 0 }
  for (const sale of sales) {
    if (!sale?.occurred_at) continue
    const row = map[weekdayOfKey(manilaDateKey(sale.occurred_at))]
    if (!row) continue
    row.count += 1
    row.total_minor += Number(sale.total_minor || 0)
  }
  return WEEKDAYS.filter((d) => map[d.id]).map((d) => {
    const row = map[d.id]
    const n = occurrences ? occurrences[d.id] : 0
    return { ...row, label: d.long, short: d.short, occurrences: n, avg_minor: n ? Math.round(row.total_minor / n) : null }
  })
}

/** Highest average day; ties go to more revenue. Null when nothing sold. */
export function bestWeekday(rows = []) {
  let best = null
  for (const r of rows) {
    if (!r.total_minor) continue
    if (!best || (r.avg_minor ?? 0) > (best.avg_minor ?? 0) || ((r.avg_minor ?? 0) === (best.avg_minor ?? 0) && r.total_minor > best.total_minor)) best = r
  }
  return best
}

/** Branch x weekday breakdown: one row per branch (by revenue), each with weekday rows and its best day. */
export function weekdayBranchBreakdown(sales = [], opts = {}) {
  const byBranch = {}
  for (const sale of sales) (byBranch[sale.branch || 'unknown'] ||= []).push(sale)
  const branches = opts.branches?.length ? opts.branches : Object.keys(byBranch)
  return branches
    .map((branch) => {
      const days = aggregateSalesByWeekday(byBranch[branch] || [], opts)
      return { branch, days, best: bestWeekday(days), total_minor: days.reduce((s, d) => s + d.total_minor, 0) }
    })
    .sort((a, b) => b.total_minor - a.total_minor)
}

/** Best calendar dates by revenue, with the branch that earned most that day. */
export function topSalesDates(sales = [], limit = 5) {
  const map = {}
  for (const sale of sales) {
    if (!sale?.occurred_at) continue
    const key = manilaDateKey(sale.occurred_at)
    const row = (map[key] ||= { date: key, day: weekdayOfKey(key), count: 0, total_minor: 0, branches: {} })
    const amt = Number(sale.total_minor || 0)
    row.count += 1
    row.total_minor += amt
    row.branches[sale.branch || 'unknown'] = (row.branches[sale.branch || 'unknown'] || 0) + amt
  }
  return Object.values(map)
    .sort((a, b) => b.total_minor - a.total_minor)
    .slice(0, limit)
    .map(({ branches, ...row }) => {
      const [topBranch, topBranchMinor] = Object.entries(branches).sort((a, b) => b[1] - a[1])[0] || []
      return { ...row, topBranch, topBranchMinor: topBranchMinor || 0 }
    })
}

export function aggregateSalesByBranch(sales = []) {
  const map = {}
  for (const sale of sales) {
    const key = sale.branch || 'unknown'
    if (!map[key]) map[key] = { branch: key, count: 0, total_minor: 0 }
    map[key].count += 1
    map[key].total_minor += Number(sale.total_minor || 0)
  }
  return Object.values(map).sort((a, b) => b.total_minor - a.total_minor)
}

export function aggregateLineItemsByService(lines = []) {
  const map = {}
  for (const line of lines) {
    if (line.item_type && line.item_type !== 'service') continue
    const key = line.service_id || line.name || 'service'
    if (!map[key]) map[key] = { key, name: line.name || 'Service', count: 0, total_minor: 0 }
    map[key].count += Number(line.quantity || 1)
    map[key].total_minor += Number(line.line_total_minor || 0)
  }
  return Object.values(map).sort((a, b) => b.total_minor - a.total_minor)
}

/** Paid POS sales that came from a booking (queue / detailing ticket). */
export function bookingSalesTotal(sales = []) {
  let total = 0
  for (const row of sales || []) {
    const status = String(row.status || 'paid')
    if (status !== 'paid' && status !== 'completed') continue
    if (!row.booking_id) continue
    total += Number(row.total_minor || 0)
  }
  return total
}

const DETAILING_NAME = /ceramic|ppf|tint|coating|paint.?maint/i

/** Wash/packages vs detailing for CRM insights. Products are ignored. */
export function insightLineFamily(line) {
  if (line?.item_type && line.item_type !== 'service') return 'other'
  const pay = String(line?.pay_category || line?.services?.pay_category || '').toLowerCase()
  if (pay === 'detailing' || pay === 'ppf') return 'detailing'
  const slug = String(line?.slug || line?.services?.slug || '').toLowerCase()
  if (slug.includes('ceramic') || slug.includes('ppf') || slug.includes('tint') || slug.includes('paint-maintenance')) {
    return 'detailing'
  }
  if (DETAILING_NAME.test(String(line?.name || ''))) return 'detailing'
  return 'wash'
}

export function aggregateLineItemsByFamily(lines = []) {
  const washLines = []
  const detailingLines = []
  for (const line of lines || []) {
    const family = insightLineFamily(line)
    if (family === 'detailing') detailingLines.push(line)
    else if (family === 'wash') washLines.push(line)
  }
  return {
    wash: aggregateLineItemsByService(washLines),
    detailing: aggregateLineItemsByService(detailingLines),
  }
}

/** Split ids for PostgREST `.in()` (URL/filter cap ~200). */
export function chunkIds(ids, size = 200) {
  const list = (ids || []).filter((id) => id != null && id !== '')
  const out = []
  const n = Math.max(1, Number(size) || 200)
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

/** Walk PostgREST `.range()` pages until a short/empty page. */
export async function collectPaged(fetchPage, pageSize = 1000) {
  const size = Math.max(1, Number(pageSize) || 1000)
  const all = []
  let from = 0
  for (;;) {
    const batch = await fetchPage(from, from + size - 1)
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < size) break
    from += size
  }
  return all
}

/** Chunk ids then page each chunk — `.in()` URL cap + `.range()` row cap. */
export async function collectInChunks(ids, fetchPage, { chunkSize = 200, pageSize = 1000 } = {}) {
  const out = []
  for (const chunk of chunkIds(ids, chunkSize)) {
    const rows = await collectPaged((from, to) => fetchPage(chunk, from, to), pageSize)
    out.push(...rows)
  }
  return out
}

export function applyBranchScope(query, branchFilter) {
  if (branchFilter == null || branchFilter === 'all') return query
  if (Array.isArray(branchFilter)) {
    if (!branchFilter.length) return query.eq('branch', '__none__')
    if (branchFilter.length === 1) return query.eq('branch', branchFilter[0])
    return query.in('branch', branchFilter)
  }
  return query.eq('branch', branchFilter)
}

/** Best-seller rollup for Reports (pesos). Independent of UI. */
export function aggregateBestSellers(lines = [], limit = 8) {
  const byName = {}
  for (const line of lines || []) {
    const key = `${line.item_type || 'item'}:${line.name || 'Unknown'}`
    byName[key] = (byName[key] || 0) + Number(line.line_total_minor || 0)
  }
  return Object.entries(byName)
    .map(([key, totalMinor]) => ({ name: key.split(':').slice(1).join(':'), total: totalMinor / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/**
 * get_crew_kpi accepts one branch slug (or null = all).
 * Prefer explicit single-branch filter; never pass an array.
 */
export function resolveKpiRpcBranch(branchScope, legacyScope = null) {
  if (branchScope == null || branchScope === 'all') return null
  if (typeof branchScope === 'string') return branchScope
  if (Array.isArray(branchScope)) {
    if (branchScope.length === 1) return branchScope[0]
    return null
  }
  return legacyScope || null
}
