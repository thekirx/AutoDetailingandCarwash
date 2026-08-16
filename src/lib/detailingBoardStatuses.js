/** Detailing / coating board status labels (client pipeline). Maps to booking_status enum. */

export const DETAILING_BOARD_STATUSES = [
  { id: 'pending', label: 'Booking Placeholder', shortLabel: 'Placeholder', hint: 'Hold / draft booking', tone: 'is-placeholder' },
  { id: 'confirmed', label: 'Assign to branch', shortLabel: 'Assign', hint: 'Sent to the shop', tone: 'is-assign' },
  { id: 'waiting', label: 'Vehicle intake', shortLabel: 'Intake', hint: 'Car arrived on floor', tone: 'is-intake' },
  { id: 'in_progress', label: 'In progress', shortLabel: 'In progress', hint: 'Work in progress', tone: 'is-progress' },
  { id: 'final_checking', label: 'Final checking', shortLabel: 'Final check', hint: 'QC in progress', tone: 'is-check' },
  { id: 'for_releasing', label: 'For releasing', shortLabel: 'Releasing', hint: 'Ready to release', tone: 'is-release' },
  { id: 'for_payment', label: 'For payment', shortLabel: 'Payment', hint: 'Collect at POS', tone: 'is-pay' },
  { id: 'completed', label: 'Completed', shortLabel: 'Done', hint: 'Released to customer', tone: 'is-done' },
]

/** Statuses Sales may set on the Bookings board (API + RLS). */
export const SALES_BOARD_STATUSES = [
  ...DETAILING_BOARD_STATUSES.map((s) => s.id),
  'cancelled',
]

const LABEL_BY_ID = Object.fromEntries(DETAILING_BOARD_STATUSES.map((s) => [s.id, s.label]))
const SHORT_BY_ID = Object.fromEntries(DETAILING_BOARD_STATUSES.map((s) => [s.id, s.shortLabel]))

/** Display label for board / queue — detailing pipeline names when applicable. */
export function detailingBoardStatusLabel(status, { detailing = true } = {}) {
  const key = String(status || '')
  if (detailing && LABEL_BY_ID[key]) return LABEL_BY_ID[key]
  return null
}

export function detailingBoardStatusShortLabel(status) {
  const key = String(status || '')
  return SHORT_BY_ID[key] || null
}

export function nextDetailingBoardStatus(status) {
  const order = DETAILING_BOARD_STATUSES.map((s) => s.id)
  const i = order.indexOf(String(status || ''))
  if (i < 0 || i >= order.length - 1) return null
  return order[i + 1]
}

export function isSalesBoardStatus(status) {
  return SALES_BOARD_STATUSES.includes(String(status || ''))
}

/** Done / cancelled — date filters apply; open pipeline stays visible until released. */
export const BOOKING_TERMINAL_STATUSES = Object.freeze(['completed', 'cancelled'])

export function isOpenBookingStatus(status) {
  return !BOOKING_TERMINAL_STATUSES.includes(String(status || ''))
}
