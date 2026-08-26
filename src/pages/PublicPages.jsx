import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CeramicSection } from '../components/public/home/HomeServiceSections'

const PPFVisualizer = lazy(() => import('../components/PPFVisualizer'))
import { usePublicBranches, branchLabel, fetchPublicBranchHours } from '../lib/branches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import {
  buildPublicServiceOverview,
  fetchPublicCatalogServices,
  marketingKeyForServiceSlug,
} from '../lib/publicCatalog'
import { usePageMeta } from '../lib/pageMeta'

// Photos are looked up by the service's canonical marketing key so a card
// without artwork simply falls back to the icon.
const serviceImages = import.meta.glob('../assets/services/*.{webp,jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})
// Accepts one filename or a preference list; the first file present wins.
const serviceImage = (files) =>
  [files].flat().reduce((hit, file) => hit ?? serviceImages[`../assets/services/${file}`], undefined)

// Live catalog keys that have artwork; a key with no entry renders the icon.
const SERVICE_PHOTOS = {
  carwash: 'carwash.webp',
  'interior-detailing': 'interior-detailing.webp',
  'paint-correction': 'paint-correction.webp',
  'ceramic-coating': ['ceramic-coating.webp', 'ceramic.webp'],
  'ceramic-tint': 'ceramic-tint.webp',
  'paint-protection-film': 'paint-protection-film.webp',
  detailing: 'detailing.webp',
  'glass-detailing': 'glass-detailing.webp',
  'engine-wash': 'engine-wash.webp',
}

const photoForService = (slug) => serviceImage(SERVICE_PHOTOS[marketingKeyForServiceSlug(slug)] || [])

export function ServicesPage() {
  const [serviceItems, setServiceItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetchPublicCatalogServices()
      .then((rows) => {
        if (cancelled) return
        setServiceItems(buildPublicServiceOverview(rows))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message || 'Could not load services.')
        setServiceItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageHero
      eyebrow="Our services · Live catalog"
      title={
        <>
          Precision in
          <br />
          <i>every pass.</i>
        </>
      }
      copy="Service names match Hakum Inventory — the same menu you see when you book or check out at the bay."
    >
      <section className="content-section">
        <p className="public-shell mb-6 text-sm text-slate-500">
          Names and order come from the live catalog. Marketing descriptions appear when a homepage match exists; otherwise the inventory description is shown.
        </p>
        {loadError ? (
          <p className="public-shell mb-6 text-sm text-destructive">{loadError}</p>
        ) : null}
        {loading ? (
          <p className="public-shell text-sm text-slate-500">Loading services…</p>
        ) : (
          <div className="public-shell numbered-grid">
            {serviceItems.map((item, i) => {
              const image = photoForService(item.slug)
              return (
                <article key={item.id || item.slug} className={image ? 'has-photo' : undefined}>
                  <span>0{i + 1}</span>
                  {image ? (
                    <img src={image} alt={`${item.title} at Hakum Auto Care`} loading="lazy" decoding="async" />
                  ) : (
                    <Sparkles />
                  )}
                  <h2>{item.title}</h2>
                  <p>{item.copy}</p>
                  <Link to="/book" state={{ service: item.title, service_id: item.id }}>
                    Book this service <ArrowRight />
                  </Link>
                </article>
              )
            })}
            {!serviceItems.length && !loadError ? (
              <p className="text-sm text-slate-500">No active services are listed yet.</p>
            ) : null}
          </div>
        )}
      </section>
    </PageHero>
  )
}

export function PackagesPage() {
  return (
    <>
      <PageHero
        eyebrow="Protection packages"
        title={
          <>
            Shield beyond
            <br />
            <i>compare.</i>
          </>
        }
        copy="Long-term ceramic gloss and precision-fit PPF, built around how much protection your vehicle needs. Package titles match booking prefill."
      />
      <CeramicSection />
      <Suspense fallback={null}>
        <PPFVisualizer />
      </Suspense>
    </>
  )
}

export function BranchesPage() {
  const { branches, loading, error } = usePublicBranches({ mode: 'visible' })
  const [hoursBySlug, setHoursBySlug] = useState({})

  usePageMeta({
    title: 'Branches',
    description: 'Find Hakum Auto Care branches across Cavite and Batangas. Book a visit or open the live queue.',
    path: '/branches',
  })

  useEffect(() => {
    let active = true
    const slugs = branches.map((b) => b.slug)
    if (!slugs.length) {
      setHoursBySlug({})
      return undefined
    }
    fetchPublicBranchHours(slugs)
      .then((map) => {
        if (active) setHoursBySlug(map)
      })
      .catch(() => {
        if (active) setHoursBySlug({})
      })
    return () => {
      active = false
    }
  }, [branches])

  return (
    <section className="hb-sites">
      <div className="lq-picker-bg" aria-hidden />
      <div className="lq-picker-noise" aria-hidden />
      <div className="public-shell hb-sites-inner">
        <div className="hb-sites-copy">
          <img src="/branding/hakum-wm-ow.png" alt="Hakum" className="lq-picker-wm" width={180} height={44} />
          <p className="lq-kicker">
            <span className="lq-pulse">
              <span className="lq-pulse-dot" aria-hidden />
              Find Hakum
            </span>
          </p>
          <h1 className="lq-picker-title">
            Our branches.
            <br />
            <i>One standard.</i>
          </h1>
          <p className="lq-picker-lede">
            Premium care across {branchLabel(branches.length)}. Comfortable spaces and teams who take pride in the details.
          </p>
          <nav className="hb-sites-links" aria-label="Quick links">
            <Link className="lq-text-link" to="/queue">
              Live queue
            </Link>
            <Link className="lq-text-link" to="/book">
              Book a service
            </Link>
            <Link className="lq-text-link" to="/contact">
              Contact
            </Link>
          </nav>
        </div>

        <div className="hb-sites-grid" aria-label="Branch locations">
          {error ? <p className="lq-picker-error">{error}</p> : null}
          {loading ? (
            <>
              <div className="lq-skeleton hb-sites-skel" />
              <div className="lq-skeleton hb-sites-skel" />
            </>
          ) : null}
          {branches.map((b, index) => (
            <BranchSiteCard key={b.slug} branch={b} index={index} hours={hoursBySlug[b.slug] || []} />
          ))}
          {!loading && !branches.length ? (
            <p className="lq-picker-empty">No branches listed yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function BranchSiteCard({ branch, index, hours = [] }) {
  const comingSoon = Boolean(branch.coming_soon)
  const mapsUrl =
    branch.latitude != null && branch.longitude != null
      ? `https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`
      : null
  const summary = hours.length ? formatHoursSummary(hours) : null
  const badge = comingSoon ? 'Coming soon' : hours.length ? openNowLabel(hours) : 'Hours TBD'

  return (
    <article className={`hb-site${comingSoon ? ' is-soon' : ''}`} style={{ '--i': index }}>
      <div className="hb-site-shell">
        <div className="hb-site-core">
          <div className="hb-site-visual">
            <img src="/branding/hakum-mark-ow.png" alt="" className="hb-site-mark" width={44} height={44} />
            <span className="hb-site-badge">{badge}</span>
          </div>
          <div className="hb-site-body">
            <p className="hb-site-kicker">Hakum Auto Care</p>
            <h2 className="hb-site-title">{branch.name}</h2>
            <p className="hb-site-address">{branch.address || 'Address coming soon'}</p>
            <p className="hb-site-hours">
              {comingSoon
                ? 'Opening soon — ask us for updates'
                : summary || 'Queue times vary by branch load'}
            </p>
            <div className="hb-site-actions">
              {comingSoon ? (
                <Link className="hb-btn hb-btn-primary" to="/contact">
                  Ask about opening
                  <span className="hb-btn-arrow" aria-hidden>
                    ↗
                  </span>
                </Link>
              ) : (
                <>
                  <Link className="hb-btn hb-btn-primary" to="/book">
                    Book this branch
                    <span className="hb-btn-arrow" aria-hidden>
                      ↗
                    </span>
                  </Link>
                  <Link className="hb-btn hb-btn-ghost" to={`/queue/${branch.slug}`}>
                    Live queue
                  </Link>
                </>
              )}
              {mapsUrl ? (
                <a className="hb-text-link" href={mapsUrl} target="_blank" rel="noreferrer">
                  Open map
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function PageHero({eyebrow,title,copy,children}){return <><section className="inner-hero"><div className="public-shell"><p className="eyebrow eyebrow-light">{eyebrow}</p><h1 className="display-title">{title}</h1><p className="inner-hero-copy">{copy}</p></div></section>{children}</>}
