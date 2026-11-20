import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, MapPin, Phone, ShieldCheck } from 'lucide-react'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import { fetchPublicBranchHours } from '../lib/branches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import { branchDirections, branchPhone, MAIN_LINE } from '../lib/homeBranches'
import {
  LOCAL_BRANCH_PAGES,
  LOCAL_BRANCH_SERVICE_PAGES,
  LOCAL_SERVICE_PILLARS,
  buildBranchServiceJsonLd,
  findLocalBranchPage,
  findLocalBranchServicePage,
  getBranchReviewsForCity,
} from '../lib/localBranchPages'
import { branchQueueTotal } from '../lib/liveQueuePath'
import { openingHoursSpecification, usePageMeta } from '../lib/pageMeta'
import { formatStartingPrice, useStartingPrices } from '../lib/serviceStartingPrices'
import { usePublicQueueCounts } from '../lib/usePublicQueueCounts'
import '@/styles/seoLocal.css'

const SERVICE_STARTING_HINT = {
  'car-wash': 'Two-bucket pH-neutral wash, microfiber dry, and cabin vacuum',
  'ceramic-coating': 'Includes iron/clay prep, Rupes correction & Kisho 9H curing',
  ppf: 'Self-healing ClearPro optical TPU film · 10-year manufacturer warranty',
  'window-tint': 'High heat-rejection non-metallic ceramic film · RFID friendly',
}

