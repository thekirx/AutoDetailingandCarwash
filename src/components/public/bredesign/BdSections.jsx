import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Play, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SERVICE_DETAIL_CONTENT } from '../../../data/serviceDetailContent'
import { ORIGIN, PHOTOS, SERVICES, WHY_SECTIONS } from './content'

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

export function BdOrigin() {
  return (
    <section className="bd-origin" id="origin">
      <div className="bd-shell bd-origin-in">
        <div className="bd-reveal">
          <p className="bd-eyebrow">{ORIGIN.eyebrow}</p>
          <h2>
            {ORIGIN.headline.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
            <em>{ORIGIN.headlineAccent}</em>
          </h2>
          {ORIGIN.paragraphs.map((copy, i) => (
            <p className={i === 0 ? 'bd-origin-lead' : 'bd-origin-body'} key={copy.slice(0, 24)}>
              {copy}
            </p>
          ))}
          <div className="bd-cta-row bd-origin-cta">
            <Link className="bd-btn bd-btn-quiet" to="/services">
              What we do
            </Link>
          </div>
        </div>
        <figure className="bd-origin-fig bd-reveal">
          <img src={ORIGIN.image} alt={ORIGIN.imageAlt} loading="lazy" />
          <figcaption>
            <strong>{ORIGIN.tagTitle}</strong>
            <span>{ORIGIN.tagLine}</span>
          </figcaption>
        </figure>
      </div>
    </section>
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
              What we <em>do.</em>
            </h2>
          </div>
          <p>
            Four core services. Open any one for the full picture — what it is, what we use, and what
            it costs you to skip it.
          </p>
        </div>
        <div className="bd-service-grid bd-reveal">
          {SERVICES.map((service) => {
            const Card = service.to ? Link : 'a'
            const linkProps = service.to ? { to: service.to } : { href: service.href }
            return (
              <Card className="bd-service" key={service.number} {...linkProps}>
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
              </Card>
            )
          })}
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
                {section.points.map(([title, copy]) => (
                  <li key={title}>
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

export function BdPhotos() {
  const [activeClip, setActiveClip] = useState(null)
  const featuredClips = Object.entries(SERVICE_DETAIL_CONTENT).flatMap(([serviceId, service]) =>
    service.proof.clips
      .filter((clip) => clip.homepageFeatured)
      .map((clip) => ({ ...clip, serviceId, serviceName: service.serviceName })),
  )
  const galleryItems = [
    { type: 'photo', ...PHOTOS[0] },
    { type: 'photo', ...PHOTOS[1] },
    { type: 'video', clip: featuredClips[1], span: 'tall', portrait: true },
    { type: 'video', clip: featuredClips[0] },
    { type: 'photo', ...PHOTOS[2] },
    { type: 'photo', ...PHOTOS[3] },
    { type: 'photo', ...PHOTOS[4], span: undefined },
    { type: 'video', clip: featuredClips[2] },
    { type: 'photo', ...PHOTOS[5] },
  ]

  useEffect(() => {
    if (!activeClip) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActiveClip(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [activeClip])

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
        <div className="bd-mosaic bd-reveal">
          {galleryItems.map((item) => {
            if (item.type === 'photo') {
              return (
                <figure className={item.span ? `bd-${item.span}` : undefined} key={item.caption}>
                  <img src={item.src} alt={item.alt} loading="lazy" />
                  <figcaption>{item.caption}</figcaption>
                </figure>
              )
            }

            const { clip } = item
            const layoutClasses = [
              item.span ? `bd-${item.span}` : '',
              item.portrait ? 'bd-portrait' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                type="button"
                className={`bd-gallery-video${layoutClasses ? ` ${layoutClasses}` : ''}`}
                key={`${clip.serviceId}-${clip.id}`}
                data-gallery-video={clip.serviceId}
                aria-label={`Play ${clip.caption}`}
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
      </div>
      {activeClip ? (
        <div
          className="bd-gallery-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeClip.serviceName} video`}
          data-gallery-player
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveClip(null)
          }}
        >
          <div className="bd-gallery-player">
            <button
              type="button"
              className="bd-gallery-close"
              data-gallery-close
              aria-label="Close video"
              onClick={() => setActiveClip(null)}
              autoFocus
            >
              <X size={22} aria-hidden="true" />
            </button>
            <video
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={activeClip.poster}
              aria-label={activeClip.label}
            >
              <source src={activeClip.sources.av1} type='video/mp4; codecs="av01.0.08M.08"' />
              <source src={activeClip.sources.h264} type="video/mp4" />
            </video>
            <div className="bd-gallery-player-copy">
              <span>{activeClip.serviceName}</span>
              <strong>{activeClip.caption}</strong>
            </div>
          </div>
        </div>
      ) : null}
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
            Book your
            <br />
            car in.
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
