/**
 * Floor Queue UI is same-day Services & Packages only.
 * Multi-day detailing lives on Bookings (`/operations/bookings`).
 * Floor Board may still split wash vs detailing for network overview.
 */

import { serviceKindFromPayCategory } from './serviceKinds.js'

export const QUEUE_FAMILY_WASH = 'wash'
export const QUEUE_FAMILY_DETAILING = 'detailing'

/** Queue UI exposes a single family — no Wash/Detail toggle. */
export const QUEUE_FAMILIES = [
  {
    id: QUEUE_FAMILY_WASH,
    label: 'Car Wash Queue',
    shortLabel: 'Wash',
    path: '/operations/queue',
    kinds: ['service', 'package'],
  },
]

/** Parse family for classifiers / Floor Board. Queue UI ignores this via queueFamilyForProfile. */
export function parseQueueFamilyParam(raw) {
  const key = String(raw || '').trim().toLowerCase()
  if (key === QUEUE_FAMILY_DETAILING || key === 'detail' || key === 'detailing') {
    return QUEUE_FAMILY_DETAILING
  }
  return QUEUE_FAMILY_WASH
}

/** Always false — Queue has no family switcher. */
export function canSwitchQueueFamily() {
  return false
}

/** Queue page always washes; Bookings owns detailing. */
export function queueFamilyForProfile() {
  return QUEUE_FAMILY_WASH
}

export function ticketQueueFamily(ticket) {
  const kind = serviceKindFromPayCategory(ticket?.service_pay_category || ticket?.pay_category)
  return kind === 'detailing' ? QUEUE_FAMILY_DETAILING : QUEUE_FAMILY_WASH
}

export function filterTicketsByFamily(tickets = [], family = QUEUE_FAMILY_WASH) {
  const want = parseQueueFamilyParam(family)
  return (tickets || []).filter((t) => ticketQueueFamily(t) === want)
}

/** Detailing split (Floor Board) includes Assigned to Branch. Queue wash strips confirmed. */
export function boardStatusesForFamily(baseStatuses = [], family = QUEUE_FAMILY_WASH) {
  const want = parseQueueFamilyParam(family)
  if (want === QUEUE_FAMILY_DETAILING) {
    return [...new Set(['confirmed', ...(baseStatuses || [])])]
  }
  return (baseStatuses || []).filter((s) => s !== 'confirmed')
}

/** Queue href never carries family=detailing. */
export function queueFamilyHref(_family, { lane, branch } = {}) {
  const params = new URLSearchParams()
  if (lane) params.set('lane', lane)
  if (branch && branch !== 'all') params.set('branch', branch)
  const q = params.toString()
  return q ? `/operations/queue?${q}` : '/operations/queue'
}