export default function BranchServicePage() {
  const { citySlug, serviceSlug } = useParams()
  const match = useMemo(() => findLocalBranchServicePage(citySlug, serviceSlug), [citySlug, serviceSlug])
  const page = match?.page || null
  const cityPage = useMemo(() => (page ? findLocalBranchPage(page.citySlug) : null), [page])

  const { rows: queueRows, loading: queueLoading, error: queueError } = usePublicQueueCounts()
  const prices = useStartingPrices()
  const [hoursBySlug, setHoursBySlug] = useState({})

  useEffect(() => {
    if (!page) return undefined
    let active = true
    fetchPublicBranchHours([page.branchSlug])
      .then((map) => {
        if (active) setHoursBySlug(map)
      })
      .catch(() => {
        if (active) setHoursBySlug({})
      })
    return () => {
      active = false
    }
  }, [page])

  const openHours = useMemo(() => (page ? hoursBySlug[page.branchSlug] || [] : []), [page, hoursBySlug])
  const jsonLd = useMemo(
    () =>
      page
        ? buildBranchServiceJsonLd(page, {
            hours: openingHoursSpecification(openHours),
          })
        : null,
    [page, openHours],
  )

  usePageMeta(
    page
      ? {
          title: page.seoTitle,
          description: page.seoDescription,
          path: `/branches/${page.citySlug}/${page.serviceSlug}`,
          jsonLd,
          jsonLdId: `hakum-branch-service-${page.citySlug}-${page.serviceSlug}`,
        }
      : { title: 'Branch Services', description: '', path: '/branches' },
  )

  useReveal()

  if (!match) {
    return <Navigate to={citySlug ? `/branches/${citySlug}` : '/branches'} replace />
  }
  if (match.redirected) {
    return <Navigate to={`/branches/${match.canonicalCitySlug}/${match.canonicalServiceSlug}`} replace />
  }

  const liveRow = queueRows.find((r) => r.branch === page.branchSlug)
  const queueTotal = !queueLoading && !queueError ? branchQueueTotal(liveRow || {}) : null
  const directions = branchDirections({ slug: page.branchSlug })
  const phone = branchPhone(page.branchSlug) || MAIN_LINE
  const pillar = LOCAL_SERVICE_PILLARS.find((p) => p.slug === page.serviceSlug)
  const startingMinor = pillar?.startingKey === 'wash' ? prices['premium-wash'] : prices[pillar?.startingKey]
  const reviews = getBranchReviewsForCity(page.branchSlug)
  const siblingServices = LOCAL_BRANCH_SERVICE_PAGES.filter(
    (s) => s.citySlug === page.citySlug && s.serviceSlug !== page.serviceSlug,
  )
  const siblingCitySameService = LOCAL_BRANCH_SERVICE_PAGES.filter(
    (s) => s.serviceSlug === page.serviceSlug && s.citySlug !== page.citySlug,
  )

  return (
    <>
      <BdPageHero eyebrow={page.eyebrow} title={page.h1} copy={page.heroSummary}>
        <nav className="bd-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/branches">Branches</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/branches/${page.citySlug}`}>{page.cityName}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.serviceLabel}</span>
        </nav>

        <nav className="bd-cta-row bd-page-hero-links" aria-label="Service actions">
          {page.mode === 'queue' ? (
            <Link className="bd-btn bd-btn-primary" to={`/queue/${page.branchSlug}`}>
              Live {page.shortCity} queue{queueTotal != null ? ` (${queueTotal} waiting)` : ''}
            </Link>
          ) : (
            <Link className="bd-btn bd-btn-primary" to={`/book?branch=${encodeURIComponent(page.branchSlug)}`}>
              Book at {page.shortCity}
            </Link>
          )}
          <a className="bd-btn bd-btn-quiet" href={phone.href}>
            Call {phone.display}
          </a>
          {directions?.google ? (
            <a className="bd-btn bd-btn-quiet" href={directions.google} target="_blank" rel="noopener noreferrer">
              Google Maps <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </nav>
      </BdPageHero>

      <section aria-labelledby="branch-service-overview">
        <div className="bd-shell bd-city-grid">
          <article className="bd-city-panel bd-reveal">
            <p className="bd-eyebrow">Studio process in {page.shortCity}</p>
            <h2 id="branch-service-overview">How we execute {page.serviceLabel}</h2>
            <p className="bd-near-copy">{SERVICE_STARTING_HINT[page.serviceSlug]}</p>
            <ol className="bd-process-list">
              {page.processSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <p className="bd-eyebrow" style={{ marginTop: 22 }}>
              Why {page.shortCity} drivers trust Hakum
            </p>
            <ul>
              {page.localHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <aside className="bd-city-panel bd-reveal" aria-label="Branch details and directions">
            <p className="bd-eyebrow">{page.cityName} studio details</p>
            <h3>Hakum Auto Care — {page.cityName}</h3>
            {startingMinor ? (
              <p className="bd-near-copy">
                <ShieldCheck size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
                Starts at <strong>{formatStartingPrice(startingMinor)}</strong> (varies by vehicle size &amp; tier)
              </p>
            ) : null}
            <p className="bd-near-copy">
              <MapPin size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              {cityPage?.landmarkAddress || page.cityName}
            </p>
            <p className="bd-near-copy">
              <CheckCircle2 size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              Status: <strong>{openHours.length ? openNowLabel(openHours) : 'Open studio'}</strong>
              {openHours.length ? ` · ${formatHoursSummary(openHours)}` : ''}
            </p>
            <p className="bd-near-copy">
              <Phone size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              <a href={phone.href}>{phone.display}</a>
            </p>

            {cityPage?.corridors?.length ? (
              <div className="bd-corridor-list" aria-label="Areas served">
                {cityPage.corridors.map((c) => (
                  <span key={c} className="bd-corridor-pill">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="bd-near-actions" style={{ marginTop: 18 }}>
              <Link className="bd-btn bd-btn-primary" to={page.serviceDetailRoute}>
                Explore {pillar?.shortLabel || page.serviceLabel} details
              </Link>
              {directions?.waze ? (
                <a className="bd-btn bd-btn-quiet" href={directions.waze} target="_blank" rel="noopener noreferrer">
                  Navigate in Waze
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      {reviews.length ? (
        <section aria-labelledby="branch-reviews-heading">
          <div className="bd-shell">
            <div className="bd-head bd-reveal">
              <div>
                <p className="bd-eyebrow">Verified customer voices</p>
                <h2 id="branch-reviews-heading">Drivers who visit Hakum {page.shortCity}</h2>
              </div>
            </div>
            <div className="bd-city-grid bd-reveal">
              {reviews.map((rev) => (
                <blockquote key={rev.name} className="bd-city-panel" style={{ margin: 0 }}>
                  <p className="bd-near-copy">&ldquo;{rev.quote}&rdquo;</p>
                  <footer style={{ marginTop: 10, fontSize: '0.84rem', color: 'var(--bd-ink-3)' }}>
                    <strong>{rev.name}</strong> ·{' '}
                    <a href={rev.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bd-accent)' }}>
                      Google review <ArrowUpRight size={12} aria-hidden="true" style={{ display: 'inline' }} />
                    </a>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="branch-service-faq-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Local Q&amp;A</p>
              <h2 id="branch-service-faq-heading">
                {page.serviceLabel} FAQ in {page.shortCity}
              </h2>
            </div>
          </div>
          <div className="bd-faq-stack bd-reveal">
            {page.qa.map((item, idx) => (
              <details key={item.q} className="bd-faq-item" open={idx === 0}>
                <summary className="bd-faq-question">{item.q}</summary>
                <div className="bd-faq-answer">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="bd-city-directory bd-reveal">
            {siblingServices.map((peer) => (
              <Link
                key={`${peer.citySlug}-${peer.serviceSlug}`}
                to={`/branches/${peer.citySlug}/${peer.serviceSlug}`}
                className="bd-city-tile"
              >
                <strong>{peer.serviceLabel}</strong>
                <p>Available at Hakum {peer.shortCity}</p>
                <span>Open {peer.shortCity} guide →</span>
              </Link>
            ))}
            {siblingCitySameService.map((peer) => (
              <Link
                key={`${peer.citySlug}-${peer.serviceSlug}`}
                to={`/branches/${peer.citySlug}/${peer.serviceSlug}`}
                className="bd-city-tile"
              >
                <strong>
                  {peer.serviceLabel} — {peer.shortCity}
                </strong>
                <p>Compare our {peer.cityName} studio</p>
                <span>Switch branch →</span>
              </Link>
            ))}
            {LOCAL_BRANCH_PAGES.filter((c) => !c.isOpen).map((c) => (
              <Link key={c.slug} to={`/branches/${c.slug}`} className="bd-city-tile">
                <strong>Near {c.cityName}</strong>
                <p>{c.landmarkAddress}</p>
                <span>View {c.shortName} directions →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
