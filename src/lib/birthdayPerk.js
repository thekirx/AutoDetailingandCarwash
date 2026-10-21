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

const BIRTHDAY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** BD plus four letters. One code per perk year. */
export function mintBirthdayCode(random = Math.random) {
  let code = 'BD'
  for (let i = 0; i < 4; i += 1) code += BIRTHDAY_CODE_ALPHABET[Math.floor(random() * BIRTHDAY_CODE_ALPHABET.length)]
  return code
}

export function normalizeBirthdayCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export const BIRTHDAY_CODE_REQUIRED = 'Type the birthday code before the service is free.'
export const BIRTHDAY_CODE_MISMATCH = 'That birthday code does not match this customer.'

export function birthdayCodeShapeError(value) {
  const code = normalizeBirthdayCode(value)
  if (/^BD[A-Z2-9]{4}$/.test(code)) return null
  return BIRTHDAY_CODE_REQUIRED
}

export function birthdayPerkExpiresAt(grantedAt = new Date()) {
  const d = new Date(grantedAt)
  d.setUTCDate(d.getUTCDate() + 7)
  return d
}

/** First saved birthdate stays. A later change or a clear is refused. */
export function birthdayLockError(current, next) {
  const saved = current ? String(current).slice(0, 10) : ''
  if (!saved) return null
  const incoming = next ? String(next).slice(0, 10) : ''
  if (saved === incoming) return null
  return 'Birthday is locked after the first save.'
}

export function isBirthdayPerkActive(perk, now = new Date()) {
  if (!perk || perk.status !== 'available') return false
  if (!perk.expires_at) return true
  return new Date(perk.expires_at).getTime() > now.getTime()
}

/**
 * The birthday gift, worded once. Every customer surface imports these, so a
 * client change ("free service", another gift) is a one-line edit here plus the
 * SA-editable birthday.greeting template.
 */
export const BIRTHDAY_GIFT_LABEL = 'free carwash'
export const BIRTHDAY_GIFT_TITLE = 'Free carwash'
export const BIRTHDAY_PERK_DAYS = 30

const DAY_MS = 86_400_000
/** Countdown turns amber once this few days remain. */
export const BIRTHDAY_URGENT_DAYS = 7

/**
 * What Home shows for the birthday perk.
 * 'day' — today is the birthday and the perk is live (hero card + greeting sheet).
 * 'countdown' — perk live on a later day (slim row with days left).
 * 'none' — no live perk (claimed, expired, never granted).
 */
export function birthdayCardState(dateOfBirth, perk, now = new Date()) {
  if (!isBirthdayPerkActive(perk, now)) return { mode: 'none', daysLeft: 0, urgent: false }
  const expires = perk.expires_at ? new Date(perk.expires_at).getTime() : null
  const daysLeft = expires == null ? BIRTHDAY_PERK_DAYS : Math.max(1, Math.ceil((expires - now.getTime()) / DAY_MS))
  if (isBirthdayToday(dateOfBirth, now)) return { mode: 'day', daysLeft, urgent: false }
  return { mode: 'countdown', daysLeft, urgent: daysLeft <= BIRTHDAY_URGENT_DAYS }
}

/** localStorage key: the greeting sheet opens once per customer per perk year. */
export function birthdayGreetedKey(customerId, perkYear) {
  return `hakum-bday-greeted-${customerId || 'me'}-${perkYear || ''}`
}

/** "Nov 16" in Manila time, or '' when unknown. */
export function formatPerkDate(iso, timeZone = MANILA) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone })
}
