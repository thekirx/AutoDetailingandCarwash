/** Detailing / coating board status labels (client pipeline). Maps to booking_status enum. */

export const DETAILING_BOARD_STATUSES = [
  { id: 'pending', label: 'Booking Placeholder', hint: 'Hold / draft booking', tone: 'border-l-blue-500' },
  { id: 'confirmed', label: 'Assigned to Branch', hint: 'Sent to the shop', tone: 'border-l-emerald-500' },
  { id: 'waiting', label: 'In Take Started', hint: 'Car received on floor', tone: 'border-l-violet-500' },
  { id: 'in_progress', label: 'Vehicle Inspection', hint: 'Work / inspection in progress', tone: 'border-l-amber-500' },
  { id: 'final_checking', label: 'Ready for Release', hint: 'QC passed · ready to release', tone: 'border-l-cyan-500' },
  { id: 'completed', label: 'Successful Release', hint: 'Released to customer', tone: 'border-l-slate-400' },
]

/** Statuses Sales may set on the Bookings board (API + RLS). */
export const SALES_BOARD_STATUSES = [
  ...DETAILING_BOARD_STATUSES.map((s) => s.id),
  'cancelled',
]

const LABEL_BY_ID = Object.fromEntries(DETAILING_BOARD_STATUSES.map((s) => [s.id, s.label]))

/** Display label for board / queue — detailing pipeline names when applicable. */
export function detailingBoardStatusLabel(status, { detailing = true } = {}) {
  const key = String(status || '')
  if (detailing && LABEL_BY_ID[key]) return LABEL_BY_ID[key]
  return null
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
