import { Link, Navigate, useParams } from 'react-router-dom'

import BdPageHero from '../components/public/bredesign/BdPageHero'
import ServiceBottomCta from '../components/public/bredesign/ServiceBottomCta'
import ServiceFaqSection from '../components/public/bredesign/ServiceFaqSection'
import ServiceProofSection from '../components/public/bredesign/ServiceProofSection'
import useReveal from '../components/public/bredesign/useReveal'
import { WHY_SECTIONS } from '../components/public/bredesign/content'
import { CeramicSection, PpfInformationSection } from '../components/public/home/HomeServiceSections'
import PpfPackagesSection from '../components/public/home/PpfPackagesSection'
import { SERVICE_DETAIL_CONTENT } from '../data/serviceDetailContent'
import { usePageMeta } from '../lib/pageMeta'

/* One page per service, reached from the cards in "Our services".
 *
 * The Why content used to sit on the homepage, three sections deep. Moving it
 * here shortens the homepage and gives each service a URL someone can actually
 * send to a customer, which an accordion on the homepage could not.
 *
 * The scrubbed installation belongs to film alone. It is a 181-frame sequence,
 * so putting it anywhere a reader has not asked about film is a lot of loading
 * for a page that is about something else. */
const HAS_SEQUENCE = new Set(['ppf'])

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
      <BdPageHero
        eyebrow={section.eyebrow}
        scrollAnimated={slug === 'ppf'}
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
            {section.points.map(([title, copy]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{copy}</span>
              </li>
            ))}
          </ul>

          {slug === 'ppf' ? (
            <aside className="bd-clearpro-card bd-reveal" data-service-brand="clearpro">
              <div>
                <span>Film partner</span>
                <strong>ClearPro</strong>
              </div>
              <p>
                ClearPro’s optical TPU film combines a self-healing top coat, hydrophobic performance,
                high clarity, and resistance to yellowing. Its current UltraClear technical sheet lists a
                nominal 7.5 mil construction.
              </p>
              <a href="https://www.clearpro.com/paint-protection-film/" target="_blank" rel="noreferrer noopener">
                Explore ClearPro technology <span aria-hidden="true">↗</span>
              </a>
            </aside>
          ) : null}
        </div>
      </section>

      {HAS_SEQUENCE.has(slug) ? <PpfInformationSection /> : null}
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
