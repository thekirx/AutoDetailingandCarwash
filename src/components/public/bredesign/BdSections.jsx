import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

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
          {/* Drafted from existing positioning, not supplied copy. */}
          <p className="bd-draft-note">Draft copy — pending sign-off</p>
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

export function BdWhySections() {
  return (
    <>
      {WHY_SECTIONS.map((section) => (
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
  return (
    <section className="bd-photos" id="photos">
      <div className="bd-shell">
        <div className="bd-head bd-reveal">
          <div>
            <p className="bd-eyebrow">Inside Hakum</p>
            <h2 className="bd-skew">Photos.</h2>
          </div>
          <p>
            Our own bays, our own cars, our own work — see the finish, the process, and the precision
            behind what our teams deliver every day.
          </p>
        </div>
        <div className="bd-mosaic bd-reveal">
          {PHOTOS.map((photo) => (
            <figure className={photo.span ? `bd-${photo.span}` : undefined} key={photo.caption}>
              <img src={photo.src} alt={photo.alt} loading="lazy" />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
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
