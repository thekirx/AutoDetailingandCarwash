import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PPF_FILM_BRAND, PPF_PACKAGES } from '../../../data/ppfPackages'
import { ppfInstallProof } from '../../../data/publicHomeContent'
import { buildPpfPackageCards } from '../../../lib/homepageContent'
import './PpfPackagesSection.css'

const packageCards = buildPpfPackageCards(PPF_PACKAGES)
const startingFrom = `₱${Math.min(...PPF_PACKAGES.map((item) => item.priceFrom)).toLocaleString('en-US')}`
const shortName = (card) => card.title.replace(' Protection', '')

/* What each step card lists. Read from the package itself, so a change to a
   tier's film, warranty or extras cannot leave the card saying something else. */
function tierPoints(pkg, card) {
  const points = [`${card.figures[1].value} mil ClearPro TPU film`, pkg.warranty[0]]
  if (pkg.replacementClause[0]) points.push(pkg.replacementClause[0])
  const ceramicRest = pkg.keyEnhancements.find((line) => /ceramic coating on the rest/i.test(line))
  if (ceramicRest) points.push(ceramicRest.replace('of the vehicle exterior', 'of the exterior'))
  points.push(pkg.freeAddOns.length > 1 ? 'Free glass & wheels ceramic coating' : 'Free glass ceramic coating')
  return points
}

const covers = (pkg, ...areas) => areas.some((area) => pkg.coverageAreas.includes(area))
const coversAll = (pkg, ...areas) => areas.every((area) => pkg.coverageAreas.includes(area))
const tick = (included) => ({ kind: included ? 'yes' : 'no' })
const text = (value, figure = false) => ({ kind: figure ? 'figure' : 'text', value })

/* Coverage is compared panel by panel, so the step from film on the front of
   the car to film on all of it reads at a glance; the rows below it carry what
   separates the full-body tiers from each other. */
const COMPARE_GROUPS = [
  {
    title: 'Where the film goes',
    rows: [
      ['Hood', (pkg) => tick(covers(pkg, 'Hood'))],
      ['Headlights', (pkg) => tick(covers(pkg, 'Headlights'))],
      ['Front bumper', (pkg) => tick(covers(pkg, 'Front bumper'))],
      ['Side mirrors', (pkg) => tick(covers(pkg, 'Side mirrors'))],
      ['Front fenders', (pkg) => tick(covers(pkg, 'Front fenders', 'Fenders'))],
      ['Taillights', (pkg) => tick(covers(pkg, 'Taillights'))],
      ['All four doors', (pkg) => tick(covers(pkg, 'All four doors'))],
      ['Rear bumper, roof, trunk & quarter panels', (pkg) => tick(coversAll(pkg, 'Rear bumper', 'Roof', 'Trunk', 'Quarter panels'))],
      ['Trims', (pkg) => tick(covers(pkg, 'Trims'))],
      ['Rocker panels & extra high-impact areas', (pkg) => tick(covers(pkg, 'Rocker panels'))],
      [
        'Rest of the exterior',
        (pkg) => text(pkg.keyEnhancements.some((line) => /ceramic coating on the rest/i.test(line)) ? '2-layer ceramic' : 'Covered by film'),
      ],
    ],
  },
  {
    title: 'Film & warranty',
    rows: [
      ['ClearPro film thickness', (pkg, card) => text(`${card.figures[1].value} mil`, true)],
      ['Factory warranty', (pkg, card) => text(`${card.warrantyYears} years`, true)],
      [
        'Panel film replacement',
        (pkg) => {
          const panels = pkg.replacementClause.join(' ').match(/(\d+)-panel/)
          return panels ? text(`${panels[1]} panels`) : tick(false)
        },
      ],
      ['Self-healing', (pkg) => text(pkg.filmBenefits.some((line) => /^fast self-healing/i.test(line)) ? 'Fast' : 'Thermal')],
      ['Water repellency', (pkg) => text(pkg.filmBenefits.some((line) => /super hydrophobic/i.test(line)) ? 'Super hydrophobic' : 'Hydrophobic')],
    ],
  },
  {
    title: 'Included free',
    rows: [
      ['Glass ceramic coating', (pkg) => tick(pkg.freeAddOns.some((line) => /glass/i.test(line)))],
      ['Wheels ceramic coating', (pkg) => tick(pkg.freeAddOns.some((line) => /wheels/i.test(line)))],
      [
        'Exterior detailing & paint decontamination',
        (pkg) => tick(pkg.keyEnhancements.includes('Full exterior detailing') && pkg.keyEnhancements.includes('Paint decontamination')),
      ],
    ],
  },
]

function CompareCell({ cell }) {
  if (cell.kind === 'yes') {
    return (
      <span className="bd-cmp-yes" role="img" aria-label="Included">
        <Check size={15} strokeWidth={3} aria-hidden="true" />
      </span>
    )
  }
  if (cell.kind === 'no') {
    return (
      <span className="bd-cmp-no" role="img" aria-label="Not included">
        —
      </span>
    )
  }
  return <span className={cell.kind === 'figure' ? 'bd-cmp-figure' : undefined}>{cell.value}</span>
}

/* Flow, top to bottom: what does it start at → what are my choices → which one
   should I get → what is the difference → book. The steps stand on risers that
   climb, so the order reads without comparing a single number; the one tier
   Hakum recommends is the only lit card and the only solid button. */
