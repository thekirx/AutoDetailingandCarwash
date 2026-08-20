/**
 * Branch opening hours, evaluated against the visitor's local clock.
 *
 * Source of truth is the branch_operating_hours table: one row per weekday per
 * branch, carrying its own opens_at/closes_at or an is_closed flag. Callers
 * attach those rows to a branch as `hours`.
 *
 * The public site is single-country (Asia/Manila) and the stored times are
 * local wall-clock, so comparing against the browser's own clock is correct
 * for a customer standing in Cavite and close enough for anyone else.
 *
 * Everything degrades to 'unknown' when a branch has no rows — callers must
 * treat that as "say nothing about availability", never as "closed".
 */

/* branch_operating_hours.day_of_week is 0=Sunday…6=Saturday, matching
   Date.getDay(), so no conversion is needed when reading the clock. */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** JS getDay() is 0=Sunday; ISO is 1=Monday…7=Sunday. Kept for admin-side UI. */
export function isoWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/** ISO 1..7 (Mon..Sun) -> table 0..6 (Sun..Sat). */
export function isoToDayOfWeek(iso) {
  return Number(iso) === 7 ? 0 : Number(iso)
}

/** Table 0..6 (Sun..Sat) -> ISO 1..7 (Mon..Sun). */
export function dayOfWeekToIso(day) {
  return Number(day) === 0 ? 7 : Number(day)
}

/** "08:30:00" -> 510. Returns null for anything unparseable. */
export function minutesFromTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''))
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  return hours * 60 + mins
}

export function formatTime(value) {
  const total = minutesFromTime(value)
  if (total == null) return ''
  const date = new Date()
  date.setHours(Math.floor(total / 60), total % 60, 0, 0)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Row for one weekday, or null when the branch has no usable entry for it. */
function dayRow(branch, dayOfWeek) {
  const rows = branch?.hours
  if (!Array.isArray(rows)) return null
  const row = rows.find((r) => Number(r?.day_of_week) === dayOfWeek)
  if (!row) return null
  if (row.is_closed) return { closed: true }
  const opens = minutesFromTime(row.opens_at)
  const closes = minutesFromTime(row.closes_at)
  if (opens == null || closes == null) return null
  return { closed: false, opens, closes, opensAt: row.opens_at, closesAt: row.closes_at }
}

/** The next weekday the branch trades, searching forward from `fromDay`. */
function nextOpenDay(branch, fromDay) {
  for (let step = 0; step < 7; step += 1) {
    const day = (fromDay + step) % 7
    const row = dayRow(branch, day)
    if (row && !row.closed) return { day, daysAhead: step, row }
  }
  return null
}

/**
 * @returns {{ state: 'open'|'closed'|'unknown', label: string, closesAt?: string, opensAt?: string }}
 */
export function branchHoursStatus(branch, now = new Date()) {
  if (!Array.isArray(branch?.hours) || !branch.hours.length) {
    return { state: 'unknown', label: '' }
  }

  const today = now.getDay()
  const yesterday = (today + 6) % 7
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  const todayRow = dayRow(branch, today)
  const yesterdayRow = dayRow(branch, yesterday)

  /* Nothing usable for today and nothing to roll over from yesterday means we
     cannot make a claim either way. */
  if (!todayRow && !yesterdayRow) return { state: 'unknown', label: '' }

  /* closes <= opens means the shift runs past midnight, so yesterday's window
     can still be open in the small hours of today. */
  const openFromYesterday =
    yesterdayRow &&
    !yesterdayRow.closed &&
    yesterdayRow.closes <= yesterdayRow.opens &&
    minutesNow < yesterdayRow.closes

  if (openFromYesterday) {
    return {
      state: 'open',
      label: `Open until ${formatTime(yesterdayRow.closesAt)}`,
      closesAt: yesterdayRow.closesAt,
    }
  }

  if (todayRow && !todayRow.closed) {
    const overnight = todayRow.closes <= todayRow.opens
    const openNow = overnight ? minutesNow >= todayRow.opens : minutesNow >= todayRow.opens && minutesNow < todayRow.closes

    if (openNow) {
      return {
        state: 'open',
        label: `Open until ${formatTime(todayRow.closesAt)}`,
        closesAt: todayRow.closesAt,
      }
    }

    /* Still today: closed only because it is too early. */
    if (minutesNow < todayRow.opens) {
      return { state: 'closed', label: `Opens ${formatTime(todayRow.opensAt)}`, opensAt: todayRow.opensAt }
    }
  }

  /* Otherwise the next opening is on a later day. */
  const next = nextOpenDay(branch, (today + 1) % 7)
  if (!next) return { state: 'closed', label: 'Closed' }

  const when = next.daysAhead === 0 ? 'tomorrow' : DAY_NAMES[next.day]
  return {
    state: 'closed',
    label: `Opens ${when} ${formatTime(next.row.opensAt)}`,
    opensAt: next.row.opensAt,
  }
}
