import { ArrowRight, MapPin, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buildHomeBranchCards, countActiveHomeBranches } from '../../../lib/homeBranches'

export default function HomeEndingSections({ branches }) {
  const branchCards = buildHomeBranchCards(branches)
  const activeBranchCount = countActiveHomeBranches(branchCards)

  return (
    <>
      <section id="queue" className="queue-teaser" data-motion-section="queue">
        <div className="public-shell queue-grid">
          <div data-motion="heading"><p className="eyebrow eyebrow-light"><Radio size={13} /> Live branch status</p><h2 className="section-title light">Know the queue.<br />Own your time.</h2></div>
          <div data-motion="copy"><p>See the customer-safe live service queue before you leave home. No internal records, no clutter — just the status you need.</p><Link className="button button-white" to="/queue">View live queue <ArrowRight size={18} /></Link></div>
        </div>
      </section>
      <section id="branches" className="home-branches" data-motion-section="branches">
        <div className="public-shell">
          <div className="section-heading-row" data-motion="heading">
            <div><p className="eyebrow eyebrow-light">Branches / Contact</p><h2 className="section-title light">Closer than<br />you think.</h2></div>
            <p>Premium car care across {activeBranchCount} active branches, with Dasmariñas coming soon. Choose your nearest open branch and let us take it from here.</p>
          </div>
          <div className="home-branch-grid" data-motion="cards">
            {branchCards.map((branch, index) => branch.isComingSoon ? (
              <article className="home-branch-card is-coming-soon" key={branch.slug} data-motion-item>
                <span>{String(index + 1).padStart(2, '0')}</span><MapPin /><div><h3>{branch.name}</h3><p>{branch.address}</p></div><strong>{branch.status}</strong>
              </article>
            ) : (
              <Link className="home-branch-card" to={branch.href} key={branch.slug} data-motion-item>
                <span>{String(index + 1).padStart(2, '0')}</span><MapPin /><div><h3>{branch.name}</h3><p>{branch.address}</p></div><ArrowRight />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
