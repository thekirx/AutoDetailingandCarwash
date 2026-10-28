/** Bi-weekly office pay. Day crew stay on the Daily Sheet. No tax. */

/** Monday that starts the bi-weekly calendar. Periods are 14 days, inclusive. */
const BIWEEK_ANCHOR_UTC = Date.UTC(2026, 0, 5)
const DAY_MS = 86_400_000

export const DAY_CREW_ROLES = Object.freeze(['staff', 'team_lead', 'detailer'])

export function isDayCrewRole(role) {
  return DAY_CREW_ROLES.includes(String(role || ''))
}

export function payslipTakeHome(salaryMinor, incentiveMinor = 0) {
  const salary = Math.max(0, Math.round(Number(salaryMinor) || 0))
  const incentive = Math.max(0, Math.round(Number(incentiveMinor) || 0))
  return salary + incentive
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function isoUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function rangeLabel(startIso, endIso) {
  const [, sm, sd] = startIso.split('-').map(Number)
  const [, em, ed] = endIso.split('-').map(Number)
  const startMonth = MONTHS[sm - 1]
  const endMonth = MONTHS[em - 1]
  if (sm === em) return `${startMonth} ${sd}–${ed}`
  return `${startMonth} ${sd} – ${endMonth} ${ed}`
}

/** The 14-day pay period that contains isoDate. */
export function payBiweek(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number)
  if (!y || !m || !d) return null
  const at = Date.UTC(y, m - 1, d)
  if (!Number.isFinite(at)) return null
  const index = Math.floor((at - BIWEEK_ANCHOR_UTC) / DAY_MS / 14)
  const startMs = BIWEEK_ANCHOR_UTC + index * 14 * DAY_MS
  const endMs = startMs + 13 * DAY_MS
  const start = isoUtc(startMs)
  const end = isoUtc(endMs)
  return { start, end, label: rangeLabel(start, end) }
}

/** @deprecated name kept for callers. The period is bi-weekly, not a calendar half. */
export function payHalf(isoDate) {
  return payBiweek(isoDate)
}

/** Newest period first. `count` is how many period tabs the payroll page shows. */
export function payPeriodList(isoDate, count = 4) {
  const first = payHalf(isoDate)
  if (!first) return []
  const out = [first]
  let cursor = first.start
  while (out.length < count) {
    const prevDay = new Date(`${cursor}T12:00:00`)
    prevDay.setDate(prevDay.getDate() - 1)
    const prev = payHalf(prevDay.toISOString().slice(0, 10))
    if (!prev || prev.start === cursor) break
    out.push(prev)
    cursor = prev.start
  }
  return out
}

/** The period that contains isoDate, then the one before it. */
export function payHalfChoices(isoDate) {
  return payPeriodList(isoDate, 2)
}

/** Office and admin only. Day crew stay on the Daily Sheet. */
export function officePayrollPeople(people = []) {
  return (people || []).filter((person) => person && !isDayCrewRole(person.role) && person.is_active !== false)
}

export function payslipStatusLabel(status) {
  if (status === 'signed') return 'Signed'
  if (status === 'received') return 'Received'
  return 'Sent'
}
