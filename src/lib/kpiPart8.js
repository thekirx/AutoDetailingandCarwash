import { shareOfTotal } from './financeData.js'

/** Part 8 KPI helpers — booking cycle mins + comparisons */

export function bookingCycleMinutes(booking) {
  const start = booking?.in_progress_at ? new Date(booking.in_progress_at).getTime() : NaN
  const endRaw = booking?.for_payment_at || booking?.completed_at || booking?.final_checking_at
  const end = endRaw ? new Date(endRaw).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / 60_000
}

/** Waiting bay time: waiting_at → in_progress_at (minutes). */
export function bookingWaitMinutes(booking) {
  const start = booking?.waiting_at ? new Date(booking.waiting_at).getTime() : NaN
  const end = booking?.in_progress_at ? new Date(booking.in_progress_at).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / 60_000
}

export function totalWaitMinutes(bookings = []) {
  return bookings
    .map(bookingWaitMinutes)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .reduce((a, b) => a + b, 0)
}

export function averageWaitMinutes(bookings = []) {
  const mins = bookings.map(bookingWaitMinutes).filter((n) => Number.isFinite(n) && n >= 0)
  if (!mins.length) return null
  return mins.reduce((a, b) => a + b, 0) / mins.length
}

export function averageCycleMinutes(bookings = []) {
  const mins = bookings.map(bookingCycleMinutes).filter((n) => Number.isFinite(n) && n >= 0)
  if (!mins.length) return null
  return mins.reduce((a, b) => a + b, 0) / mins.length
}

/** Failed QA = tickets that entered redo (redo_at set) in the sample. */
export function failedQaCount(bookings = []) {
  return bookings.filter((b) => b?.redo_at || String(b?.status || '') === 'redo').length
}

function hoverBlock(label, lines) {
  return { label, lines }
}

function shareLine(part, total) {
  return `${shareOfTotal(part, total).percent}%`
}

/** Hover copy for KPI tiles. Values are display strings; sales stay minor units. */
export function kpiStatHover(bookings = [], { salesTotal = 0, complaintsCount = 0 } = {}) {
  const n = bookings.length
  const cycleN = bookings.map(bookingCycleMinutes).filter((m) => Number.isFinite(m) && m >= 0).length
  const waitN = bookings.map(bookingWaitMinutes).filter((m) => Number.isFinite(m) && m >= 0).length
  const cancelled = bookings.filter((b) => String(b?.status || '') === 'cancelled').length
  const failed = failedQaCount(bookings)
  return {
    cycle: hoverBlock('Avg cycle (min)', [
      { label: 'What', value: 'in_progress → payment/complete' },
      { label: 'Tickets timed', value: String(cycleN) },
      { label: 'Missing stamps', value: String(Math.max(0, n - cycleN)) },
    ]),
    wait: hoverBlock('Avg wait (min)', [
      { label: 'What', value: 'waiting → in_progress' },
      { label: 'Tickets timed', value: String(waitN) },
      { label: 'Missing stamps', value: String(Math.max(0, n - waitN)) },
    ]),
    bookings: hoverBlock('Bookings in range', [
      { label: 'Tickets', value: String(n) },
      { label: 'Open / other', value: String(Math.max(0, n - cancelled)) },
    ]),
    sales: hoverBlock('Sales revenue', [
      { label: 'Paid sales', value: String(Number(salesTotal) || 0) },
    ]),
    cancelled: hoverBlock('Cancelled', [
      { label: 'Cancelled', value: String(cancelled) },
      { label: 'Share of range', value: shareLine(cancelled, n) },
    ]),
    failedQa: hoverBlock('Failed QA', [
      { label: 'Redo tickets', value: String(failed) },
      { label: 'Share of range', value: shareLine(failed, n) },
    ]),
    complaints: hoverBlock('Complaints', [
      { label: 'Open complaints', value: String(Number(complaintsCount) || 0) },
    ]),
  }
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
