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
