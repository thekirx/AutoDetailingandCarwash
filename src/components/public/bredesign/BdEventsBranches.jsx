import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { branchCityName } from '../../../lib/branches'
import { usePublicQueueCounts } from '../../../lib/usePublicQueueCounts'
import { IMAGES } from './content'

/* A homepage section reading "nothing here yet" is worse than no section: it
   tells a first-time visitor the business is quiet. With no published event the
   block is dropped and /events keeps the nav entry — the same rule the shipping
   site already follows. */
export function BdEvents({ state }) {
  const item = state?.item
  if (!item) return null

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
            <img src={item.mediaUrl || IMAGES.about} alt="" loading="lazy" />
          </div>
          <div className="bd-event-body">
            {item.dateLabel ? <p className="bd-event-date">{item.dateLabel}</p> : null}
            <h3>{item.title}</h3>
            {item.summary ? <p className="bd-event-summary">{item.summary}</p> : null}
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
  if (branch.coming_soon) return { label: 'Coming soon', tone: 'soon' }
  if (branch.is_active === false) return { label: 'Closed', tone: 'shut' }
  return { label: 'Open', tone: 'open' }
}

export function BdBranches({ branches = [] }) {
  /* Polls the aggregate count view — never booking rows. The same hook the live
     queue page uses, so the number here and the number there cannot disagree. */
  const { rows, error: queueError, loading: queueLoading } = usePublicQueueCounts()
  const queueBySlug = Object.create(null)
  rows.forEach((row) => {
    queueBySlug[row.branch] = Number(row.waiting_count || 0)
  })

  if (!branches.length) return null

  return (
    <section className="bd-branches" id="branches">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Live branch status</p>
            {/* The heading does not name a count: the branch list is live, and it
                currently returns four entries including the HQ/office. A
                hard-coded "three" would go wrong the moment a branch opens. */}
            <h2 className="bd-skew">
              Know the queue
              <br />
              before you go.
            </h2>
          </div>
          <p>
            What is waiting at each branch right now, updated live. Walk in for a wash or a detail;
            film and coating are worth booking ahead.
          </p>
        </div>
        <div className="bd-branch-grid bd-reveal">
          {branches.map((branch) => {
            const status = branchStatus(branch)
            /* The view groups by branch over active bookings, so a branch with
               an empty queue has no row at all. Absent means zero; only a
               failed or unfinished fetch is unknown. */
            const known = !queueLoading && !queueError
            const waiting = known ? queueBySlug[branch.slug] ?? 0 : undefined
            return (
              <Link
                className="bd-branch"
                to={branch.coming_soon ? '/branches' : `/queue/${branch.slug}`}
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
                {branch.coming_soon ? null : (
                  <p className="bd-branch-queue">
                    <span className="bd-queue-num">{waiting === undefined ? '—' : waiting}</span>
                    <span className="bd-queue-label">
                      {waiting === 1 ? 'vehicle waiting now' : 'vehicles waiting now'}
                    </span>
                  </p>
                )}

                <span className="bd-branch-go">
                  {branch.coming_soon ? 'Join the waitlist' : 'See the live queue'}{' '}
                  <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
