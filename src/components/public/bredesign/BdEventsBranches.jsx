import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { branchCityName } from '../../../lib/branches'
import { buildHomeBranchCards } from '../../../lib/homeBranches'
import { branchQueueTotal } from '../../../lib/liveQueuePath'
import { usePublicQueueCounts } from '../../../lib/usePublicQueueCounts'
import { IMAGES } from './content'

export function BdEvents({ state }) {
  const item = state?.item

  return (
    <section className="bd-events" id="events">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Community</p>
            <h2 className="bd-skew">Events &amp; meets.</h2>
          </div>
          <p>Promotions, branch events, and car meets from Hakum Auto Care.</p>
        </div>
        <article className="bd-event bd-reveal">
          <div className="bd-event-media">
            <img src={IMAGES.event} alt="Red Honda Civic at a Hakum Auto Care community meet" loading="lazy" />
          </div>
          <div className="bd-event-body">
            {item?.dateLabel ? <p className="bd-event-date">{item.dateLabel}</p> : null}
            <h3>{item?.title || 'See what is happening at Hakum.'}</h3>
            <p className="bd-event-summary">
              {item?.summary || 'Car meets, community events, launches, and the next reasons to pull up.'}
            </p>
            <Link className="bd-all-link" to="/events">
              View all events <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}

function branchStatus(branch) {
  if (branch.coming_soon || branch.isComingSoon) return { label: 'Coming soon', tone: 'soon' }
  if (branch.is_active === false) return { label: 'Closed', tone: 'shut' }
  return { label: 'Open', tone: 'open' }
}

export function BdBranches({ branches = [] }) {
  /* Polls the aggregate count view — never booking rows. The same hook the live
     queue page uses, so the number here and the number there cannot disagree. */
  const { rows, error: queueError, loading: queueLoading } = usePublicQueueCounts()
  const queueBySlug = Object.create(null)
  rows.forEach((row) => {
    queueBySlug[row.branch] = branchQueueTotal(row)
  })
  const visibleBranches = branches.length ? branches : buildHomeBranchCards([])

  return (
    <section className="bd-branches" id="branches">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Live branch status</p>
            <h2 className="bd-skew">Know the queue before you go.</h2>
          </div>
          <p>See the live total at every Hakum branch before you make the drive.</p>
        </div>
        {visibleBranches.length ? (
          <div className="bd-branch-grid bd-reveal">
            {visibleBranches.map((branch) => {
            const status = branchStatus(branch)
            const comingSoon = Boolean(branch.coming_soon || branch.isComingSoon)
            /* The view groups by branch over active bookings, so a branch with
               an empty queue has no row at all. Absent means zero; only a
               failed or unfinished fetch is unknown. */
            const known = !queueLoading && !queueError
            const total = known ? queueBySlug[branch.slug] ?? 0 : undefined
            return (
              <Link
                className="bd-branch"
                to={comingSoon ? '/branches' : `/queue/${branch.slug}`}
                key={branch.slug}
              >
                <div className="bd-branch-top">
                  <h3>{branchCityName(branch)}</h3>
                  {/* Status is carried in the word as well as the colour. */}
                  <span className={`bd-status bd-status-${status.tone}`}>
                    <i aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                {branch.address ? <p className="bd-branch-address">{branch.address}</p> : null}

                {/* A branch that has not opened has no queue to report, and an
                    unreached count says so rather than showing a confident 0. */}
                {comingSoon ? null : (
                  <p className="bd-branch-queue">
                    <span className="bd-queue-num">{total === undefined ? '—' : total}</span>
                    <span className="bd-queue-label">
                      {total === 1 ? 'active vehicle now' : 'active vehicles now'}
                    </span>
                  </p>
                )}

                <span className="bd-branch-go">
                  {comingSoon ? 'Join the waitlist' : 'See the live queue'}{' '}
                  <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            )
            })}
          </div>
        ) : (
          <div className="bd-section-fallback bd-reveal">
            <div>
              <strong>Live branch counts</strong>
              <p>Open the queue board to see every active vehicle across Hakum.</p>
            </div>
            <Link className="bd-all-link" to="/queue">
              View live queue <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
