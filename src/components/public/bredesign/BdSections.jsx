import { useCallback, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SERVICE_DETAIL_CONTENT } from '../../../data/serviceDetailContent'
import BdVideoModal from './BdVideoModal'
import { LoopArrows, LoopBar } from './LoopRail'
import { loopSlides, useLoopRail } from './useLoopRail'
import WhyIcon from './WhyIcon'
import { GALLERY_EXTRA_CLIPS, GALLERY_PAGES, ORIGIN, SERVICES, WHY_SECTIONS } from './content'

/* A lede is written as an array so a phrase inside it can be emphasised
   without embedding markup in content. */
function Lede({ parts }) {
  return (
    <p className="bd-why-lede">
      {parts.map((part, i) =>
        typeof part === 'string' ? part : <strong key={i}>{part.strong}</strong>,
      )}
    </p>
  )
}

/* On phone the storefront photo comes first and the story follows on navy. On
   desktop the section is white: the story comes first and the storefront crop
   closes it (the order is set in bredesign.css). */
export function BdOrigin() {
  return (
    <section className="bd-origin" id="origin">
      <div className="bd-origin-frame">
        {/* Keep this media query in step with the 640px container query in
            bredesign.css: phone keeps the full poster, desktop the crop. */}
        <picture className="bd-origin-picture">
          <source media="(min-width: 641px)" srcSet={ORIGIN.imageWide} />
          <img className="bd-origin-photo" src={ORIGIN.image} alt={ORIGIN.imageAlt} loading="lazy" decoding="async" />
        </picture>
        <div className="bd-origin-copy bd-reveal">
          <p className="bd-eyebrow bd-origin-eyebrow">{ORIGIN.eyebrow}</p>
          <h2>
            {ORIGIN.headline.join(' ')} <em>{ORIGIN.headlineAccent}</em>
          </h2>
          <p className="bd-origin-text bd-origin-lead">{ORIGIN.paragraphs.join(' ')}</p>
        </div>
      </div>
    </section>
  )
}

function ServiceCardBody({ service }) {
  return (
    <>
      <img src={service.image} alt={service.alt} loading="lazy" />
      <span className="bd-service-num" aria-hidden="true">
        {service.number}
      </span>
      <div className="bd-service-body">
        <h3>{service.title}</h3>
        <p>{service.copy}</p>
        <span className="bd-service-go">
          {service.cta} <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </>
  )
}

