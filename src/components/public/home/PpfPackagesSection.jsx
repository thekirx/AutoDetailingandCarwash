import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PPF_PACKAGES } from '../../../data/ppfPackages'
import { buildPpfPackageCards } from '../../../lib/homepageContent'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)

export default function PpfPackagesSection() {
  return (
    <section id="ppf-packages" className="ppf-packages-section" data-motion-section="ppf-packages">
      <div className="public-shell ppf-packages-heading">
        <div>
          <p className="eyebrow eyebrow-light">Protection, clearly packaged</p>
          <h2 className="section-title light">Paint Protection<br />Film Packages</h2>
        </div>
        <p>{"Choose focused or full-body coverage using the same proven package information available in Hakum's booking experience."}</p>
      </div>

      <div className="public-shell ppf-package-card-grid">
        {packageCards.map((card) => (
          <article className={`ppf-static-card is-${card.id}`} key={card.id} data-motion-item>
            <div className="ppf-static-visual" aria-hidden="true">
              <span>{card.number}</span>
              <div className="ppf-static-car-outline"><i /><i /><i /></div>
              <strong>{card.coverageType}</strong>
            </div>
            <div className="ppf-static-card-body">
              <div className="ppf-static-card-title">
                <div>
                  <p>{card.subtitle}</p>
                  <h3>{card.title}</h3>
                </div>
                {card.recommendedLabel ? <span>{card.recommendedLabel}</span> : null}
              </div>
              <p className="ppf-static-description">{card.description}</p>
              <p className="ppf-static-thickness">{card.thickness}</p>
              <div className="ppf-static-detail">
                <h4>Coverage</h4>
                <div className="ppf-static-tags">{card.coverageAreas.map((area) => <span key={area}>{area}</span>)}</div>
              </div>
              <div className="ppf-static-lists">
                <div><h4>Preparation &amp; installation</h4><ul>{card.enhancements.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h4>Benefits</h4><ul>{card.benefits.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h4>Coverage support</h4><ul>{[...card.warranty, ...card.replacementClause].map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <details className="ppf-static-addons">
                <summary>Included complimentary treatments</summary>
                <ul>{card.freeAddOns.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
              <Link className="ppf-book-button" to="/book" state={card.bookingState}>{card.ctaLabel} <ArrowRight size={18} /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
