import { lazy, Suspense } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CeramicSection } from '../components/public/home/HomeServiceSections'

const PPFVisualizer = lazy(() => import('../components/PPFVisualizer'))
import { usePublicBranches, branchLabel } from '../lib/branches'
import { usePageMeta } from '../lib/pageMeta'

// Photos are looked up by filename so a card without artwork simply falls back to the icon.
const serviceImages = import.meta.glob('../assets/services/*.{webp,jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})
// Accepts one filename or a preference list; the first file present wins.
const serviceImage = (files) =>
  [files].flat().reduce((hit, file) => hit ?? serviceImages[`../assets/services/${file}`], undefined)

const serviceItems = [
  ['Premium car wash','A careful exterior clean, wheel treatment, and hand finish for a crisp everyday reset.','carwash.webp'],
  ['Interior deep clean','Extraction, steam, detail brushing, and conditioning for a cabin that feels renewed.','interior-detailing.webp'],
  ['Paint correction','Multi-stage refinement to reduce swirls, haze, and defects while restoring deep gloss.','paint-correction.webp'],
  ['Ceramic coating','Durable hydrophobic protection with richer color, easier upkeep, and serious shine.',['ceramic.webp','ceramic.jpg','ceramic.jpeg','ceramic.png','ceramic-coating.webp']],
  ['Paint protection film','Virtually invisible impact protection, precisely installed around every edge and contour.','paint-protection-film.webp'],
  ['Maintenance detailing','A tailored care plan that preserves your finish between major detailing sessions.','detailing.webp'],
]

export function ServicesPage() {
  return (
    <PageHero
      eyebrow="Our services · Marketing overview"
      title={
        <>
          Precision in
          <br />
          <i>every pass.</i>
        </>
      }
      copy="Every vehicle receives a considered process, premium workmanship, and the same care we give our own. Live menu and pricing appear when you book."
    >
      <section className="content-section">
        <p className="public-shell mb-6 text-sm text-slate-500">
          This page is a marketing overview — not the live catalog. Book to see current services from Hakum.
        </p>
        <div className="public-shell numbered-grid">
          {serviceItems.map(([name, copy, file], i) => {
            const image = serviceImage(file)
            return (
              <article key={name} className={image ? 'has-photo' : undefined}>
                <span>0{i + 1}</span>
                {image ? (
                  <img src={image} alt={`${name} at Hakum Auto Care`} loading="lazy" decoding="async" />
                ) : (
                  <Sparkles />
                )}
                <h2>{name}</h2>
                <p>{copy}</p>
                <Link to="/book">
                  Book this service <ArrowRight />
                </Link>
              </article>
            )
          })}
        </div>
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
        copy="Long-term ceramic gloss and precision-fit PPF, built around how much protection your vehicle needs. Confirm availability and pricing when you book."
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
  usePageMeta({
    title: 'Branches',
    description: 'Find Hakum Auto Care branches across Cavite and Batangas. Book a visit or open the live queue.',
    path: '/branches',
  })

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
            <BranchSiteCard key={b.slug} branch={b} index={index} />
          ))}
          {!loading && !branches.length ? (
            <p className="lq-picker-empty">No branches listed yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function BranchSiteCard({ branch, index }) {
  const comingSoon = Boolean(branch.coming_soon)
  const mapsUrl =
    branch.latitude != null && branch.longitude != null
      ? `https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`
      : null

  return (
    <article className={`hb-site${comingSoon ? ' is-soon' : ''}`} style={{ '--i': index }}>
      <div className="hb-site-shell">
        <div className="hb-site-core">
          <div className="hb-site-visual">
            <img src="/branding/hakum-mark-ow.png" alt="" className="hb-site-mark" width={44} height={44} />
            <span className="hb-site-badge">{comingSoon ? 'Coming soon' : 'Open daily'}</span>
          </div>
          <div className="hb-site-body">
            <p className="hb-site-kicker">Hakum Auto Care</p>
            <h2 className="hb-site-title">{branch.name}</h2>
            <p className="hb-site-address">{branch.address || 'Address coming soon'}</p>
            <p className="hb-site-hours">
              {comingSoon ? 'Opening soon - ask us for updates' : 'Queue times vary by branch load'}
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
