/** CRM insights helpers — top customers + CSV export. */

export function topCustomersBySpend(sales = [], limit = 20) {
  const map = new Map()
  for (const row of sales || []) {
    if (String(row.status || 'paid') !== 'paid') continue
    const id = row.customer_id || row.customers?.id || row.customer_phone || row.customers?.phone || row.customer_name
    if (!id) continue
    const key = String(id)
    const prev = map.get(key) || {
      customer_id: key,
      name: row.customer_name || row.customers?.full_name || 'Customer',
      phone: row.customer_phone || row.customers?.phone || '',
      sales_count: 0,
      total_minor: 0,
    }
    prev.sales_count += 1
    prev.total_minor += Number(row.total_minor || 0)
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.total_minor - a.total_minor).slice(0, limit)
}

export function insightsToCsv(rows = [], columns = []) {
  const cols =
    columns.length > 0
      ? columns
      : Object.keys(rows[0] || {}).map((key) => ({ key, label: key }))
  const escape = (value) => {
    const s = String(value ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = cols.map((c) => escape(c.label)).join(',')
  const body = (rows || [])
    .map((row) => cols.map((c) => escape(typeof c.get === 'function' ? c.get(row) : row[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function downloadCsv(filename, csvText) {
  if (typeof document === 'undefined') return
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
