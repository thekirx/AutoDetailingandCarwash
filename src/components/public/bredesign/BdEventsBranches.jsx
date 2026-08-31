import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { branchCityName } from '../../../lib/branches'
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
  if (!branches.length) return null

  return (
    <section className="bd-branches" id="branches">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Where we are</p>
            {/* The heading does not name a count: the branch list is live, and it
                currently returns four entries including the HQ/office. A
                hard-coded "three" would go wrong the moment a branch opens. */}
            <h2 className="bd-skew">
              Where to
              <br />
              find us.
            </h2>
          </div>
          <p>
            Bring the car in and we will inspect the paint before quoting anything. Film work runs out
            of the flagship bay; wash, detailing and coating run at all of them.
          </p>
        </div>
        <div className="bd-branch-grid bd-reveal">
          {branches.map((branch) => {
            const status = branchStatus(branch)
            return (
              <Link className="bd-branch" to="/branches" key={branch.slug}>
                <div className="bd-branch-top">
                  <h3>{branchCityName(branch)}</h3>
                  {/* Status is carried in the word as well as the colour. */}
                  <span className={`bd-status bd-status-${status.tone}`}>
                    <i aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                {branch.address ? <p className="bd-branch-address">{branch.address}</p> : null}
                <span className="bd-branch-go">
                  {branch.coming_soon ? 'Join the waitlist' : 'Book this branch'}{' '}
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
