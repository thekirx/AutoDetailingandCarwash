/**
 * Customer-facing read of the public queue counts.
 *
 * The counts view is already safe to expose (no plates, no names, no phone
 * numbers) — this only turns the raw numbers into the one sentence a customer
 * actually wants before they leave the house: can I drive over right now?
 */

/** Bands are deliberately coarse. Exact positions belong on /queue, not here. */
const BANDS = [
  { max: 0, tone: 'open', label: 'Bay open now' },
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
 * @param {{ loaded?: boolean }} opts - loaded=false means the first poll is
 *   still in flight, which is not the same claim as "this branch is empty".
 */
export function buildLiveBranchStatus(branches, countsBySlug, { loaded = true } = {}) {
  return (branches || []).map((branch) => {
    /* The counts view only carries branches with active work, so once the poll
       has landed a missing row means an empty floor, not missing data. */
    const counts = countsBySlug?.[branch.slug] || (loaded ? IDLE_COUNTS : null)
    return {
      slug: branch.slug,
      name: branch.name.replace('Hakum Auto Care ', ''),
      address: branch.address || '',
      counts,
      known: !!counts,
      ...(counts ? statusForCounts(counts) : { active: 0, tone: 'unknown', label: 'Checking status' }),
    }
  })
}

/** The single branch to feature in the hero: the one a customer can walk into soonest. */
export function pickHeadlineBranch(statuses) {
  if (!statuses.length) return null
  const known = statuses.filter((entry) => entry.known)
  if (!known.length) return statuses[0]
  return known.reduce((best, entry) => (entry.active < best.active ? entry : best))
}
