/** Manila calendar helpers for birthday perk + greeting. */

const MANILA = 'Asia/Manila'

function ymdParts(date = new Date(), timeZone = MANILA) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const num = (type) => Number(parts.find((p) => p.type === type)?.value)
  return { year: num('year'), month: num('month'), day: num('day') }
}

export function isLeapYear(year) {
  const y = Number(year)
  return Number.isInteger(y) && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)
}

/** YYYY-MM-DD or Date → { year, month, day } or null. */
export function parseDateOnly(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
  }
  const raw = String(value).trim().slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * Month/day pairs that count as "today" for birthday match.
 * Non-leap Feb 28 also matches Feb 29 birthdays.
 */
export function birthdayQueryDays(today = new Date(), timeZone = MANILA) {
  const { year, month, day } = ymdParts(today, timeZone)
  const days = [{ month, day }]
  if (month === 2 && day === 28 && !isLeapYear(year)) days.push({ month: 2, day: 29 })
  return { year, month, day, days }
}

export function isBirthdayToday(dateOfBirth, today = new Date(), timeZone = MANILA) {
  const dob = parseDateOnly(dateOfBirth)
  if (!dob) return false
  return birthdayQueryDays(today, timeZone).days.some((row) => row.month === dob.month && row.day === dob.day)
}

export function birthdayPerkExpiresAt(grantedAt = new Date()) {
  const d = new Date(grantedAt)
  d.setUTCDate(d.getUTCDate() + 30)
  return d
}

export function isBirthdayPerkActive(perk, now = new Date()) {
  if (!perk || perk.status !== 'available') return false
  if (!perk.expires_at) return true
  return new Date(perk.expires_at).getTime() > now.getTime()
}
