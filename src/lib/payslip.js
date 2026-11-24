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

/** Inclusive calendar days between two YYYY-MM-DD dates (e.g. 2026-11-01..2026-11-15 = 15, 16..31 = 16). */
export function daysBetweenInclusive(startIso, endIso) {
  const [sy, sm, sd] = String(startIso || '').slice(0, 10).split('-').map(Number)
  const [ey, em, ed] = String(endIso || '').slice(0, 10).split('-').map(Number)
  if (!sy || !sm || !sd || !ey || !em || !ed) return 15
  const startUtc = Date.UTC(sy, sm - 1, sd)
  const endUtc = Date.UTC(ey, em - 1, ed)
  const diff = Math.round((endUtc - startUtc) / 86_400_000) + 1
  return diff > 0 ? diff : 1
}

/** Elapsed calendar days from the day after `lastPeriodEndIso` through `currentEndIso`. */
export function daysSinceLastPayrollEnd(lastPeriodEndIso, currentEndIso) {
  if (!lastPeriodEndIso || !currentEndIso) return null
  const [ly, lm, ld] = String(lastPeriodEndIso).slice(0, 10).split('-').map(Number)
  const [cy, cm, cd] = String(currentEndIso).slice(0, 10).split('-').map(Number)
  if (!ly || !lm || !ld || !cy || !cm || !cd) return null
  const lastUtc = Date.UTC(ly, lm - 1, ld)
  const curUtc = Date.UTC(cy, cm - 1, cd)
  const diff = Math.round((curUtc - lastUtc) / 86_400_000)
  return diff > 0 ? diff : null
}

/**
 * Standard & pro-rated semi-monthly cutoff salary computation.
 * - `prorated_days`: `(monthlySalaryMinor / standardMonthDays) * coveredDays`
 *   e.g. ₱30,000/mo (₱1,000/day): 15 days = ₱15,000; 16 days = ₱16,000; 31 days = ₱31,000.
 * - `fixed_half`: `monthlySalaryMinor / 2` (fixed 50% quincena regardless of 13/15/16-day half).
 */
export function computeProratedCutoffSalary({
  monthlySalaryMinor = 0,
  mode = 'prorated_days',
  coveredDays = 15,
  standardMonthDays = 30,
} = {}) {
  const base = Math.max(0, Math.round(Number(monthlySalaryMinor) || 0))
  const days = Math.max(1, Math.min(62, Math.round(Number(coveredDays) || 15)))
  const divisor = Math.max(1, Math.round(Number(standardMonthDays) || 30))
  const dailyRateMinor = Math.round(base / divisor)
  if (mode === 'fixed_half') {
    return {
      salaryMinor: Math.round(base / 2),
      dailyRateMinor,
      coveredDays: days,
      mode: 'fixed_half',
      formulaLabel: '50% fixed quincena (Monthly ÷ 2)',
    }
  }
  const salaryMinor = Math.round((base * days) / divisor)
  return {
    salaryMinor,
    dailyRateMinor,
    coveredDays: days,
    mode: 'prorated_days',
    formulaLabel: `${days}d × ₱${(dailyRateMinor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day`,
  }
}

/** Summarize cutoff completion, missing staff, and elapsed days since the prior completed payroll. */
export function evaluateCutoffReadiness({
  period,
  slips = [],
  officeStaff = [],
  latestPriorPeriodEnd = null,
} = {}) {
  const periodDays = period ? daysBetweenInclusive(period.start, period.end) : 15
  const elapsedDays =
    latestPriorPeriodEnd && period?.end ? daysSinceLastPayrollEnd(latestPriorPeriodEnd, period.end) : null
  const recommendedDays = elapsedDays && elapsedDays > 0 && elapsedDays <= 45 ? elapsedDays : periodDays
  const slipByStaff = new Map((slips || []).map((s) => [s.staff_id, s]))
  const totalStaff = (officeStaff || []).length
  let sentCount = 0
  let receivedCount = 0
  let signedCount = 0
  const missingStaff = []
  for (const person of officeStaff || []) {
    const s = slipByStaff.get(person.id)
    if (!s) {
      missingStaff.push(person)
      continue
    }
    sentCount += 1
    if (s.status === 'received' || s.status === 'signed') receivedCount += 1
    if (s.status === 'signed') signedCount += 1
  }
  const isComplete = totalStaff > 0 && sentCount >= totalStaff
  const isDelayed = elapsedDays != null && elapsedDays > periodDays
  return {
    periodDays,
    elapsedDays,
    recommendedDays,
    isDelayed,
    delayExtraDays: isDelayed ? elapsedDays - periodDays : 0,
    totalStaff,
    sentCount,
    receivedCount,
    signedCount,
    pendingCount: Math.max(0, totalStaff - sentCount),
    missingStaff,
    isComplete,
    statusLabel: isComplete
      ? 'Cutoff Completed'
      : sentCount > 0
        ? `In Progress (${sentCount}/${totalStaff})`
        : isDelayed
          ? `Delayed Cutoff (${elapsedDays}d elapsed)`
          : 'Ready to Run',
  }
}
