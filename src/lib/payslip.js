/** Semi-monthly office pay: fixed 1st–15th and 16th–end of month. Day crew stay on the Daily Sheet. No tax. */

export const DAY_CREW_ROLES = Object.freeze(['staff', 'team_lead', 'detailer'])

export function isDayCrewRole(role) {
  return DAY_CREW_ROLES.includes(String(role || ''))
}

export function payslipTakeHome(salaryMinor, incentiveMinor = 0) {
  const salary = Math.max(0, Math.round(Number(salaryMinor) || 0))
  const incentive = Math.max(0, Math.round(Number(incentiveMinor) || 0))
  return salary + incentive
}

export const MONTHS = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
])

export function lastDayOfMonth(year, month) {
  // month is 1-12. Day 0 of next month is the last day of month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function getPeriodsForYearMonth(year, month = null) {
  const y = Number(year) || new Date().getFullYear()
  const m = month != null && month !== '' && month !== 'all' ? Number(month) : null
  const periods = []
  const months = m ? [m] : [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  for (const mon of months) {
    const mm = String(mon).padStart(2, '0')
    const lastDay = lastDayOfMonth(y, mon)
    // 2nd half
    const start2 = `${y}-${mm}-16`
    const end2 = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
    periods.push({
      start: start2,
      end: end2,
      year: y,
      month: mon,
      half: 2,
      label: rangeLabel(start2, end2),
    })
    // 1st half
    const start1 = `${y}-${mm}-01`
    const end1 = `${y}-${mm}-15`
    periods.push({
      start: start1,
      end: end1,
      year: y,
      month: mon,
      half: 1,
      label: rangeLabel(start1, end1),
    })
  }
  return periods
}

export function rangeLabel(startIso, endIso) {
  const [, sm, sd] = startIso.split('-').map(Number)
  const [, em, ed] = endIso.split('-').map(Number)
  const startMonth = MONTHS[sm - 1]
  const endMonth = MONTHS[em - 1]
  if (sm === em) return `${startMonth} ${sd}–${ed}`
  return `${startMonth} ${sd} – ${endMonth} ${ed}`
}

/**
 * Fixed semi-monthly pay period containing isoDate:
 * - Days 1–15: from YYYY-MM-01 to YYYY-MM-15
 * - Days 16–end: from YYYY-MM-16 to last day of month (30th/31st, or 28th/29th in Feb)
 */
export function payHalf(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number)
  if (!y || !m || !d) return null
  const mm = String(m).padStart(2, '0')
  if (d <= 15) {
    const start = `${y}-${mm}-01`
    const end = `${y}-${mm}-15`
    return { start, end, label: rangeLabel(start, end) }
  }
  const lastDay = lastDayOfMonth(y, m)
  const start = `${y}-${mm}-16`
  const end = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
  return { start, end, label: rangeLabel(start, end) }
}

/** Alias for backward compatibility. */
export function payBiweek(isoDate) {
  return payHalf(isoDate)
}

/** Newest period first. `count` is how many period tabs the payroll page shows. */
export function payPeriodList(isoDate, count = 4) {
  const first = payHalf(isoDate)
  if (!first) return []
  const out = [first]
  let currentStart = first.start
  while (out.length < count) {
    const [y, m, d] = currentStart.split('-').map(Number)
    let prevYear = y
    let prevMonth = m
    let prevDay
    if (d > 1) {
      prevDay = 1
    } else {
      prevMonth = m - 1
      if (prevMonth < 1) {
        prevMonth = 12
        prevYear = y - 1
      }
      prevDay = 16
    }
    const prevIso = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`
    const prev = payHalf(prevIso)
    if (!prev) break
    out.push(prev)
    currentStart = prev.start
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

/** Empty draft keeps the saved method. A new slip with no choice is cash. */
export function payrollPaidFrom(draftPaidFrom, savedPaidFrom) {
  const chosen = draftPaidFrom || savedPaidFrom || 'cash'
  return chosen === 'gcash' ? 'gcash' : 'cash'
}

export function payslipStatusLabel(status) {
  if (status === 'signed') return 'Signed'
  if (status === 'received') return 'Received'
  return 'Sent'
}
