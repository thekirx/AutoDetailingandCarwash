import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PPF_PACKAGES } from '../../../data/ppfPackages'
import { buildPpfPackageCards } from '../../../lib/homepageContent'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)

export default function PpfPackagesSection() {
  return (
    <section id="ppf-packages" className="ppf-packages-section" data-motion-section="ppf-packages">
      <div className="public-shell ppf-package-ladder-layout">
        <header className="ppf-package-ladder-intro" data-motion="heading">
          <div>
            <p className="eyebrow eyebrow-light">Paint protection film</p>
            <h2>More coverage.<br />More defense.</h2>
          </div>
          <p>Three clear protection levels, ordered by coverage and film strength—not a wall of specifications.</p>
        </header>

        <ol className="ppf-protection-ladder" aria-label="Paint Protection Film packages">
          {packageCards.map((card) => (
            <li className={`ppf-ladder-row is-${card.id}`} key={card.id} data-motion-item>
              <span className="ppf-ladder-number" aria-hidden="true">{card.number}</span>
              <div className="ppf-ladder-copy">
                <div className="ppf-ladder-labels">
                  <span>{card.coverageType}</span>
                  {card.recommendedLabel ? <strong>{card.recommendedLabel}</strong> : null}
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <div className="ppf-ladder-meta">
                <strong>{card.thickness}</strong>
                <span>{card.warrantySummary}</span>
              </div>
              <Link className="ppf-ladder-book" to="/book" state={card.bookingState} aria-label={card.ctaLabel}>
                Book package <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
