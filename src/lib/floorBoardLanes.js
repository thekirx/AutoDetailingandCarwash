/**
 * Floor Board lane counts + labels split by queue family.
 * Wash = Services & Packages (same-day). Detailing = multi-day pipeline.
 */

import { failedQaCount } from './kpiPart8.js'
import {
  QUEUE_FAMILY_DETAILING,
  QUEUE_FAMILY_WASH,
  filterTicketsByFamily,
  parseQueueFamilyParam,
} from './queueFamilies.js'
import { detailingBoardStatusLabel } from './detailingBoardStatuses.js'

export const WASH_FLOOR_LIVE_STATUSES = Object.freeze([
  'waiting',
  'in_progress',
  'final_checking',
  'redo',
  'for_payment',
])

export const DETAILING_FLOOR_LIVE_STATUSES = Object.freeze([
  'confirmed',
  'waiting',
  'in_progress',
  'final_checking',
  'redo',
  'for_releasing',
  'for_payment',
])

export const WASH_FLOOR_LANE_LABELS = Object.freeze({
  waiting: 'Waiting',
  in_progress: 'In Progress',
  final_checking: 'Final Checking',
  for_payment: 'For Payment',
  completed: 'Completed',
  cancelled: 'Cancelled',
  redo: 'Services Failed QA',
})

export const FLOOR_BOARD_FAMILY_META = Object.freeze({
  wash: {
    id: QUEUE_FAMILY_WASH,
    eyebrow: 'Bay status',
    title: 'Services & Packages',
    hint: 'Same-day wash and package jobs. Waiting through For Payment are live. Services Failed QA stays in the count after the job moves to payment or completion.',
    liveStatuses: WASH_FLOOR_LIVE_STATUSES,
  },
  detailing: {
    id: QUEUE_FAMILY_DETAILING,
    eyebrow: 'Detailing pipeline',
    title: 'Detailing Services',
    hint: 'Multi-day ceramic, tint, PPF, and paint maintenance. Assign through For payment are live. Detailing Failed QA stays in the count after the job moves on.',
    liveStatuses: DETAILING_FLOOR_LIVE_STATUSES,
  },
})

function emptyLaneCounts() {
  return {
    confirmed: 0,
    waiting: 0,
    in_progress: 0,
    final_checking: 0,
    for_releasing: 0,
    for_payment: 0,
    redo: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  }
}

export function floorLaneLabel(status, family = QUEUE_FAMILY_WASH) {
  const key = String(status || '')
  const want = parseQueueFamilyParam(family)
  if (want === QUEUE_FAMILY_DETAILING) {
    if (key === 'redo') return 'Detailing Failed QA'
    return detailingBoardStatusLabel(key) || WASH_FLOOR_LANE_LABELS[key] || key
  }
  return WASH_FLOOR_LANE_LABELS[key] || key
}

function tallyLanes(tickets = [], counts) {
  for (const row of tickets || []) {
    const status = String(row?.status || '')
    if (counts[status] == null) counts[status] = 0
    counts[status] += 1
    if (
      status === 'confirmed' ||
      status === 'waiting' ||
      status === 'in_progress' ||
      status === 'final_checking' ||
      status === 'for_releasing' ||
      status === 'for_payment' ||
      status === 'redo'
    ) {
      counts.total += 1
    }
  }
  return counts
}

/** Split live floor + timeline jobs into Services & Packages vs Detailing Services. */
export function splitFloorBoardLanes({ activeQueue = [], periodJobs = [] } = {}) {
  const wash = emptyLaneCounts()
  const detailing = emptyLaneCounts()

  tallyLanes(filterTicketsByFamily(activeQueue, QUEUE_FAMILY_WASH), wash)
  tallyLanes(filterTicketsByFamily(activeQueue, QUEUE_FAMILY_DETAILING), detailing)

  for (const row of filterTicketsByFamily(periodJobs, QUEUE_FAMILY_WASH)) {
    if (row.status === 'completed') wash.completed += 1
    if (row.status === 'cancelled') wash.cancelled += 1
  }
  for (const row of filterTicketsByFamily(periodJobs, QUEUE_FAMILY_DETAILING)) {
    if (row.status === 'completed') detailing.completed += 1
    if (row.status === 'cancelled') detailing.cancelled += 1
  }

  return { wash, detailing }
}

/**
 * Lane "Failed QA" keeps jobs that already left redo for payment or completion.
 * Live redo tickets and timeline redo_at rows are one visit each.
 */
export function mergeTimelineFailedQa(lanes, { activeQueue = [], failedQaJobs = [] } = {}) {
  const next = {
    wash: { ...lanes.wash },
    detailing: { ...lanes.detailing },
  }
  for (const family of [QUEUE_FAMILY_WASH, QUEUE_FAMILY_DETAILING]) {
    const live = filterTicketsByFamily(activeQueue, family).filter(
      (row) => row?.status === 'redo' || row?.redo_at,
    )
    const timeline = filterTicketsByFamily(failedQaJobs, family)
    next[family].redo = failedQaCount([...live, ...timeline])
  }
  return next
}

export function sumFloorLaneCounts(byFamily = {}) {
  const out = emptyLaneCounts()
  for (const lanes of Object.values(byFamily || {})) {
    for (const [key, value] of Object.entries(lanes || {})) {
      out[key] = (out[key] || 0) + Number(value || 0)
    }
  }
  return out
}
