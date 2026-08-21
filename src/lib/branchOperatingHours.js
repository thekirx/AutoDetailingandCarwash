/** Weekly branch hours — Asia/Manila open-now helpers for ops + public /branches. */

export const WEEKDAY_LABELS = [
  { day: 0, short: 'Sun', long: 'Sunday' },
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
]

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

export function normalizeTimeInput(raw) {
  const s = String(raw || '').trim()
  const m = TIME_RE.exec(s)
  if (!m) return null
  return `${m[1]}:${m[2]}`
}

export function defaultWeekHours(branchSlug = '') {
  return WEEKDAY_LABELS.map(({ day }) => ({
    branch_slug: branchSlug,
    day_of_week: day,
    opens_at: '08:00',
    closes_at: '18:00',
    is_closed: false,
  }))
}

/** Merge DB rows into a full Sun–Sat week (missing days → defaults). */
export function normalizeWeekHours(rows = [], branchSlug = '') {
  const byDay = new Map()
  for (const row of rows || []) {
    const day = Number(row.day_of_week)
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    const closed = Boolean(row.is_closed)
    byDay.set(day, {
      branch_slug: row.branch_slug || branchSlug,
      day_of_week: day,
      opens_at: closed ? null : normalizeTimeInput(row.opens_at) || '08:00',
      closes_at: closed ? null : normalizeTimeInput(row.closes_at) || '18:00',
      is_closed: closed,
    })
  }
  return WEEKDAY_LABELS.map(({ day }) => {
    if (byDay.has(day)) return byDay.get(day)
    return {
      branch_slug: branchSlug,
      day_of_week: day,
      opens_at: '08:00',
      closes_at: '18:00',
      is_closed: false,
    }
  })
}

export function validateWeekHours(week = []) {
  for (const row of week) {
    if (row.is_closed) continue
    const opens = normalizeTimeInput(row.opens_at)
    const closes = normalizeTimeInput(row.closes_at)
    if (!opens || !closes) return 'Set open and close times, or mark the day closed.'
    if (closes <= opens) return 'Close time must be after open time (same day).'
  }
  return null
}

function formatClock(hhmm) {
  const t = normalizeTimeInput(hhmm)
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Compact public line, e.g. "Daily 8 AM–6 PM" or "Mon–Sat 8 AM–6 PM · Sun closed". */
export function formatHoursSummary(week = []) {
  const rows = normalizeWeekHours(week)
  const open = rows.filter((r) => !r.is_closed)
  if (!open.length) return 'Closed all week'
  const signature = (r) => `${r.opens_at}-${r.closes_at}`
  const firstSig = signature(open[0])
  const allSame = open.every((r) => signature(r) === firstSig)
  const range = `${formatClock(open[0].opens_at)}–${formatClock(open[0].closes_at)}`
  if (allSame && open.length === 7) return `Daily ${range}`
  if (allSame) {
    const days = open.map((r) => WEEKDAY_LABELS[r.day_of_week].short).join(', ')
    const closed = rows.filter((r) => r.is_closed).map((r) => WEEKDAY_LABELS[r.day_of_week].short)
    const closedBit = closed.length ? ` · ${closed.join(', ')} closed` : ''
    return `${days} ${range}${closedBit}`
  }
  return open
    .map((r) => `${WEEKDAY_LABELS[r.day_of_week].short} ${formatClock(r.opens_at)}–${formatClock(r.closes_at)}`)
    .join(' · ')
}

/** Local calendar parts in Asia/Manila (shop timezone). */
export function manilaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    hhmm: `${parts.hour}:${parts.minute}`,
  }
}

export function isOpenNow(week = [], date = new Date()) {
  const rows = normalizeWeekHours(week)
  const { dayOfWeek, hhmm } = manilaParts(date)
  const today = rows.find((r) => r.day_of_week === dayOfWeek)
  if (!today || today.is_closed) return false
  const opens = normalizeTimeInput(today.opens_at)
  const closes = normalizeTimeInput(today.closes_at)
  if (!opens || !closes) return false
  return hhmm >= opens && hhmm < closes
}

export function openNowLabel(week = [], date = new Date()) {
  if (!week?.length) return 'Hours TBD'
  return isOpenNow(week, date) ? 'Open now' : 'Closed now'
}
