import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PPF_FILM_BRAND, PPF_PACKAGES } from '../../../data/ppfPackages'
import { ppfInstallProof } from '../../../data/publicHomeContent'
import { buildPpfPackageCards } from '../../../lib/homepageContent'
import './PpfPackagesAccordion.css'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)

/* Maps a coverageArea label from ppfPackages.js onto the panels it lights in
   the diagram. Add a key here when a new coverage area is added there — an
   unmapped area still shows in the chips, it just won't light the car. */
const PANEL_MAP = {
  'Hood': ['hood'],
  'Headlights': ['lights-f'],
  'Taillights': ['lights-r'],
  'All four doors': ['door-f', 'door-r'],
  'Front bumper': ['bumper-f'],
  'Rear bumper': ['bumper-r'],
  'Side mirrors': ['mirror'],
  'Fenders': ['fender-f'],
  'Roof': ['roof'],
  'Trunk': ['trunk'],
  'Quarter panels': ['quarter'],
  'Rocker panels': ['rocker'],
  'Trims': ['pillar'],
  'Full exterior': [
    'hood', 'bumper-f', 'bumper-r', 'fender-f', 'roof', 'trunk', 'quarter',
    'door-f', 'door-r', 'mirror', 'lights-f', 'lights-r', 'pillar',
  ],
  'Additional high-impact areas where applicable': ['edges', 'cups'],
}

/* Panel geometry, drawn once. Repeated keys are left/right of the same area. */
const CAR_PANELS = [
  ['bumper-f', 'M92 44 Q180 26 268 44 L276 78 L84 78 Z'],
  ['lights-f', 'M84 82 L134 82 L134 104 L86 104 Z'],
  ['lights-f', 'M226 82 L276 82 L274 104 L226 104 Z'],
  ['hood', 'M84 108 L276 108 L272 226 L88 226 Z'],
  ['fender-f', 'M66 110 L82 108 L86 226 L68 224 Z'],
  ['fender-f', 'M294 110 L278 108 L274 226 L292 224 Z'],
  ['mirror', 'M40 236 L64 234 L64 258 L40 256 Z'],
  ['mirror', 'M320 236 L296 234 L296 258 L320 256 Z'],
  ['pillar', 'M88 228 L106 228 L98 292 L82 292 Z'],
  ['pillar', 'M272 228 L254 228 L262 292 L278 292 Z'],
  ['roof', 'M104 296 L256 296 L256 464 L104 464 Z'],
  ['door-f', 'M68 262 L100 296 L100 372 L68 372 Z'],
  ['door-f', 'M292 262 L260 296 L260 372 L292 372 Z'],
  ['door-r', 'M68 376 L100 376 L100 452 L68 452 Z'],
  ['door-r', 'M292 376 L260 376 L260 452 L292 452 Z'],
  ['cups', 'M76 356 L96 356 L96 368 L76 368 Z'],
  ['cups', 'M284 356 L264 356 L264 368 L284 368 Z'],
  ['quarter', 'M68 456 L100 456 L96 560 L70 556 Z'],
  ['quarter', 'M292 456 L260 456 L264 560 L290 556 Z'],
  ['rocker', 'M62 300 L68 300 L68 556 L62 552 Z'],
  ['rocker', 'M298 300 L292 300 L292 556 L298 552 Z'],
  ['trunk', 'M98 532 L262 532 L266 604 L94 604 Z'],
  ['lights-r', 'M96 596 L146 596 L146 612 L96 612 Z'],
  ['lights-r', 'M214 596 L264 596 L264 612 L214 612 Z'],
  ['bumper-r', 'M92 616 L268 616 Q272 642 260 652 L100 652 Q88 642 92 616 Z'],
  ['edges', 'M100 372 L106 372 L106 452 L100 452 Z'],
  ['edges', 'M260 372 L254 372 L254 452 L260 452 Z'],
]

function panelsFor(areas = []) {
  const lit = new Set()
  areas.forEach((area) => (PANEL_MAP[area] || []).forEach((panel) => lit.add(panel)))
  return lit
}

/* Top-down coverage map. "13 areas" is a number a buyer can't picture; the
   panels that light up are the same claim in a form they can check. */
function CoverageCar({ lit }) {
  return (
    <svg className="ppfa-car" viewBox="0 0 360 680" aria-hidden="true" focusable="false">
      <rect className="ppfa-tyre" x="46" y="196" width="20" height="62" rx="5" />
      <rect className="ppfa-tyre" x="294" y="196" width="20" height="62" rx="5" />
      <rect className="ppfa-tyre" x="46" y="452" width="20" height="62" rx="5" />
      <rect className="ppfa-tyre" x="294" y="452" width="20" height="62" rx="5" />
      <path className="ppfa-glass" d="M96 232 L264 232 L252 292 L108 292 Z" />
      <path className="ppfa-glass" d="M108 470 L252 470 L262 528 L98 528 Z" />
      {CAR_PANELS.map(([key, d], i) => (
        <path key={`${key}-${i}`} className={`ppfa-panel${lit.has(key) ? ' is-on' : ''}`} d={d} />
      ))}
    </svg>
  )
}

export default function PpfPackagesSection() {
  /* One tier open at a time, Premium at rest — it is the tier most buyers land
     on, and opening on Basic anchors the section at its floor. */
  const [active, setActive] = useState(1)

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
                  {/* Media slot. ppfInstallProof is deliberately empty until real
                      Hakum install footage exists; until then the gradient stands
                      in rather than a stock clip a buyer would discount on sight. */}
                  <span className="ppfa-media" aria-hidden="true" />
                  <span className="ppfa-scrim" aria-hidden="true" />

                  <span className="ppfa-spine" aria-hidden="true">
                    <b>{shortName}</b>
                    <s>{card.coverageCount} areas</s>
                  </span>

                  <span className="ppfa-cover" aria-hidden="true">
                    <CoverageCar lit={panelsFor(card.coverageAreas)} />
                    <span className="ppfa-cover-cap">
                      <b>{card.coverageCount}</b> areas covered
                    </span>
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

          {/* One panel is open at a time, so the tiers still need to be readable
              against each other — this is the comparison the accordion can't do. */}
          <div className="ppfa-compare">
            <div className="ppfa-rowlabel" />
            {packageCards.map((card, i) => (
              <div key={card.id} className={`ppfa-cell ppfa-headcell${i === active ? ' is-hot' : ''}`}>
                {card.title.replace(' Protection', '')}
              </div>
            ))}

            {packageCards[0].figures.map((figure, figureIndex) => (
              <div className="ppfa-compare-row" key={figure.label}>
                <div className="ppfa-rowlabel">{figure.label}</div>
                {packageCards.map((card, i) => {
                  const cell = card.figures[figureIndex]
                  return (
                    <div key={card.id} className={`ppfa-cell${i === active ? ' is-hot' : ''}`}>
                      {cell.value}{cell.unit ? ` ${cell.unit}` : ''}
                      {cell.note ? <em>{cell.note}</em> : null}
                    </div>
                  )
                })}
              </div>
            ))}
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
