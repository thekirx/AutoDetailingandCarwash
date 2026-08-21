import { useState } from 'react'
import { ArrowRight, ChevronDown, MapPin, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buildHomeBranchCards, countActiveHomeBranches } from '../../../lib/homeBranches'

export default function HomeEndingSections({ branches }) {
  const branchCards = buildHomeBranchCards(branches)
  const activeBranchCount = countActiveHomeBranches(branchCards)
  /* Collapsed by default: the closing section asks one question — how do I get
     to you — and a full grid of every branch answers it before it is asked. */
  const [showBranches, setShowBranches] = useState(false)

  return (
    <section id="branches" className="home-branches" data-motion-section="branches">
      <div className="public-shell">
        <div className="section-heading-row" data-motion="heading">
          <div><p className="eyebrow eyebrow-light">Branches / Contact</p><h2 className="section-title light">Closer than<br />you think.</h2></div>
          <p>Premium car care across {activeBranchCount} active branches, with Dasmariñas coming soon. Choose your nearest open branch and let us take it from here.</p>
        </div>

        <div className="home-branch-actions" data-motion="copy">
          <button
            type="button"
            className="home-branch-toggle"
            aria-expanded={showBranches}
            aria-controls="home-branch-list"
            onClick={() => setShowBranches((open) => !open)}
          >
            <MapPin size={16} aria-hidden="true" />
            See all branches
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          <Link className="home-branch-action-link" to="/branches">
            Go to branch page <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="home-branch-queue" to="/queue">
            <Radio size={15} aria-hidden="true" />
            Know the queue
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="home-branch-grid" id="home-branch-list" data-motion="cards" hidden={!showBranches}>
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
  )
}