export default function PpfPackagesSection() {
  /* The table is eleven coverage rows wide and four tiers deep — useful to the
     reader who wants it, a wall of ticks to the one who has already picked a
     step. It opens on request. */
  const [compareOpen, setCompareOpen] = useState(false)

  return (
    <section id="ppf-packages" className="bd-packages" data-service-packages="ppf">
      <div className="bd-shell">
        <header className="bd-pk-top bd-reveal">
          {/* The headline runs across the top; the pitch and the starting
              price share the row beneath it. */}
          <div className="bd-pk-title">
            <p className="bd-eyebrow">Paint protection film packages</p>
            <h2>
              Choose your <em>level of defense.</em>
            </h2>
          </div>
          <p className="bd-pk-sub">
            Stone chips, scratches, and road debris hit the film. Never the paint. Every package uses{' '}
            <a href={PPF_FILM_BRAND.url} target="_blank" rel="noreferrer">
              {PPF_FILM_BRAND.name}
            </a>{' '}
            self-healing TPU film and includes a free glass ceramic coating.
          </p>
          <div className="bd-pk-price">
            <small>Paint protection film</small>
            <strong>Starting from</strong>
            <b>{startingFrom}</b>
            <p>Final pricing may vary depending on vehicle size, film/package selected, and vehicle condition.</p>
          </div>
        </header>

        <div className="bd-pk-steps bd-reveal">
          {packageCards.map((card, index) => {
            const pkg = PPF_PACKAGES[index]
            const name = shortName(card)
            return (
              <article
                key={card.id}
                className={`bd-tier${card.isHighlighted ? ' is-recommended' : ''}`}
                style={{ '--step': index }}
                data-package={card.id}
              >
                <div className="bd-tier-step">
                  <span>
                    Step {String(index + 1).padStart(2, '0')} · {pkg.ladderLabel}
                  </span>
                  {card.isHighlighted && card.recommendedLabel ? (
                    <strong className="bd-tier-badge">{card.recommendedLabel}</strong>
                  ) : null}
                </div>
                <h3>
                  {name}
                  <br />
                  Protection
                </h3>
                <p className="bd-tier-cover">{pkg.coverageLine}</p>
                <p className="bd-tier-price">
                  <s>From</s>
                  <b>{card.priceFromLabel.replace('From ', '')}</b>
                </p>
                <ul>
                  {tierPoints(pkg, card).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                {pkg.ladderNote ? (
                  <p className={`bd-tier-note${pkg.ladderNote.tone === 'different' ? ' is-different' : ''}`}>
                    <b>{pkg.ladderNote.label}</b>
                    {pkg.ladderNote.text}
                  </p>
                ) : null}
                <Link
                  className={`bd-btn ${card.isHighlighted ? 'bd-btn-light' : 'bd-btn-quiet'} bd-tier-book`}
                  to="/book"
                  state={card.bookingState}
                  aria-label={card.ctaLabel}
                >
                  Book {name}
                  {card.isHighlighted ? <ArrowRight size={15} aria-hidden="true" /> : null}
                </Link>
                <span className="bd-tier-riser" aria-hidden="true">
                  Step {index + 1}
                </span>
              </article>
            )
          })}
        </div>

        <div className="bd-cmp-block bd-reveal">
          <button
            type="button"
            className="bd-cmp-toggle"
            aria-expanded={compareOpen}
            aria-controls="ppf-compare"
            onClick={() => setCompareOpen((open) => !open)}
          >
            <span>
              <b>Compare all four packages</b>
              <s>Panel by panel, film, warranty, and what comes free</s>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="bd-cmp" id="ppf-compare" hidden={!compareOpen}>
          <table>
            <caption className="bd-cmp-caption">Compare Paint Protection Film packages</caption>
            <thead>
              <tr>
                <th scope="col">Compare packages</th>
                {packageCards.map((card) => (
                  <th scope="col" key={card.id} className={card.isHighlighted ? 'is-recommended' : undefined}>
                    {card.isHighlighted && card.recommendedLabel ? (
                      <span className="bd-tier-badge">{card.recommendedLabel}</span>
                    ) : null}
                    <b>{shortName(card)}</b>
                    <s>{card.priceFromLabel}</s>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARE_GROUPS.map((group) => (
              <tbody key={group.title}>
                <tr className="bd-cmp-group">
                  <th colSpan={packageCards.length + 1} scope="colgroup">
                    {group.title}
                  </th>
                </tr>
                {group.rows.map(([label, read]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {PPF_PACKAGES.map((pkg, index) => (
                      <td key={pkg.id} className={packageCards[index].isHighlighted ? 'is-recommended' : undefined}>
                        <CompareCell cell={read(pkg, packageCards[index])} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          <div className="bd-cmp-legend">
            <span>
              <span className="bd-cmp-yes" aria-hidden="true">
                <Check size={11} strokeWidth={3} />
              </span>
              Included
            </span>
            <span>
              <span className="bd-cmp-no" aria-hidden="true">
                —
              </span>
              Not included
            </span>
            <span>Warranties cover manufacturer defects. Panel replacement applies to damaged film.</span>
          </div>
        </div>

        {ppfInstallProof.length ? (
          <figure className="ppf-install-proof">
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

        <div className="bd-pk-foot">
          <Link className="bd-btn bd-btn-primary" to="/book" state={{ service: 'Paint Protection Film' }}>
            Book an appointment <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
