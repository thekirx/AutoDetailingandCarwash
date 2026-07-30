/** Part 8 KPI helpers — booking cycle mins + comparisons */

export function bookingCycleMinutes(booking) {
  const start = booking?.in_progress_at ? new Date(booking.in_progress_at).getTime() : NaN
  const endRaw = booking?.for_payment_at || booking?.completed_at || booking?.final_checking_at
  const end = endRaw ? new Date(endRaw).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / 60_000
}

export function averageCycleMinutes(bookings = []) {
  const mins = bookings.map(bookingCycleMinutes).filter((n) => Number.isFinite(n) && n >= 0)
  if (!mins.length) return null
  return mins.reduce((a, b) => a + b, 0) / mins.length
}

export function compareBranchesByCompleted(rows = []) {
  const map = {}
  for (const row of rows) {
    const status = String(row.status || '')
    // Name says completed — count finished floor outcomes only
    if (!['completed', 'for_payment'].includes(status)) continue
    const key = row.branch || 'unknown'
    if (!map[key]) map[key] = { branch: key, count: 0, avg_min: 0, _sum: 0, _n: 0 }
    map[key].count += 1
    const m = bookingCycleMinutes(row)
    if (m != null) {
      map[key]._sum += m
      map[key]._n += 1
    }
  }
  return Object.values(map)
    .map((r) => ({
      branch: r.branch,
      count: r.count,
      avg_min: r._n ? Math.round(r._sum / r._n) : null,
    }))
    .sort((a, b) => b.count - a.count)
}

export function aggregateByService(bookings = [], serviceNameById = {}) {
  const map = {}
  for (const b of bookings) {
    const key = b.service_id || 'none'
    if (!map[key]) map[key] = { service_id: key, name: serviceNameById[key] || 'Service', count: 0, _sum: 0, _n: 0 }
    map[key].count += 1
    const m = bookingCycleMinutes(b)
    if (m != null) {
      map[key]._sum += m
      map[key]._n += 1
    }
  }
  return Object.values(map)
    .map((r) => ({
      service_id: r.service_id,
      name: r.name,
      count: r.count,
      avg_min: r._n ? Math.round(r._sum / r._n) : null,
    }))
    .sort((a, b) => b.count - a.count)
}
