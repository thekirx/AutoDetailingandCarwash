import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PPF_FILM_BRAND, PPF_PACKAGES } from '../../../data/ppfPackages'
import { ppfInstallProof } from '../../../data/publicHomeContent'
import { buildPpfPackageCards } from '../../../lib/homepageContent'
import './PpfPackagesAccordion.css'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)

export default function PpfPackagesSection() {
  /* One tier open at a time, Premium at rest — it is the tier most buyers land
     on, and opening on Basic anchors the section at its floor. */
  const [active, setActive] = useState(1)

  return (
    <section id="ppf-packages" className="ppf-packages-section" data-motion-section="ppf-packages" data-service-packages="ppf">
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
          {/* Panels open on hover, one at a time. The specifics a six-figure buyer
              wants are in the open panel rather than behind a disclosure. */}
          <div className="ppfa-lane" aria-label="Paint Protection Film packages">
            {packageCards.map((card, i) => {
              const isOpen = i === active
              const prevAreas = i > 0 ? packageCards[i - 1].coverageAreas : []
              const added = card.coverageAreas.filter((area) => !prevAreas.includes(area))
              const shortName = card.title.replace(' Protection', '')
              const prevShortName = i > 0 ? packageCards[i - 1].title.replace(' Protection', '') : ''

              return (
                <button
                  type="button"
                  key={card.id}
                  className={`ppfa-panelcard is-${card.id}${isOpen ? ' is-open' : ''}`}
                  aria-expanded={isOpen}
                  aria-label={`${card.title} — ${card.coverageCount} areas covered`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  data-motion-item
                  data-recommended={card.isHighlighted ? 'true' : 'false'}
                >
                  {/* Media slot, held open and empty. There is no Hakum PPF
                      photography yet, and a gradient or a stock frame was doing
                      nothing the type could not do better. When real install
                      stills exist they drop in here. */}
                  <span className="ppfa-media" aria-hidden="true" />

                  {/* The count is the comparison, so it is set as the panel's
                      largest element. From Premium up it carries the delta,
                      because the step is what a buyer is weighing. */}
                  <span className="ppfa-figure" aria-hidden="true">
                    <b>{card.coverageCount}</b>
                    <s>areas covered</s>
                    {i > 0 && added.length ? (
                      <em>+{added.length} over {prevShortName}</em>
                    ) : null}
                  </span>

                  <span className="ppfa-spine" aria-hidden="true">
                    <b>{shortName}</b>
                    <s>{card.coverageCount} areas</s>
                  </span>

                  <span className="ppfa-body">
                    <span className="ppfa-labels">
                      <span>{card.coverageType}</span>
                      {card.recommendedLabel ? (
                        <strong className={card.isHighlighted ? 'is-featured' : ''}>
                          {card.recommendedLabel}
                        </strong>
                      ) : null}
                    </span>

                    <h3>{card.title}</h3>
                    <p className="ppfa-headline">{card.headline}</p>

                    {/* Coverage as a delta, not a re-list. From Premium up, the
                        question a buyer is actually asking is what the step adds. */}
                    <span className="ppfa-chips">
                      {i === 0 ? (
                        card.coverageAreas.map((area) => <i key={area}>{area}</i>)
                      ) : (
                        <>
                          <i>Everything in {prevShortName}</i>
                          {added.slice(0, 4).map((area) => (
                            <i className="is-new" key={area}>+ {area}</i>
                          ))}
                          {added.length > 4 ? (
                            <i className="is-new">+ {added.length - 4} more</i>
                          ) : null}
                        </>
                      )}
                    </span>

                    <span className="ppfa-included">{card.enhancements.join(' · ')}</span>

                    {/* The figures that used to sit in a table under the lane.
                        Areas covered is omitted here: it is the large number in
                        this same panel, and printing it twice reads as an error. */}
                    <span className="ppfa-specs">
                      {card.figures.slice(1).map((figure) => (
                        <span key={figure.label}>
                          <s>{figure.label}</s>
                          <b>
                            {figure.value}
                            {figure.unit ? ` ${figure.unit}` : ''}
                          </b>
                          {figure.note ? <em>{figure.note}</em> : null}
                        </span>
                      ))}
                    </span>

                    <Link
                      className="ppfa-go"
                      to="/book"
                      state={card.bookingState}
                      aria-label={card.ctaLabel}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Book now <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </span>
                </button>
              )
            })}
          </div>


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

          {/* One honest footnote instead of the same disclaimer on all three rows. */}
          <p className="ppf-ladder-footnote">
            Warranties cover manufacturer defects. Panel replacement applies to damaged film.
          </p>
        </div>
      </div>
    </section>
  )
}
