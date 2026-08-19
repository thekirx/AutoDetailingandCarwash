/**
 * Branch opening hours, evaluated against the visitor's local clock.
 *
 * The public site is single-country (Asia/Manila) and the stored times are
 * local wall-clock, so comparing against the browser's own clock is correct
 * for a customer standing in Cavite and close enough for anyone else.
 *
 * Everything degrades to 'unknown' when a branch has no hours set — callers
 * must treat that as "say nothing about availability", never as "closed".
 */

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** JS getDay() is 0=Sunday; the column uses ISO 1=Monday…7=Sunday. */
export function isoWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
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

function closedSet(branch) {
  return new Set((branch?.closed_weekdays || []).map(Number))
}

/** The next weekday the branch trades, searching forward from `fromIso`. */
function nextOpenWeekday(branch, fromIso) {
  const closed = closedSet(branch)
  for (let step = 0; step < 7; step += 1) {
    const iso = ((fromIso - 1 + step) % 7) + 1
    if (!closed.has(iso)) return { iso, daysAhead: step }
  }
  return null
}

/**
 * @returns {{ state: 'open'|'closed'|'unknown', label: string, closesAt?: string, opensAt?: string }}
 */
export function branchHoursStatus(branch, now = new Date()) {
  const opens = minutesFromTime(branch?.opens_at)
  const closes = minutesFromTime(branch?.closes_at)
  if (opens == null || closes == null) return { state: 'unknown', label: '' }

  const closed = closedSet(branch)
  const todayIso = isoWeekday(now)
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  /* closes <= opens means the shift runs past midnight, so the open window is
     two ranges: [opens, 24:00) today and [00:00, closes) on the next day. */
  const overnight = closes <= opens
  const tradesToday = !closed.has(todayIso)
  const yesterdayIso = todayIso === 1 ? 7 : todayIso - 1
  const tradedYesterday = !closed.has(yesterdayIso)

  const openNow = overnight
    ? (tradesToday && minutesNow >= opens) || (tradedYesterday && minutesNow < closes)
    : tradesToday && minutesNow >= opens && minutesNow < closes

  if (openNow) {
    return {
      state: 'open',
      label: `Open until ${formatTime(branch.closes_at)}`,
      closesAt: branch.closes_at,
    }
  }

  /* Still today: closed only because it is too early. */
  if (tradesToday && minutesNow < opens) {
    return { state: 'closed', label: `Opens ${formatTime(branch.opens_at)}`, opensAt: branch.opens_at }
  }

  /* Otherwise the next opening is on a later day. */
  const next = nextOpenWeekday(branch, todayIso === 7 ? 1 : todayIso + 1)
  if (!next) return { state: 'closed', label: 'Closed', opensAt: branch.opens_at }

  const when = next.daysAhead === 0 ? 'tomorrow' : DAY_NAMES[next.iso - 1]
  return {
    state: 'closed',
    label: `Opens ${when} ${formatTime(branch.opens_at)}`,
    opensAt: branch.opens_at,
  }
}
