import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, MapPin, Phone, Sparkles } from 'lucide-react'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import NearestBranchFinder from '../components/public/NearestBranchFinder'
import { fetchPublicBranchHours, usePublicBranches } from '../lib/branches'
import { branchDirections } from '../lib/homeBranches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import {
  BRAND_POSITIONING,
  COMPLETE_DETAILING_CATALOG,
  LOCAL_BRANCH_PAGES,
  LOCAL_SERVICE_PILLARS,
  STUDIO_COMPARISON_ROWS,
  STUDIO_PRODUCTS_AND_BRANDS,
  buildBranchCityJsonLd,
  findLocalBranchPage,
} from '../lib/localBranchPages'
import { branchQueueTotal } from '../lib/liveQueuePath'
import { openingHoursSpecification, usePageMeta } from '../lib/pageMeta'
import { usePublicQueueCounts } from '../lib/usePublicQueueCounts'
import { findBuiltInBlogPost } from '../lib/seoLocalGuides'
import '@/styles/seoLocal.css'

export default function BranchCityPage() {
  const { citySlug } = useParams()
  const cityPage = useMemo(() => findLocalBranchPage(citySlug), [citySlug])
  const { branches } = usePublicBranches({ mode: 'visible' })
  const { rows: queueRows, loading: queueLoading, error: queueError } = usePublicQueueCounts()
  const [hoursBySlug, setHoursBySlug] = useState({})

  useEffect(() => {
    if (!cityPage?.isOpen) return undefined
    let active = true
    fetchPublicBranchHours([cityPage.branchSlug])
      .then((map) => {
        if (active) setHoursBySlug(map)
      })
      .catch(() => {
        if (active) setHoursBySlug({})
      })
    return () => {
      active = false
    }
  }, [cityPage])

  const openHours = useMemo(
    () => (cityPage ? hoursBySlug[cityPage.branchSlug] || [] : []),
    [cityPage, hoursBySlug],
  )
  const jsonLd = useMemo(
    () =>
      cityPage
        ? buildBranchCityJsonLd(cityPage, {
            hours: cityPage.isOpen ? openingHoursSpecification(openHours) : [],
          })
        : null,
    [cityPage, openHours],
  )

  usePageMeta(
    cityPage
      ? {
          title: cityPage.seoTitle,
          description: cityPage.seoDescription,
          path: `/branches/${cityPage.slug}`,
          keywords: (cityPage.keywords || []).join(', '),
          jsonLd,
          jsonLdId: `hakum-city-${cityPage.slug}`,
        }
      : { title: 'Branch not found', description: '', path: '/branches' },
  )

  useReveal()

  if (!cityPage) {
    return <Navigate to="/branches" replace />
  }

  const liveRow = queueRows.find((r) => r.branch === cityPage.branchSlug)
  const queueTotal = !queueLoading && !queueError ? branchQueueTotal(liveRow || {}) : null
  const directions = branchDirections({ slug: cityPage.branchSlug })
  const relatedGuide = findBuiltInBlogPost(cityPage.relatedGuideSlug)
  const statusBadge = cityPage.isOpen
    ? openHours.length
      ? openNowLabel(openHours)
      : 'Open studio'
    : 'Coming soon · Nearest bays in Bacoor'

  return (
    <>
      <BdPageHero
        eyebrow={cityPage.eyebrow}
        title={cityPage.h1}
        copy={cityPage.heroSummary}
      >
        <nav className="bd-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/branches">Branches</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{cityPage.cityName}</span>
        </nav>

        <nav className="bd-cta-row bd-page-hero-links" aria-label="Branch quick actions">
          <Link className="bd-btn bd-btn-primary" to={`/book?branch=${encodeURIComponent(cityPage.branchSlug)}`}>
            Book at {cityPage.branchSlug === 'batangas' ? 'Batangas' : 'Bacoor'}
          </Link>
          <Link className="bd-btn bd-btn-quiet" to={`/queue/${cityPage.branchSlug}`}>
            Live queue{queueTotal != null ? ` (${queueTotal} waiting)` : ''}
          </Link>
          {directions?.google ? (
            <a className="bd-btn bd-btn-quiet" href={directions.google} target="_blank" rel="noopener noreferrer">
              Google Maps Directions <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </nav>
      </BdPageHero>

      <section aria-labelledby="city-overview-heading">
        <div className="bd-shell">
          {cityPage.aiSummary ? (
            <aside className="bd-ai-callout bd-reveal" aria-label={`At a glance in ${cityPage.cityName}`}>
              <p className="bd-ai-callout-label">
                <Sparkles size={13} aria-hidden="true" /> Studio executive summary · {cityPage.cityName}
              </p>
              <p>{cityPage.aiSummary}</p>
            </aside>
          ) : null}
        </div>

        <div className="bd-shell bd-city-grid">
          <article className="bd-city-panel bd-reveal">
            <p className="bd-eyebrow">Studio overview</p>
            <h2 id="city-overview-heading">Why {cityPage.shortName} drivers choose Hakum Auto Care</h2>
            <p className="bd-near-copy">{BRAND_POSITIONING}</p>
            <ul>
              {cityPage.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="bd-eyebrow" style={{ marginTop: 22 }}>
              Nearby areas &amp; corridors we serve in {cityPage.shortName}
            </p>
            <div className="bd-corridor-list">
              {cityPage.corridors.map((c) => (
                <span key={c} className="bd-corridor-pill">
                  {c}
                </span>
              ))}
            </div>
          </article>

          <aside className="bd-city-panel bd-reveal" aria-label="Branch facts and direct line">
            <p className="bd-eyebrow">Branch details</p>
            <h3>{cityPage.cityName}</h3>
            <p className="bd-near-copy">
              <MapPin size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              {cityPage.landmarkAddress}
            </p>
            <p className="bd-near-copy">
              <CheckCircle2 size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
              Status: <strong>{statusBadge}</strong>
            </p>
            {openHours.length ? <p className="bd-near-copy">Hours: {formatHoursSummary(openHours)}</p> : null}
            {cityPage.phone?.href ? (
              <p className="bd-near-copy">
                <Phone size={14} aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
                <a href={cityPage.phone.href}>{cityPage.phone.display}</a>
              </p>
            ) : null}
            <div className="bd-near-actions" style={{ marginTop: 16 }}>
              <Link className="bd-btn bd-btn-primary" to="/services">
                View services &amp; packages
              </Link>
              {directions?.waze ? (
                <a className="bd-btn bd-btn-quiet" href={directions.waze} target="_blank" rel="noopener noreferrer">
                  Navigate in Waze
                </a>
              ) : null}
            </div>
            {relatedGuide ? (
              <p className="bd-near-copy" style={{ marginTop: 14 }}>
                Read our regional guide:{' '}
                <Link to={`/blog/${relatedGuide.slug}`}>{relatedGuide.title}</Link>
              </p>
            ) : null}
          </aside>
        </div>

        <div className="bd-shell">
          <NearestBranchFinder branches={branches} defaultCity={cityPage.slug} headingLevel="h3" />
        </div>
      </section>

      <section aria-labelledby="city-complete-catalog-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Complete service &amp; product lineup</p>
              <h2 id="city-complete-catalog-heading">
                All Car Wash, Auto Detailing, Ceramic Coating &amp; PPF Services in {cityPage.shortName}
              </h2>
            </div>
          </div>

          <div className="bd-city-directory bd-reveal">
            {LOCAL_SERVICE_PILLARS.map((svc) => (
              <Link
                key={svc.slug}
                to={`/branches/${cityPage.slug}/${svc.slug}`}
                className="bd-city-tile"
              >
                <strong>
                  {svc.label} — {cityPage.shortName}
                </strong>
                <p>
                  Available at Hakum {cityPage.branchSlug === 'batangas' ? 'Batangas City' : 'Bacoor'}
                  {cityPage.isOpen ? '' : ` (serving ${cityPage.shortName})`}
                </p>
                <span>Open {cityPage.shortName} {svc.shortLabel} guide →</span>
              </Link>
            ))}
          </div>

          <div className="bd-catalog-grid bd-reveal">
            {COMPLETE_DETAILING_CATALOG.map((item) => (
              <article key={item.id} className="bd-city-tile">
                <span className="bd-eyebrow">{item.category}</span>
                <strong>{item.name}</strong>
                <p>{item.summary}</p>
                <Link to={`/branches/${cityPage.slug}/${item.pillarSlug}`}>
                  Explore in {cityPage.shortName} →
                </Link>
              </article>
            ))}
          </div>

          <div className="bd-head bd-reveal" style={{ marginTop: 32 }}>
            <div>
              <p className="bd-eyebrow">Certified studio chemistry &amp; hardware</p>
              <h3>Detailing Products &amp; Protection Brands Used at Hakum {cityPage.shortName}</h3>
            </div>
          </div>
          <div className="bd-catalog-grid bd-reveal">
            {STUDIO_PRODUCTS_AND_BRANDS.map((b) => (
              <article key={b.brand} className="bd-city-tile">
                <span className="bd-eyebrow">{b.origin}</span>
                <strong>{b.brand}</strong>
                <p>{b.use}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="city-comparison-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Workmanship benchmark</p>
              <h2 id="city-comparison-heading">
                Hakum Auto Care {cityPage.shortName} vs. Ordinary Roadside Car Wash &amp; Dealerships
              </h2>
            </div>
          </div>
          <div className="bd-comparison-table-wrap bd-reveal">
            <table className="bd-comparison-table">
              <thead>
                <tr>
                  <th scope="col">Detailing Standard</th>
                  <th scope="col">Hakum Auto Care ({cityPage.shortName})</th>
                  <th scope="col">Typical Roadside Car Wash</th>
                  <th scope="col">Dealership Add-On Package</th>
                </tr>
              </thead>
              <tbody>
                {STUDIO_COMPARISON_ROWS.map((row) => (
                  <tr key={row.criteria}>
                    <td>{row.criteria}</td>
                    <td>{row.hakum}</td>
                    <td>{row.roadside}</td>
                    <td>{row.dealership}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="city-faq-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Local answers</p>
              <h2 id="city-faq-heading">Questions in {cityPage.cityName}</h2>
            </div>
          </div>
          <div className="bd-faq-stack bd-reveal">
            {cityPage.qa.map((item, idx) => (
              <details key={item.q} className="bd-faq-item" open={idx === 0}>
                <summary className="bd-faq-question">{item.q}</summary>
                <div className="bd-faq-answer">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>

          {Array.isArray(cityPage.keywords) && cityPage.keywords.length ? (
            <div className="bd-city-panel bd-reveal" style={{ marginTop: 22 }}>
              <p className="bd-eyebrow">Popular local searches in {cityPage.cityName}</p>
              <div className="bd-corridor-list">
                {cityPage.keywords.map((kw) => (
                  <span key={kw} className="bd-corridor-pill">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bd-city-directory bd-reveal">
            {LOCAL_BRANCH_PAGES.map((peer) => (
              <Link key={peer.slug} to={`/branches/${peer.slug}`} className="bd-city-tile">
                <strong>{peer.cityName}</strong>
                <p>{peer.landmarkAddress}</p>
                <span>Open studio page →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
