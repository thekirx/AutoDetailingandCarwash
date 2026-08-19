import { ArrowUpRight, LocateFixed } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buildLiveBranchStatus, pickHeadlineBranch } from '../../../lib/homeLiveStatus'
import { liveQueuePath } from '../../../lib/liveQueuePath'
import { useNearestBranch } from '../../../lib/useNearestBranch'
import { usePublicQueueCounts } from '../../../lib/usePublicQueueCounts'

/**
 * Hero ribbon: the real floor state, above the fold.
 *
 * Every other detailing site opens with a claim. This opens with a fact that
 * changes every eight seconds — which is the one thing a competitor cannot
 * copy by hiring a better photographer.
 *
 * It shows the visitor's nearest branch when location is known, and otherwise
 * whichever branch they could walk into soonest.
 */
export default function HeroLiveStatus({ branches }) {
  const { countsBySlug, loading, error } = usePublicQueueCounts()
  const { slug: nearestSlug, canAsk, locating, request } = useNearestBranch(branches)

  /* Nothing to say yet, and a skeleton in the hero is worse than silence. */
  if (error || (!branches.length && loading)) return null

  const statuses = buildLiveBranchStatus(branches, countsBySlug, { loaded: !loading })
  const headline =
    statuses.find((entry) => entry.slug === nearestSlug) || pickHeadlineBranch(statuses)
  if (!headline) return null

  return (
    <span className="hero-live-wrap">
      <Link className="hero-live" to={liveQueuePath(headline.slug)} data-tone={headline.tone}>
        <span className="hero-live-dot" aria-hidden="true" />
        <span className="hero-live-branch">{headline.name}</span>
        {nearestSlug === headline.slug ? <span className="hero-live-near">Nearest</span> : null}
        <span className="hero-live-sep" aria-hidden="true" />
        <span className="hero-live-label">{headline.label}</span>
        {headline.showQueue && headline.active > 0 ? (
          <span className="hero-live-count">{headline.active} in queue</span>
        ) : null}
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
      {canAsk ? (
        <button
          type="button"
          className="hero-live-locate"
          onClick={request}
          disabled={locating}
          title="Show my nearest branch"
        >
          <LocateFixed size={14} aria-hidden="true" />
          <span className="sr-only">Show my nearest branch</span>
        </button>
      ) : null}
    </span>
  )
}
