/** Customers cannot pick today or tomorrow. The branch checks the bay first. */

export const BOOKING_LEAD_DAYS = 2

export function manilaTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)
}

export function addDaysISO(iso, days) {
  const [year, month, day] = String(iso).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)))
  return next.toISOString().slice(0, 10)
}

export function earliestBookableDay(now = new Date(), leadDays = BOOKING_LEAD_DAYS) {
  return addDaysISO(manilaTodayISO(now), leadDays)
}

export function manilaDayOf(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date)
}

export function isCustomerBookable(value, now = new Date(), leadDays = BOOKING_LEAD_DAYS) {
  const day = manilaDayOf(value)
  return Boolean(day) && day >= earliestBookableDay(now, leadDays)
}

/** Local dates for the customer day strip, starting on the first open day. */
export function bookableDayDates(count = 14, now = new Date()) {
  const start = earliestBookableDay(now)
  return Array.from({ length: count }, (_, index) => {
    const iso = addDaysISO(start, index)
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, month - 1, day)
  })
}
