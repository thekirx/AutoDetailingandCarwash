import { Link, Navigate, useParams } from 'react-router-dom'

import BdPageHero from '../components/public/bredesign/BdPageHero'
import ServiceBottomCta from '../components/public/bredesign/ServiceBottomCta'
import ServiceFaqSection from '../components/public/bredesign/ServiceFaqSection'
import ServiceProofSection from '../components/public/bredesign/ServiceProofSection'
import useReveal from '../components/public/bredesign/useReveal'
import { IMAGES, SERVICE_POINT_CARDS, WASH_SERVICES, WHY_SECTIONS } from '../components/public/bredesign/content'
import { LoopArrows, LoopBar } from '../components/public/bredesign/LoopRail'
import { loopSlides, useLoopRail } from '../components/public/bredesign/useLoopRail'
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
  ['Polyoptico', 'coating technology'],
  ['Invisiglue', 'adhesive technology'],
  ['Optical TPU', 'non-yellowing material'],
  ['Self-healing', 'protective top coat'],
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
  'wash-detailing': 'Premium Wash & Detailing',
}

/* Where the second button in the detail row goes: straight to the packages on
   the two pages that have them, back to the menu on the one that does not. */
const SECONDARY_CTA = {
  ppf: { label: 'See packages', href: '#ppf-packages' },
  ceramic: { label: 'See packages', href: '#ceramic' },
  tint: { label: 'All services', to: '/services' },
  'wash-detailing': { label: 'All services', to: '/services' },
}

const WASH_REVIEWS = [
  { name: 'Marryel Joan Macaraig', branch: 'Bacoor', quote: 'I am a repeat customer and have my cars cleaned here. The cars always look brand new and smells nice after having them washed and waxed. I always get asked where I have them cleaned.', href: 'https://share.google/lpF0zmw4zeU7E7liX' },
  { name: 'Paul Russel Sandoval', branch: 'Batangas', quote: 'Hands down one of the best carwash services around Batangas City! Hakum did a fast, thorough, and flawless job. Friendly staff and great value. Highly recommended!', href: 'https://share.google/2YwjrE1QVXO2sYasP' },
  { name: 'Benedict Carl', branch: 'Bacoor', quote: 'Availed the Basic package with Machine buffing, I could say that I’m satisfied with the services. Will definitely visit again.', href: 'https://share.google/apvEs8l2d3i7Lwz3I' },
  { name: 'Krisha May Aguila', branch: 'Batangas', quote: 'Excellent Carwash is comparable to other well-known car wash companies.', href: 'https://share.google/t7gyi8hUV0cqYSqvj' },
  { name: 'Ailyn De Leon', branch: 'Bacoor', quote: 'Clean, fast, and smells good. Keep it up! We’ll be back.', href: 'https://share.google/0rpL372H6dsN3wtia' },
]

function WashServiceRail() {
  const rail = useLoopRail(WASH_SERVICES.length)
  return (
    <section className="bd-wash-services" aria-labelledby="wash-services-title">
      <div className="bd-shell">
        <div className="bd-wash-services-head">
          <div><p className="bd-eyebrow">Premium wash & detailing</p><h2 id="wash-services-title">Choose the care your car needs.</h2></div>
          <LoopArrows rail={rail} label="wash service" />
        </div>
        <div className="bd-wash-service-rail" ref={rail.trackRef} data-wash-service-rail data-looping="true">
          {loopSlides(WASH_SERVICES, rail.copies).map(({ item, copy, key }) => (
            <article className="bd-wash-service-card" data-wash-service-card key={key} aria-hidden={copy || undefined}>
              {item.image ? <img src={item.image} alt={copy ? '' : item.alt} loading="lazy" /> : <div className="bd-wash-coming">Coming soon</div>}
              <div><h3>{item.title}</h3><p>{item.copy}</p><strong>✓ {item.benefit}</strong>
                {item.available ? <Link className="bd-btn bd-btn-primary" to="/queue">View live queue</Link> : <span className="bd-wash-unavailable">Coming soon</span>}
              </div>
            </article>
          ))}
        </div>
        <LoopBar rail={rail} />
      </div>
    </section>
  )
}

function WashReviews() {
  return (
    <section className="bd-service-reviews"><div className="bd-shell">
      <p className="bd-eyebrow">Google reviews</p><h2>What customers say about the clean.</h2>
      <div className="bd-service-review-grid">{WASH_REVIEWS.map((review) => (
        <a key={review.name} data-service-review href={review.href} target="_blank" rel="noreferrer noopener">
          <span>★★★★★</span><blockquote>“{review.quote}”</blockquote><strong>{review.name}</strong><small>{review.branch} branch · Google review ↗</small>
        </a>
      ))}</div>
    </div></section>
  )
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
        <p className="bd-clearpro-kicker">About our film partner</p>
        <div className="bd-clearpro-mark">
          <img src={CLEARPRO_MARK} alt="ClearPro" loading="lazy" decoding="async" />
          <span>
            Film
            <br />
            partner
          </span>
        </div>
        <h3>ClearPro. <em>Adapted for protection.</em></h3>
        <p>
          ClearPro is a professional paint-protection-film manufacturer focused on material research,
          automated production, and technologies engineered to protect a vehicle’s original finish.
        </p>
        <ul className="bd-clearpro-figures">
          {CLEARPRO_FIGURES.map(([value, label]) => (
            <li key={label}>
              <b>{value}</b>
              <span>{label}</span>
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

        {slug === 'ppf' || slug === 'ceramic' || slug === 'tint' ? (
          <h2 className="bd-benefits-heading">
            Benefits of {slug === 'ppf' ? 'PPF' : slug === 'ceramic' ? 'Ceramic Coating' : 'Nano Ceramic Tint'}
          </h2>
        ) : null}
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
          title={slug === 'wash-detailing' ? <><span>Premium Wash &amp; </span><br /><em>Detailing.</em></> :
            <>
              {section.headline.slice(0, -1).map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              <em>{section.headline[section.headline.length - 1]}</em>
            </>}
          image={section.image}
        />
      )}

      {slug === 'wash-detailing' ? <WashServiceRail /> : <ServiceDetail slug={slug} section={section} />}

      {slug === 'ppf' ? <PpfPackagesSection /> : null}
      {slug === 'ceramic' ? <CeramicSection /> : null}
      {slug === 'wash-detailing' ? <WashReviews /> : null}
      {detail.proof ? (
        <ServiceProofSection serviceId={slug} serviceName={detail.serviceName} proof={detail.proof} />
      ) : null}
      <ServiceFaqSection serviceId={slug} serviceName={detail.serviceName} faqs={detail.faqs} />
      {slug === 'wash-detailing' ? (
        <section className="bd-service-bottom-cta bd-wash-queue-cta">
          <div className="bd-shell">
            <p className="bd-eyebrow">First come, first served</p>
            <h2>Check the queue. <em>Then drive in.</em></h2>
            <p>Premium wash and detailing services are walk-in only. See how busy each branch is before you go.</p>
            <Link className="bd-btn bd-btn-primary" to="/queue">View live queue</Link>
          </div>
        </section>
      ) : (
        <ServiceBottomCta
          serviceId={slug}
          serviceName={detail.serviceName}
          bookState={detail.bookState}
        />
      )}
    </>
  )
}
