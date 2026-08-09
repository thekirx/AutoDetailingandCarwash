/** Detailing / coating board status labels (client pipeline). Maps to booking_status enum. */

export const DETAILING_BOARD_STATUSES = [
  { id: 'pending', label: 'Booking Placeholder', hint: 'Hold / draft booking' },
  { id: 'confirmed', label: 'Assigned to Branch', hint: 'Confirmed for a branch' },
  { id: 'waiting', label: 'Intake Started', hint: 'Car received on floor' },
  { id: 'in_progress', label: 'Vehicle Inspection', hint: 'Work / inspection in progress' },
  { id: 'final_checking', label: 'Ready for Release', hint: 'QC passed · ready to release' },
  { id: 'completed', label: 'Successful Release', hint: 'Released to customer' },
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
