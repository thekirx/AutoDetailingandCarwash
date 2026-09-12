import { Link, Navigate, useParams } from 'react-router-dom'

import BdPageHero from '../components/public/bredesign/BdPageHero'
import ServiceBottomCta from '../components/public/bredesign/ServiceBottomCta'
import ServiceFaqSection from '../components/public/bredesign/ServiceFaqSection'
import ServiceProofSection from '../components/public/bredesign/ServiceProofSection'
import useReveal from '../components/public/bredesign/useReveal'
import { IMAGES, SERVICE_POINT_CARDS, WHY_SECTIONS } from '../components/public/bredesign/content'
import { CeramicSection, PpfInformationSection } from '../components/public/home/HomeServiceSections'
import PpfPackagesSection from '../components/public/home/PpfPackagesSection'
import { SERVICE_DETAIL_CONTENT } from '../data/serviceDetailContent'
import { usePageMeta } from '../lib/pageMeta'

/* The colour mark, not the monochrome one used in the logo marquee: this is a
   partner credit rather than a row in a wall of suppliers. */
const CLEARPRO_MARK = new URL('../assets/brands/color/clearpro.png', import.meta.url).href

/* Pulled out of the paragraph so the specification can be scanned. The mil
   range spans the Hakum tiers rather than quoting one sheet. */
const CLEARPRO_FIGURES = [
  ['7.5–8.5', 'mil construction'],
  ['Aliphatic', 'non-yellowing'],
  ['Invisiglue', 'no residue'],
  ['Polyoptico', 'glossy finish'],
]

/* One page per service, reached from the cards in "Our services".
 *
 * The Why content used to sit on the homepage, three sections deep. Moving it
 * here shortens the homepage and gives each service a URL someone can actually
 * send to a customer, which an accordion on the homepage could not.
 *
 * The scrubbed installation belongs to film alone. It is a 181-frame sequence,
 * so putting it anywhere a reader has not asked about film is a lot of loading
 * for a page that is about something else. */

const TITLES = {
  ppf: 'Paint Protection Film',
  ceramic: 'Ceramic Coating',
  tint: 'Nano Ceramic Tint',
}

/* Where the second button in the detail row goes: straight to the packages on
   the two pages that have them, back to the menu on the one that does not. */
const SECONDARY_CTA = {
  ppf: { label: 'See packages', href: '#ppf-packages' },
  ceramic: { label: 'See packages', href: '#ceramic' },
  tint: { label: 'All services', to: '/services' },
}

function LedeText({ parts }) {
  return parts.map((part, i) => (typeof part === 'string' ? part : <strong key={i}>{part.strong}</strong>))
}

function DetailCtas({ slug, section }) {
  const secondary = SECONDARY_CTA[slug]
  return (
    <div className="bd-cta-row bd-why-cta">
      <Link className="bd-btn bd-btn-primary" to={section.cta.to}>
        {section.cta.label}
      </Link>
      {secondary.to ? (
        <Link className="bd-btn bd-btn-quiet" to={secondary.to}>
          {secondary.label}
        </Link>
      ) : (
        <a className="bd-btn bd-btn-quiet" href={secondary.href}>
          {secondary.label}
        </a>
      )}
    </div>
  )
}

function ClearProCard() {
  return (
    <aside className="bd-clearpro-card bd-reveal" data-service-brand="clearpro">
      <figure className="bd-clearpro-photo">
        <img
          src={IMAGES.ppfClearpro}
          alt="A ClearPro squeegee on a panel during a Hakum paint protection film installation"
          loading="lazy"
          decoding="async"
        />
        <figcaption>Hakum install · ClearPro film</figcaption>
      </figure>
      <div className="bd-clearpro-body">
        <div className="bd-clearpro-mark">
          <img src={CLEARPRO_MARK} alt="ClearPro" loading="lazy" decoding="async" />
          <span>
            Film
            <br />
            partner
          </span>
        </div>
        <h3>
          Premium paint <em>protection film.</em>
        </h3>
        <p>
          ClearPro’s optical TPU film combines a self-healing top coat, hydrophobic performance, high
          clarity, and resistance to yellowing.
        </p>
        <ul className="bd-clearpro-figures">
          {CLEARPRO_FIGURES.map(([value, label]) => (
            <li key={label}>
              <b>{value}</b>
              <s>{label}</s>
            </li>
          ))}
        </ul>
        <a href="https://www.clearpro.com/paint-protection-film/" target="_blank" rel="noreferrer noopener">
          Explore ClearPro <span aria-hidden="true">↗</span>
        </a>
      </div>
    </aside>
  )
}

