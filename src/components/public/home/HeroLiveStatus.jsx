import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buildLiveBranchStatus, pickHeadlineBranch } from '../../../lib/homeLiveStatus'
import { liveQueuePath } from '../../../lib/liveQueuePath'
import { usePublicQueueCounts } from '../../../lib/usePublicQueueCounts'

/**
 * Hero ribbon: the real floor state, above the fold.
 *
 * Every other detailing site opens with a claim. This opens with a fact that
 * changes every eight seconds — which is the one thing a competitor cannot copy
 * by hiring a better photographer.
 */
export default function HeroLiveStatus({ branches }) {
  const { countsBySlug, loading, error } = usePublicQueueCounts()

  /* Nothing to say yet, and a skeleton in the hero is worse than silence. */
  if (error || (!branches.length && loading)) return null

  const statuses = buildLiveBranchStatus(branches, countsBySlug, { loaded: !loading })
  const headline = pickHeadlineBranch(statuses)
  if (!headline) return null

  return (
    <Link className="hero-live" to={liveQueuePath(headline.slug)} data-tone={headline.tone}>
      <span className="hero-live-dot" aria-hidden="true" />
      <span className="hero-live-branch">{headline.name}</span>
      <span className="hero-live-sep" aria-hidden="true" />
      <span className="hero-live-label">{headline.label}</span>
      {headline.known && headline.active > 0 ? (
        <span className="hero-live-count">{headline.active} in queue</span>
      ) : null}
      <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
  )
}
