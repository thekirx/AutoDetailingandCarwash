import { ArrowRight, MapPin, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'

import { branchLabel } from '../../../lib/branches'

export default function HomeEndingSections({ branches }) {
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
            <p>Premium car care across {branchLabel(branches.length || 2)}. Choose your nearest branch and let us take it from here.</p>
          </div>
          <div className="home-branch-grid" data-motion="cards">
            {branches.map((branch, index) => (
              <Link to={`/queue/${branch.slug}`} key={branch.slug} data-motion-item>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <MapPin />
                <div><h3>{branch.name.replace('Hakum Auto Care ', '')}</h3><p>{branch.address || branch.slug}</p></div>
                <ArrowRight />
              </Link>
            ))}
            {!branches.length && (
              <>
                <Link to="/branches" data-motion-item><span>01</span><MapPin /><div><h3>Bacoor</h3><p>RFC Mall, Cavite</p></div><ArrowRight /></Link>
                <Link to="/branches" data-motion-item><span>02</span><MapPin /><div><h3>Batangas</h3><p>Batangas City</p></div><ArrowRight /></Link>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
