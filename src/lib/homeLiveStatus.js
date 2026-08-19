/**
 * Customer-facing read of the public queue counts.
 *
 * The counts view is already safe to expose (no plates, no names, no phone
 * numbers) — this only turns the raw numbers into the one sentence a customer
 * actually wants before they leave the house: how long is the line?
 */

import { branchHoursStatus } from './branchHours'

/* Bands are deliberately coarse. Exact positions belong on /queue, not here.
   Every label describes the QUEUE, never the branch — whether the shop is
   actually open is a separate question answered by branchHoursStatus, because
   an empty queue at midnight is "no cars in the system", not "come on over". */
const BANDS = [
  { max: 0, tone: 'open', label: 'No queue' },
  { max: 3, tone: 'light', label: 'Short queue' },
  { max: Infinity, tone: 'busy', label: 'Busy right now' },
]

export function statusForCounts(counts) {
  const active = Number(counts?.total || 0)
  const band = BANDS.find((entry) => active <= entry.max)
  return { active, tone: band.tone, label: band.label }
}

const IDLE_COUNTS = { waiting: 0, in_progress: 0, final_checking: 0, total: 0 }

/**
 * @param {Array} branches - rows from usePublicBranches (bookable only)
 * @param {Record<string, object>} countsBySlug - from usePublicQueueCounts
 * @param {{ loaded?: boolean, now?: Date }} opts - loaded=false means the first
 *   poll is still in flight, which is not the same claim as "this branch is
 *   empty".
 */
export function buildLiveBranchStatus(branches, countsBySlug, { loaded = true, now } = {}) {
  return (branches || []).map((branch) => {
    /* The counts view only carries branches with active work, so once the poll
       has landed a missing row means an empty floor, not missing data. */
    const counts = countsBySlug?.[branch.slug] || (loaded ? IDLE_COUNTS : null)
    const hours = branchHoursStatus(branch, now)
    const queue = counts
      ? statusForCounts(counts)
      : { active: 0, tone: 'unknown', label: 'Checking status' }

    /* Closed beats every queue reading. A visitor who drives over because the
       homepage said "No queue" at 3 AM has been actively misled, which is a
       worse outcome than showing them nothing at all. Hours are optional, so
       an unset branch falls through to the queue label as before. */
    const closed = hours.state === 'closed'

    return {
      slug: branch.slug,
      name: branch.name.replace('Hakum Auto Care ', ''),
      address: branch.address || '',
      counts,
      known: !!counts,
      hours,
      closed,
      active: queue.active,
      tone: closed ? 'closed' : queue.tone,
      label: closed ? hours.label : queue.label,
      /* Only meaningful while trading: nobody needs a queue length for a shop
         that will not open again for another nine hours. */
      showQueue: !closed && !!counts,
    }
  })
}

/**
 * The single branch to feature when the visitor's location is unknown: the one
 * they could walk into soonest. An open branch always outranks a closed one.
 */
export function pickHeadlineBranch(statuses) {
  if (!statuses.length) return null
  const known = statuses.filter((entry) => entry.known)
  if (!known.length) return statuses[0]
  return known.reduce((best, entry) => {
    if (best.closed !== entry.closed) return best.closed ? entry : best
    return entry.active < best.active ? entry : best
  })
}
