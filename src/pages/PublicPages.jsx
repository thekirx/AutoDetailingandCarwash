import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicBranches, branchCityName, branchLabel, fetchPublicBranchHours } from '../lib/branches'
import { MAIN_LINE, branchDirections, branchPhone, buildHomeBranchCards } from '../lib/homeBranches'
import { formatHoursSummary, openNowLabel } from '../lib/branchOperatingHours'
import { SERVICES, WASH_SERVICES } from '../components/public/bredesign/content'
import { useLoopRail, loopSlides } from '../components/public/bredesign/useLoopRail'
import { LoopArrows, LoopBar, LoopStage } from '../components/public/bredesign/LoopRail'
import { formatStartingPrice, useStartingPrices, WASH_CARD_SERVICE_SLUG } from '../lib/serviceStartingPrices'
import { buildLocalBusinessJsonLd, usePageMeta } from '../lib/pageMeta'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import { ContactChannels, ContactCollab, ContactSocials } from './ContactPage'
import useReveal from '../components/public/bredesign/useReveal'


const FALLBACK_VISIBLE_BRANCHES = buildHomeBranchCards([]).map((branch) => ({
  ...branch,
  coming_soon: branch.isComingSoon,
  is_active: !branch.isComingSoon,
}))

/* /services: the three protection services first (each opening its own page),
   then every wash & detailing service by name. The home page's "Premium Wash &
   Detailing" card is left out here: it only groups the wash services, which are
   all listed individually, so it would repeat them. One two-row carousel: each
   column holds a card on top and one below, and the arrows slide both rows. */
const SERVICE_ITEMS = [
  ...SERVICES.filter((item) => item.to !== '/services/wash-detailing').map((item) => ({
    ...item,
    key: item.to,
    kind: 'main',
    available: true,
  })),
  ...WASH_SERVICES.map((item) => ({ ...item, key: item.id, kind: 'wash' })),
]

const SERVICE_COLUMNS = SERVICE_ITEMS.reduce((columns, item, index) => {
  if (index % 2 === 0) columns.push([])
  columns[columns.length - 1].push({ ...item, number: String(index + 1).padStart(2, '0') })
  return columns
}, [])

/* Every card has the same shape so the two rows line up: number, then the
   name at the top; the copy, the price and the buttons at the foot, each on a
   fixed line. A service with no published price holds the price line with a
   placeholder. Only the protection services (PPF, ceramic coating, tint) can
   be booked ahead; every wash & detailing service is walk-in, so those cards
   point at the live queue instead. */
function ServiceRailCard({ item, price, hidden }) {
  const tab = hidden ? -1 : undefined
  const className = `bd-card is-static${item.image ? '' : ' is-plain'}${item.available ? '' : ' is-soon'}`
  let actions = <span className="bd-card-go">Coming soon</span>
  if (item.kind === 'main') {
    actions = (
      <>
        <Link className="bd-btn bd-btn-primary" to="/book" tabIndex={tab}>
          Book this service
        </Link>
        <Link className="bd-btn bd-btn-quiet" to={item.to} tabIndex={tab}>
          Explore this service
        </Link>
      </>
    )
  } else if (item.available) {
    actions = (
      <Link className="bd-btn bd-btn-quiet" to="/queue" tabIndex={tab}>
        View live queue
      </Link>
    )
  }

  return (
    <div className={className}>
      {item.image ? <img src={item.image} alt={hidden ? '' : item.alt} loading="lazy" decoding="async" /> : null}
      <div className="bd-card-top">
        <span className="bd-card-num" aria-hidden="true">{item.number}</span>
        <h2>{item.title}</h2>
      </div>
      {item.available ? null : <span className="bd-services-soon">Coming soon</span>}
      <div className="bd-card-body">
        <p>{item.copy}</p>
        <p className={`bd-services-price${price ? '' : ' is-tbd'}`}>
          <span>Starts at</span> {price ? formatStartingPrice(price) : <b>Price to follow</b>}
        </p>
        <div className="bd-card-actions">{actions}</div>
      </div>
    </div>
  )
}

export function ServicesPage() {
  const rail = useLoopRail(SERVICE_COLUMNS.length)
  const prices = useStartingPrices()

  usePageMeta({
    title: 'Services',
    description:
      'Paint protection film, ceramic coating, nano ceramic tint, and every Hakum wash and detailing service in one place.',
    path: '/services',
  })

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
        copy="Paint protection, coating and tint first, then every wash and detailing service we run at the bay."
      />
      <section id="catalog" aria-labelledby="catalog-title">
        <div className="bd-shell">
          <div className="bd-services-head">
            <div>
              <p className="bd-eyebrow">All services</p>
              <h2 id="catalog-title">Choose the care your car needs.</h2>
            </div>
            <LoopArrows rail={rail} label="services" />
          </div>
          <LoopStage rail={rail}>
          <div className="bd-services-rail" ref={rail.trackRef} data-looping="true" role="region" aria-label="Services">
            {loopSlides(SERVICE_COLUMNS, rail.copies).map(({ item: column, copy, key }) => (
              <div className="bd-services-col" key={key} aria-hidden={copy || undefined}>
                {column.map((item) => (
                  <ServiceRailCard
                    key={item.key}
                    item={item}
                    hidden={copy}
                    price={item.kind === 'wash' ? prices[WASH_CARD_SERVICE_SLUG[item.id]] : null}
                  />
                ))}
              </div>
            ))}
          </div>
          </LoopStage>
          <LoopBar rail={rail} />
        </div>
      </section>
    </>
  )
}

