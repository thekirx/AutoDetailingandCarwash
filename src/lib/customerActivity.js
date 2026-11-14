/** Home "Recent activity" date window: the last month by default, or the dates the customer picked. */

export const DAY_MS = 24 * 60 * 60 * 1000

export function isoDay(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function activityInRange(rows, dateOf, range, now = Date.now()) {
  const from = range?.from ? new Date(`${range.from}T00:00:00`).getTime() : now - 30 * DAY_MS
  const to = range?.to ? new Date(`${range.to}T23:59:59`).getTime() : now
  return (rows || []).filter((row) => {
    const t = new Date(dateOf(row)).getTime()
    return Number.isFinite(t) && t >= from && t <= to
  })
}
