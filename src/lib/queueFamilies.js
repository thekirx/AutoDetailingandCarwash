/**
 * Client command categories: Car Wash Queue vs Detailing Queue.
 * Wash = same-day service/package kinds. Detailing = multi-day detailing pay_category.
 */

import { serviceKindFromPayCategory } from './serviceKinds.js'

export const QUEUE_FAMILY_WASH = 'wash'
export const QUEUE_FAMILY_DETAILING = 'detailing'

export const QUEUE_FAMILIES = [
  {
    id: QUEUE_FAMILY_WASH,
    label: 'Car Wash Queue',
    shortLabel: 'Wash',
    path: '/operations/queue',
    kinds: ['service', 'package'],
  },
  {
    id: QUEUE_FAMILY_DETAILING,
    label: 'Detailing Queue',
    shortLabel: 'Detail',
    path: '/operations/queue?family=detailing',
    kinds: ['detailing'],
  },
]

export function parseQueueFamilyParam(raw) {
  const key = String(raw || '').trim().toLowerCase()
  if (key === QUEUE_FAMILY_DETAILING || key === 'detail' || key === 'detailing') {
    return QUEUE_FAMILY_DETAILING
  }
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

/** Detailing queue also shows "Assigned to Branch" (confirmed) from Bookings. */
export function boardStatusesForFamily(baseStatuses = [], family = QUEUE_FAMILY_WASH) {
  const want = parseQueueFamilyParam(family)
  if (want === QUEUE_FAMILY_DETAILING) {
    const out = ['confirmed', ...baseStatuses]
    return [...new Set(out)]
  }
  return baseStatuses.filter((s) => s !== 'confirmed')
}

export function queueFamilyHref(family, { lane, branch } = {}) {
  const params = new URLSearchParams()
  if (parseQueueFamilyParam(family) === QUEUE_FAMILY_DETAILING) params.set('family', 'detailing')
  if (lane) params.set('lane', lane)
  if (branch && branch !== 'all') params.set('branch', branch)
  const q = params.toString()
  return q ? `/operations/queue?${q}` : '/operations/queue'
}