export function BranchesPage() {
  const { branches, loading, error } = usePublicBranches({ mode: 'visible' })
  const [hoursBySlug, setHoursBySlug] = useState({})
  const visibleBranches = branches.length ? branches : FALLBACK_VISIBLE_BRANCHES

  // Branch nodes carry their own phone, landmark address and real opening
  // hours, so the map/local results read the same facts the card shows.
  const branchJsonLd = useMemo(
    () =>
      buildLocalBusinessJsonLd({
        branches: visibleBranches.map((b) => ({
          ...b,
          phone: branchPhone(b.slug)?.display?.replace(/\s+/g, ''),
        })),
        hoursBySlug,
      }),
    [visibleBranches, hoursBySlug],
  )

  usePageMeta({
    title: 'Branches',
    description:
      'Find Hakum Auto Care branches in Bacoor and Batangas. Get directions, call, or open the live queue.',
    path: '/branches',
    jsonLd: branchJsonLd,
    jsonLdId: 'hakum-branches',
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
          <Link className="bd-btn bd-btn-primary" to="/queue">
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

      {/* Contact left the navigation, so its details live here, next to the
          branches customers are trying to reach. */}
      <section className="contact-page bd-branch-contact" id="contact" aria-labelledby="branch-contact-title">
        <div className="public-shell bd-branch-contact-head">
          <p className="bd-eyebrow">Talk to Hakum</p>
          <h2 id="branch-contact-title">
            Contact <em>us.</em>
          </h2>
          <p className="contact-lede">Call the branch you are visiting, or reach the main team below.</p>
        </div>
        <ContactChannels />
        <ContactCollab />
        <div className="public-shell contact-split">
          <ContactSocials />
        </div>
      </section>
    </>
  )
}

function GoogleMapsMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#EA4335" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" />
      <circle cx="12" cy="9" r="2.6" fill="#fff" />
    </svg>
  )
}

function WazeMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#33CCFF" d="M12 3C7 3 3.5 6.3 3.5 10.6c0 1.9.7 3.3 1.6 4.3-.4 1.3-1.3 2.2-2.1 2.6 1.6.6 3.5.3 4.6-.4 1.3.6 2.8.9 4.4.9 5 0 8.5-3.3 8.5-7.4S17 3 12 3Z" />
      <circle cx="9" cy="10" r="1.1" fill="#fff" />
      <circle cx="15" cy="10" r="1.1" fill="#fff" />
      <circle cx="8" cy="20" r="1.8" fill="#fff" stroke="#33CCFF" strokeWidth="1.4" />
      <circle cx="16" cy="20" r="1.8" fill="#fff" stroke="#33CCFF" strokeWidth="1.4" />
    </svg>
  )
}

function BranchSiteCard({ branch, hours = [] }) {
  const comingSoon = Boolean(branch.coming_soon)
  // Both links hand off to the installed app on a phone.
  const directions = comingSoon ? null : branchDirections(branch)
  const summary = hours.length ? formatHoursSummary(hours) : null
  // openNowLabel reads the live hours, so the badge is a fact rather than a
  // static label; a branch with no hours on file says so instead of guessing.
  const badge = comingSoon ? 'Coming soon' : hours.length ? openNowLabel(hours) : 'Hours to be confirmed'
  const tone = comingSoon ? 'soon' : hours.length && /open/i.test(badge) ? 'open' : 'shut'
  const ownPhone = branchPhone(branch.slug)
  const phone = ownPhone || MAIN_LINE

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
        {/* The street addresses are still landmarks ("RFC Molino", "PNP
            Batangas") pending the owner's real ones — Unresolved decision #9.
            Printing "Address coming soon" on the page that ranks for local
            searches reads as a broken shop, so the row is simply absent when
            there is nothing to print; the directions buttons below carry it. */}
        {branch.address ? (
          <>
            <dt>Address</dt>
            <dd>{branch.address}</dd>
          </>
        ) : null}
        <dt>Hours</dt>
        <dd>
          {comingSoon ? 'Opening soon — ask us for updates' : summary || 'Queue times vary by branch load'}
        </dd>
        <dt>Phone</dt>
        <dd>
          {comingSoon ? (
            'Coming soon'
          ) : (
            <>
              <a className="bd-site-tel" href={phone.href}>
                {phone.display}
              </a>
              {ownPhone ? null : <span className="bd-site-tel-note"> · main line</span>}
            </>
          )}
        </dd>
      </dl>

      <div className="bd-site-actions">
        {comingSoon ? (
          <Link className="bd-btn bd-btn-primary" to="/contact">
            Ask about opening
          </Link>
        ) : (
          <>
            <a className="bd-btn bd-btn-primary" href={phone.href}>
              Call branch
            </a>
            <Link className="bd-btn bd-btn-quiet" to={`/queue/${branch.slug}`}>
              Live queue
            </Link>
          </>
        )}
      </div>

      {directions ? (
        <div className="bd-site-directions">
          <p>Get directions</p>
          <div>
            <a className="bd-map-btn" href={directions.google} target="_blank" rel="noreferrer noopener">
              <GoogleMapsMark />
              Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a className="bd-map-btn" href={directions.waze} target="_blank" rel="noreferrer noopener">
              <WazeMark />
              Waze
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      ) : null}
    </article>
  )
}
