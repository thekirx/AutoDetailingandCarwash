/** Bi-monthly office pay. Day crew stay on the Daily Sheet. No tax. */

export const DAY_CREW_ROLES = Object.freeze(['staff', 'team_lead', 'detailer'])

export function isDayCrewRole(role) {
  return DAY_CREW_ROLES.includes(String(role || ''))
}

export function payslipTakeHome(salaryMinor, incentiveMinor = 0) {
  const salary = Math.max(0, Math.round(Number(salaryMinor) || 0))
  const incentive = Math.max(0, Math.round(Number(incentiveMinor) || 0))
  return salary + incentive
}

function pad(n) {
  return String(n).padStart(2, '0')
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** One half of a calendar month. Days 1–15, or 16 through the last day. */
export function payHalf(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number)
  if (!y || !m || !d) return null
  const last = new Date(y, m, 0).getDate()
  const month = MONTHS[m - 1]
  if (d <= 15) {
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-15`, label: `${month} 1–15` }
  }
  return { start: `${y}-${pad(m)}-16`, end: `${y}-${pad(m)}-${pad(last)}`, label: `${month} 16–${last}` }
}

/** The half that contains isoDate, then the half just before it. */
export function payHalfChoices(isoDate) {
  const current = payHalf(isoDate)
  if (!current) return []
  const prevDay = new Date(`${current.start}T12:00:00`)
  prevDay.setDate(prevDay.getDate() - 1)
  const prev = payHalf(prevDay.toISOString().slice(0, 10))
  return [current, prev].filter(Boolean)
}

export function payslipStatusLabel(status) {
  if (status === 'signed') return 'Signed'
  if (status === 'received') return 'Received'
  return 'Sent'
}