export function BdServices() {
  return (
    <section className="bd-services" id="services">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Our services</p>
            <h2 className="bd-skew">
              What we <em>do</em> <span className="bd-services-heading-copy">- four core services. Open any one for the full picture</span>
            </h2>
          </div>
        </div>
        <div className="bd-service-grid bd-reveal">
          {SERVICES.map((service) => (
            <Link className="bd-service" key={service.number} to={service.to}>
              <ServiceCardBody service={service} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BdWhySections({ exclude = [] }) {
  return (
    <>
      {WHY_SECTIONS.filter((s) => !exclude.includes(s.id)).map((section) => (
        <section
          className={`bd-why${section.flip ? ' is-flipped' : ''}`}
          id={section.id}
          key={section.id}
        >
          <div className="bd-shell bd-why-in">
            <figure className="bd-why-fig bd-reveal">
              <img src={section.image} alt={section.alt} loading="lazy" />
            </figure>
            <div className="bd-why-copy bd-reveal">
              <p className="bd-eyebrow">{section.eyebrow}</p>
              <h2>
                {section.headline.map((line, i) => (
                  <span key={line}>
                    {i === section.headline.length - 1 ? <em>{line}</em> : line}
                    {i === section.headline.length - 1 ? null : <br />}
                  </span>
                ))}
              </h2>
              <Lede parts={section.lede} />
              <ul className="bd-why-points">
                {section.points.map(([title, copy, icon]) => (
                  <li key={title}>
                    <WhyIcon name={icon} />
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </li>
                ))}
              </ul>
              <div className="bd-cta-row bd-why-cta">
                <Link className="bd-btn bd-btn-primary" to={section.cta.to}>
                  {section.cta.label}
                </Link>
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

/* Looks a gallery clip up by [service, id]: the service-proof clips carry
   their own service name, the two bundled clips carry theirs in the entry. */
function resolveClip([service, id]) {
  if (service === 'extra') return GALLERY_EXTRA_CLIPS[id]
  const detail = SERVICE_DETAIL_CONTENT[service]
  const found = detail?.proof?.clips.find((item) => item.id === id)
  return found ? { ...found, serviceId: service, serviceName: detail.serviceName } : null
}

/* The collage the homepage has always had, now a page at a time: each page is
   the original arrangement, pages scroll sideways, and past the last page the
   rail carries on to the first. Every photo and video we have is in it once. */
export function BdPhotos() {
  const [activeClip, setActiveClip] = useState(null)
  const closeClip = useCallback(() => setActiveClip(null), [])

  const pages = useMemo(
    () =>
      GALLERY_PAGES.map((page) => ({
        ...page,
        tiles: page.tiles
          .map((tile) => (tile.clip ? { ...tile, clip: resolveClip(tile.clip) } : tile))
          .filter((tile) => tile.photo || tile.clip),
      })),
    [],
  )
  const counts = useMemo(
    () =>
      pages.reduce(
        (total, page) => {
          page.tiles.forEach((tile) => {
            if (tile.clip) total.videos += 1
            else total.photos += 1
          })
          return total
        },
        { photos: 0, videos: 0 },
      ),
    [pages],
  )
  const rail = useLoopRail(pages.length)

  return (
    <section className="bd-photos" id="photos">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Inside Hakum</p>
            <h2 className="bd-skew">Photos &amp; Videos.</h2>
          </div>
          <p>
            Our own bays, our own cars, our own work — watch the process and see the precision behind
            what our teams deliver every day.
          </p>
        </div>
        <div className="bd-gallery-bar">
          <p>
            {counts.photos} photos · {counts.videos} videos
          </p>
          <LoopArrows rail={rail} label="gallery page" />
        </div>

        <div className="bd-gallery-rail" ref={rail.trackRef}>
          {loopSlides(pages, rail.copies).map(({ item: page, copy, key }) => (
            <div
              className={`bd-mosaic bd-gallery-page is-${page.layout}`}
              key={key}
              data-gallery-page={copy ? undefined : ''}
              aria-hidden={copy || undefined}
            >
              {page.tiles.map((tile) => {
                if (tile.photo) {
                  return (
                    <figure className={`bd-slot-${tile.slot}`} key={tile.slot}>
                      <img
                        src={tile.photo.src}
                        alt={copy ? '' : tile.photo.alt}
                        loading="lazy"
                        style={tile.photo.position ? { objectPosition: tile.photo.position } : undefined}
                      />
                      <figcaption>{tile.photo.caption}</figcaption>
                    </figure>
                  )
                }
                const { clip } = tile
                return (
                  <button
                    type="button"
                    className={`bd-gallery-video bd-slot-${tile.slot}`}
                    key={tile.slot}
                    data-gallery-video={copy ? undefined : clip.serviceId}
                    aria-label={copy ? undefined : `Play ${clip.caption}`}
                    tabIndex={copy ? -1 : undefined}
                    onClick={() => setActiveClip(clip)}
                  >
                    <img src={clip.poster} alt="" loading="lazy" />
                    <span className="bd-gallery-video-shade" aria-hidden="true" />
                    <span className="bd-gallery-play" aria-hidden="true">
                      <Play size={22} fill="currentColor" />
                    </span>
                    <span className="bd-gallery-kind">Video</span>
                    <span className="bd-gallery-caption">
                      <strong>{clip.serviceName}</strong>
                      <span>{clip.caption}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <LoopBar rail={rail} />
      </div>
      <BdVideoModal clip={activeClip} onClose={closeClip} />
    </section>
  )
}

export function BdBook() {
  return (
    <section className="bd-book" id="book">
      <div className="bd-shell bd-book-in">
        <div className="bd-reveal">
          <p className="bd-eyebrow bd-eyebrow-light">Pamper &amp; protect</p>
          <h2 className="bd-skew">
            <span>Pamper it.</span>
            <span className="bd-book-outline">Protect it.</span>
            <span>Book your car in.</span>
          </h2>
          <p>
            Tell us the vehicle and how you drive it. We will tell you honestly which of the four it
            actually needs.
          </p>
        </div>
        <div className="bd-cta-row bd-reveal">
          <Link className="bd-btn bd-btn-light" to="/book">
            Book a service <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link className="bd-btn bd-btn-quiet" to="/services">
            Compare services
          </Link>
        </div>
      </div>
    </section>
  )
}
