import { Link, Navigate, useParams } from 'react-router-dom'

import BdPageHero from '../components/public/bredesign/BdPageHero'
import ServiceBottomCta from '../components/public/bredesign/ServiceBottomCta'
import ServiceFaqSection from '../components/public/bredesign/ServiceFaqSection'
import ServiceProofSection from '../components/public/bredesign/ServiceProofSection'
import WhyIcon from '../components/public/bredesign/WhyIcon'
import useReveal from '../components/public/bredesign/useReveal'
import { WHY_SECTIONS } from '../components/public/bredesign/content'
import { CeramicSection, PpfInformationSection } from '../components/public/home/HomeServiceSections'
import PpfPackagesSection from '../components/public/home/PpfPackagesSection'
import { SERVICE_DETAIL_CONTENT } from '../data/serviceDetailContent'
import { usePageMeta } from '../lib/pageMeta'

/* The colour mark, not the monochrome one used in the logo marquee: this is a
   partner credit rather than a row in a wall of suppliers. */
const CLEARPRO_MARK = new URL('../assets/brands/color/clearpro.png', import.meta.url).href

/* Pulled out of the paragraph so the specification can be scanned. The mil
   range spans the three Hakum tiers rather than quoting one sheet. */
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

      <section className="bd-detail" id="detail">
        <div className="bd-shell bd-detail-in">
          <div className="bd-detail-copy bd-reveal">
            <p className="bd-why-lede">
              {section.lede.map((part, i) =>
                typeof part === 'string' ? part : <strong key={i}>{part.strong}</strong>,
              )}
            </p>
            <div className="bd-cta-row bd-why-cta">
              <Link className="bd-btn bd-btn-primary" to={section.cta.to}>
                {section.cta.label}
              </Link>
              <Link className="bd-btn bd-btn-quiet" to="/services">
                All services
              </Link>
            </div>
          </div>

          <ul className="bd-why-points bd-reveal">
            {section.points.map(([title, copy, icon]) => (
              <li key={title}>
                <WhyIcon name={icon} />
                <strong>{title}</strong>
                <span>{copy}</span>
              </li>
            ))}
          </ul>

          {/* The partner strip used to set "ClearPro" in our own display face —
              our typography wearing their name, which is the opposite of a
              credit. It carries their actual mark now, and the specification
              moves out of the paragraph into figures a buyer can scan. */}
          {slug === 'ppf' ? (
            <aside className="bd-clearpro-card bd-reveal" data-service-brand="clearpro">
              <div className="bd-clearpro-mark">
                <img src={CLEARPRO_MARK} alt="ClearPro" loading="lazy" decoding="async" />
                <span>Film<br />partner</span>
              </div>
              <div className="bd-clearpro-body">
                <p>
                  ClearPro’s optical TPU film combines a self-healing top coat, hydrophobic
                  performance, high clarity, and resistance to yellowing.
                </p>
                <ul className="bd-clearpro-figures">
                  {CLEARPRO_FIGURES.map(([value, label]) => (
                    <li key={label}>
                      <b>{value}</b>
                      <s>{label}</s>
                    </li>
                  ))}
                </ul>
              </div>
              <a href="https://www.clearpro.com/paint-protection-film/" target="_blank" rel="noreferrer noopener">
                Explore ClearPro <span aria-hidden="true">↗</span>
              </a>
            </aside>
          ) : null}
        </div>
      </section>

      {slug === 'ppf' ? <PpfPackagesSection /> : null}
      {slug === 'ceramic' ? <CeramicSection /> : null}
      {detail.proof ? <ServiceProofSection serviceId={slug} proof={detail.proof} /> : null}
      <ServiceFaqSection serviceId={slug} serviceName={detail.serviceName} faqs={detail.faqs} />
      <ServiceBottomCta
        serviceId={slug}
        serviceName={detail.serviceName}
        bookState={detail.bookState}
      />
    </>
  )
}
