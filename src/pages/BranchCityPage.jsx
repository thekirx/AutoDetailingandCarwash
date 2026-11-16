import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, MapPin, Phone } from 'lucide-react'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import NearestBranchFinder from '../components/public/NearestBranchFinder'
import { fetchPublicBranchHours, usePublicBranches } from '../lib/branches'
import { branchDirections } from '../lib/homeBranches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import {
  BRAND_POSITIONING,
  LOCAL_BRANCH_PAGES,
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
              Nearby areas we serve
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