/* The detail section, the same on every service: the lede across the top
   rather than floating in a half-empty column, then the four points as photo
   cards using the full width. PPF opens on the install sequence, which has no
   headline of its own, so it carries one here and closes on the ClearPro
   credit; ceramic and tint already have their headline in the page hero. */
function ServiceDetail({ slug, section }) {
  const cards = SERVICE_POINT_CARDS[slug] || []
  const withHeadline = slug === 'ppf'
  const lastLine = section.headline[section.headline.length - 1]

  return (
    <section className="bd-detail bd-photo-detail" id="detail">
      <div className="bd-shell">
        <div className={`bd-detail-top bd-reveal${withHeadline ? '' : ' is-lede'}`}>
          {withHeadline ? (
            <>
              <div className="bd-detail-title">
                <p className="bd-eyebrow">{section.eyebrow}</p>
                {/* The headline runs across the row rather than breaking on a
                    hard return inside a half-width column. */}
                <h2>
                  {section.headline.slice(0, -1).join(' ')} <em>{lastLine}</em>
                </h2>
              </div>
              <p className="bd-why-lede">
                <LedeText parts={section.lede} />
              </p>
              <DetailCtas slug={slug} section={section} />
            </>
          ) : (
            <>
              <p className="bd-why-lede">
                <LedeText parts={section.lede} />
              </p>
              <DetailCtas slug={slug} section={section} />
            </>
          )}
        </div>

        <ul className="bd-photo-cards bd-reveal">
          {cards.map((card, index) => (
            <li className="bd-photo-card" key={card.title}>
              <span className="bd-photo-card-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <figure>
                <img
                  src={card.image}
                  alt={card.alt}
                  loading="lazy"
                  decoding="async"
                  style={card.position ? { objectPosition: card.position } : undefined}
                />
              </figure>
              <div>
                <strong>{card.title}</strong>
                <span>{card.copy}</span>
              </div>
            </li>
          ))}
        </ul>

        {slug === 'ppf' ? <ClearProCard /> : null}
      </div>
    </section>
  )
}

export default function ServiceDetailPage() {
  const { slug } = useParams()
  const section = WHY_SECTIONS.find((s) => s.id === slug)
  const detail = SERVICE_DETAIL_CONTENT[slug]

  usePageMeta({
    title: TITLES[slug] || 'Services',
    description: section ? section.points.map(([t]) => t).join(' · ') : undefined,
    path: `/services/${slug}`,
  })

  useReveal()

  // An unknown slug is not a broken page — it is someone who wants the menu.
  if (!section) return <Navigate to="/services" replace />

  return (
    <>
      {slug === 'ppf' ? (
        <PpfInformationSection />
      ) : (
        <BdPageHero
          eyebrow={section.eyebrow}
          title={
            <>
              {section.headline.slice(0, -1).map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              <em>{section.headline[section.headline.length - 1]}</em>
            </>
          }
          image={section.image}
        />
      )}

      <ServiceDetail slug={slug} section={section} />

      {slug === 'ppf' ? <PpfPackagesSection /> : null}
      {slug === 'ceramic' ? <CeramicSection /> : null}
      {detail.proof ? (
        <ServiceProofSection serviceId={slug} serviceName={detail.serviceName} proof={detail.proof} />
      ) : null}
      <ServiceFaqSection serviceId={slug} serviceName={detail.serviceName} faqs={detail.faqs} />
      <ServiceBottomCta
        serviceId={slug}
        serviceName={detail.serviceName}
        bookState={detail.bookState}
      />
    </>
  )
}
