import { useState } from 'react'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PPF_FILM_BRAND, PPF_PACKAGES } from '../../../data/ppfPackages'
import { ppfInstallProof } from '../../../data/publicHomeContent'
import { buildPpfPackageCards } from '../../../lib/homepageContent'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)

export default function PpfPackagesSection() {
  /* The specifics are what a six-figure buyer wants on demand, not in their
     face — one row open at a time, the way the ceramic panels behave. */
  const [openPackage, setOpenPackage] = useState(null)

  return (
    <section id="ppf-packages" className="ppf-packages-section" data-motion-section="ppf-packages">
      <div className="public-shell ppf-package-ladder-layout">
        <header className="ppf-package-ladder-intro" data-motion="heading">
          <div>
            <p className="eyebrow eyebrow-light">Paint protection film</p>
            <h2>More coverage.<br />More defense.</h2>
            {/* The stakes, in the section's own words from the sequence above —
                what the film is for, before what the film is made of. */}
            <p className="ppf-package-stakes">
              Stone chips, scratches, and road debris hit the film. Never the paint.
            </p>
            <a className="ppf-film-brand" href={PPF_FILM_BRAND.url} target="_blank" rel="noreferrer">
              Film by {PPF_FILM_BRAND.name} <span aria-hidden="true">↗</span>
            </a>
          </div>
          {/* Every tier carries these, so repeating them on each row only made the
              three packages look interchangeable. Said once, they read as standard. */}
          <p className="ppf-package-included">
            <strong>Every package includes</strong>
            Self-healing film with a hydrophobic finish, seamless installation, and
            complimentary ceramic coating on paint, glass, and wheels.
          </p>
        </header>

        <div className="ppf-ladder-column">
          <ol className="ppf-protection-ladder" aria-label="Paint Protection Film packages">
            {packageCards.map((card) => {
              const open = openPackage === card.id
              return (
                <li
                  className={`ppf-ladder-row is-${card.id}`}
                  key={card.id}
                  data-motion-item
                  data-recommended={card.isHighlighted ? 'true' : 'false'}
                >
                  <div className="ppf-ladder-copy">
                    <p className="ppf-ladder-labels">
                      <span>{card.coverageType}</span>
                      {card.recommendedLabel ? <strong>{card.recommendedLabel}</strong> : null}
                    </p>
                    <h3>{card.title}</h3>
                    <p className="ppf-ladder-headline">{card.headline}</p>
                  </div>

                  <dl className="ppf-ladder-figures">
                    {card.figures.map((figure) => (
                      <div key={figure.label}>
                        <dt>
                          {figure.label}
                          {figure.note ? <span>{figure.note}</span> : null}
                        </dt>
                        <dd>
                          {figure.value}
                          {figure.unit ? <i>{figure.unit}</i> : null}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="ppf-ladder-actions">
                    <Link className="ppf-ladder-book" to="/book" state={card.bookingState} aria-label={card.ctaLabel}>
                      Book now <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="ppf-ladder-more"
                      aria-expanded={open}
                      aria-controls={card.detailsId}
                      onClick={() => setOpenPackage(open ? null : card.id)}
                    >
                      {open ? <Minus size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                      What&apos;s covered
                    </button>
                  </div>

                  <div className="ppf-ladder-details" id={card.detailsId} hidden={!open}>
                    <div>
                      <strong>Covered areas</strong>
                      <ul>{card.coverageAreas.map((area) => <li key={area}>{area}</li>)}</ul>
                    </div>
                    <div>
                      <strong>Included work</strong>
                      <ul>{card.enhancements.map((step) => <li key={step}>{step}</li>)}</ul>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {/* One honest footnote instead of the same disclaimer on all three rows. */}
          {ppfInstallProof.length ? (
            <figure className="ppf-install-proof" data-motion="cards">
              <figcaption>Our work, up close</figcaption>
              <div>
                {ppfInstallProof.map((shot) => (
                  <span key={shot.image}>
                    <img src={shot.image} alt={shot.alt} loading="lazy" decoding="async" />
                    {shot.caption ? <em>{shot.caption}</em> : null}
                  </span>
                ))}
              </div>
            </figure>
          ) : null}
          <p className="ppf-ladder-footnote">
            Warranties cover manufacturer defects. Panel replacement applies to damaged film.
          </p>
        </div>
      </div>
    </section>
  )
}
