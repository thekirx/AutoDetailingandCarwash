import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePublicBranches, branchCityName, branchLabel, fetchPublicBranchHours } from '../lib/branches'
import { buildHomeBranchCards } from '../lib/homeBranches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import {
  buildPublicServiceOverview,
  fetchPublicCatalogServices,
  marketingKeyForServiceSlug,
  publicServiceDestination,
} from '../lib/publicCatalog'
import { usePageMeta } from '../lib/pageMeta'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'

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
  'ceramic-coating': 'ceramic.webp',
  'ceramic-tint': 'ceramic-tint.webp',
  'paint-protection-film': 'paint-protection-film.webp',
  detailing: 'detailing.webp',
  'glass-detailing': 'glass-detailing.webp',
  'engine-wash': 'engine-wash.webp',
}

const photoForService = (slug) => serviceImage(SERVICE_PHOTOS[marketingKeyForServiceSlug(slug)] || [])

const FALLBACK_VISIBLE_BRANCHES = buildHomeBranchCards([]).map((branch) => ({
  ...branch,
  coming_soon: branch.isComingSoon,
  is_active: !branch.isComingSoon,
}))

export function ServicesPage() {
  const [serviceItems, setServiceItems] = useState(() => buildPublicServiceOverview([]))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  usePageMeta({
    title: 'Services',
    description:
      'Every service Hakum Auto Care offers, straight from the live catalog — the same menu you see when you book at the bay.',
    path: '/services',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetchPublicCatalogServices()
      .then((rows) => {
        if (cancelled) return
        setServiceItems(buildPublicServiceOverview(rows))
      })
      .catch(() => {
        if (cancelled) return
        // Marketing pages keep their approved catalog when the live inventory
        // is temporarily unreachable. Booking still validates against live data.
        setLoadError('')
        setServiceItems(buildPublicServiceOverview([]))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useReveal()

  return (
    <>
      <BdPageHero
        eyebrow="Our services"
        title={
          <>
            Precision in
            <br />
            <em>every pass.</em>
          </>
        }
        copy="Every service we run, read straight from the live catalog — the same menu you see when you book, and when you check out at the bay."
      />
      <section id="catalog">
        <div className="bd-shell">
          <p className="bd-catalog-note">
            Names and order come from the live catalog. Where a service has a written description it is
            shown; otherwise the inventory description is used.
          </p>

          {loadError ? (
            <p className="bd-state is-error" role="alert">
              {loadError}
            </p>
          ) : null}

          {loading && !serviceItems.length ? (
            <p className="bd-state">Loading services…</p>
          ) : (
            <div className="bd-catalog bd-reveal">
              {serviceItems.map((item, i) => {
                const image = photoForService(item.slug)
                const destination = publicServiceDestination(item)
                const actionLabel = destination.to === '/queue'
                  ? 'View live queue'
                  : destination.to.startsWith('/services/')
                    ? 'Explore this service'
                    : 'Book this service'
                return (
                  <Link
                    className={`bd-card${image ? '' : ' is-plain'}`}
                    key={item.id || item.slug}
                    to={destination.to}
                    state={destination.state}
                  >
                    {image ? (
                      <img src={image} alt={`${item.title} at Hakum Auto Care`} loading="lazy" decoding="async" />
                    ) : null}
                    <span className="bd-card-num" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="bd-card-body">
                      <h2>{item.title}</h2>
                      <p>{item.copy}</p>
                      <span className="bd-card-go">
                        {actionLabel} <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {!loading && !serviceItems.length && !loadError ? (
            <p className="bd-state">No active services are listed yet.</p>
          ) : null}
        </div>
      </section>

    </>
  )
}

export function BranchesPage() {
  const { branches, loading, error } = usePublicBranches({ mode: 'visible' })
  const [hoursBySlug, setHoursBySlug] = useState({})
  const visibleBranches = branches.length ? branches : FALLBACK_VISIBLE_BRANCHES

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

  useReveal()

  return (
    <>
      <BdPageHero
        eyebrow="Find Hakum"
        title={
          <>
            Our branches.
            <br />
            <em>One standard.</em>
          </>
        }
        copy={`Premium care across ${branchLabel(visibleBranches.length)}. Comfortable spaces, and teams who take pride in the details.`}
      >
        <nav className="bd-cta-row bd-page-hero-links" aria-label="Quick links">
          <Link className="bd-btn bd-btn-primary" to="/book">
            Book a service
          </Link>
          <Link className="bd-btn bd-btn-quiet" to="/queue">
            Live queue
          </Link>
        </nav>
      </BdPageHero>

      <section id="locations">
        <div className="bd-shell">
          {error && !visibleBranches.length ? (
            <p className="bd-state is-error" role="alert">
              {error}
            </p>
          ) : null}
          {loading && branches.length ? <p className="bd-state">Loading branches…</p> : null}

          <div className="bd-site-grid bd-reveal">
            {visibleBranches.map((b) => (
              <BranchSiteCard key={b.slug} branch={b} hours={hoursBySlug[b.slug] || []} />
            ))}
          </div>

          {!loading && !visibleBranches.length && !error ? (
            <p className="bd-state">No branches listed yet.</p>
          ) : null}
        </div>
      </section>
    </>
  )
}

function BranchSiteCard({ branch, hours = [] }) {
  const comingSoon = Boolean(branch.coming_soon)
  const mapsUrl =
    branch.latitude != null && branch.longitude != null
      ? `https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`
      : null
  const summary = hours.length ? formatHoursSummary(hours) : null
  // openNowLabel reads the live hours, so the badge is a fact rather than a
  // static label; a branch with no hours on file says so instead of guessing.
  const badge = comingSoon ? 'Coming soon' : hours.length ? openNowLabel(hours) : 'Hours to be confirmed'
  const tone = comingSoon ? 'soon' : hours.length && /open/i.test(badge) ? 'open' : 'shut'

  return (
    <article className="bd-site">
      <div className="bd-site-top">
        <h2>{branchCityName(branch)}</h2>
        <span className={`bd-status bd-status-${tone}`}>
          <i aria-hidden="true" />
          {badge}
        </span>
      </div>

      <dl className="bd-site-facts">
        <dt>Address</dt>
        <dd>{branch.address || 'Address coming soon'}</dd>
        <dt>Hours</dt>
        <dd>
          {comingSoon ? 'Opening soon — ask us for updates' : summary || 'Queue times vary by branch load'}
        </dd>
      </dl>

      <div className="bd-site-actions">
        {comingSoon ? (
          <Link className="bd-btn bd-btn-primary" to="/contact">
            Ask about opening
          </Link>
        ) : (
          <>
            <Link className="bd-btn bd-btn-primary" to="/book">
              Book this branch
            </Link>
            <Link className="bd-btn bd-btn-quiet" to={`/queue/${branch.slug}`}>
              Live queue
            </Link>
          </>
        )}
        {mapsUrl ? (
          <a className="bd-site-map" href={mapsUrl} target="_blank" rel="noreferrer noopener">
            Open in maps <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  )
}
