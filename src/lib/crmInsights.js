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

export function applyBranchScope(query, branchFilter) {
  if (branchFilter == null || branchFilter === 'all') return query
  if (Array.isArray(branchFilter)) {
    if (!branchFilter.length) return query.eq('branch', '__none__')
    if (branchFilter.length === 1) return query.eq('branch', branchFilter[0])
    return query.in('branch', branchFilter)
  }
  return query.eq('branch', branchFilter)
}
