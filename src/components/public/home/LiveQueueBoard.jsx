import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buildLiveBranchStatus } from '../../../lib/homeLiveStatus'
import { liveQueuePath } from '../../../lib/liveQueuePath'
import { usePublicQueueCounts } from '../../../lib/usePublicQueueCounts'

const LANES = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'in_progress', label: 'In service' },
  { key: 'final_checking', label: 'Final check' },
]

function formatUpdated(date) {
  if (!date) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * The public counts, per branch, on the homepage — the same numbers /queue
 * shows, without making the visitor navigate to find out whether it is worth
 * driving over. Polling and safety are inherited from usePublicQueueCounts.
 */
export default function LiveQueueBoard({ branches }) {
  const { countsBySlug, loading, error, updatedAt } = usePublicQueueCounts()
  const statuses = buildLiveBranchStatus(branches, countsBySlug, { loaded: !loading })

  if (error || (!statuses.length && !loading)) return null

  return (
    <div className="live-board">
      <div className="live-board-head">
        <span className="live-board-pulse" aria-hidden="true" />
        <span>Updating every 8 seconds</span>
        {updatedAt ? <time dateTime={updatedAt.toISOString()}>{formatUpdated(updatedAt)}</time> : null}
      </div>
      <ul className="live-board-grid">
        {statuses.map((branch) => (
          <li key={branch.slug}>
            <Link className="live-board-card" to={liveQueuePath(branch.slug)} data-tone={branch.tone}>
              <div className="live-board-card-head">
                <h3>{branch.name}</h3>
                <span className="live-board-state">{branch.label}</span>
              </div>
              {!branch.closed && branch.hours.state === 'open' ? (
                <span className="live-board-hours">{branch.hours.label}</span>
              ) : null}
              {branch.closed ? (
                /* Counts for a closed branch are noise: they describe a floor
                   nobody can join until it opens again. */
                <p className="live-board-closed">
                  Closed right now
                  {branch.address ? <span>{branch.address}</span> : null}
                </p>
              ) : (
                <dl className="live-board-lanes" aria-hidden={!branch.known}>
                  {LANES.map((lane) => (
                    <div key={lane.key}>
                      <dt>{lane.label}</dt>
                      <dd>{branch.known ? branch.counts[lane.key] : '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <span className="live-board-cta">
                Open live queue <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
