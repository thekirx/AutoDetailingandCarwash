import { useCallback, useState } from 'react'
import { ArrowRight, Check, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ceramicPackages, ceramicSection, mediaGallery, nanoCeramicTint, ppfInformation } from '../../../data/publicHomeContent'
import PpfInstallSequence from './PpfInstallSequence'
import { buildCeramicPackageCards } from '../../../lib/homepageContent'
import { getPpfCaptionKey } from '../../../lib/ppfScrollStory'

const ceramicCards = buildCeramicPackageCards(ceramicPackages)

const cinematicLines = (text) => text.split('\n').map((line) => <span key={line}>{line}</span>)

export function CeramicSection() {
  /* One panel open at a time: the detail sheet covers its own photo, so two open
     at once would just be two walls of text competing on the same row. */
  const [openPackage, setOpenPackage] = useState(null)

  return (
    <section id="ceramic" className="coating-section" data-motion-section="ceramic">
      <div className="public-shell ceramic-layout">
        <div className="ceramic-intro" data-motion="heading">
          <p>{ceramicSection.eyebrow}</p>
          <h2>{ceramicSection.title.split(' ').map((word) => <span key={word}>{word}</span>)}</h2>
          <div>{ceramicSection.copy}</div>
        </div>
        <div className="ceramic-package-grid" data-motion="cards">
          {ceramicCards.map((item) => {
            const open = openPackage === item.id
            return (
              <article
                className="ceramic-package-panel"
                key={item.id}
                data-motion-item
                data-open={open ? 'true' : 'false'}
              >
                <img src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
                <div className="ceramic-package-overlay" aria-hidden="true" />
                <div className="ceramic-package-body">
                  <h3 className="ceramic-package-name">{item.title}</h3>
                  <div className="ceramic-package-content">
                    <div className="ceramic-package-warranty">
                      <Check size={16} strokeWidth={3} aria-hidden="true" />
                      <strong>{item.warrantyYears}</strong>
                      <span>Year<br />warranty</span>
                    </div>
                    <p className="ceramic-package-pitch">{item.pitch}</p>
                    <div className="ceramic-package-actions">
                      <button
                        type="button"
                        className="ceramic-package-more"
                        aria-expanded={open}
                        aria-controls={item.detailsId}
                        onClick={() => setOpenPackage(open ? null : item.id)}
                      >
                        <Plus size={15} aria-hidden="true" />
                        Know more
                      </button>
                      <Link
                        className="ceramic-package-book"
                        to="/book"
                        state={item.bookingState}
                        aria-label={item.ctaLabel}
                      >
                        Book now <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="ceramic-package-details" id={item.detailsId} hidden={!open}>
                  <div className="ceramic-package-details-inner">
                    <p className="ceramic-package-details-title">{item.title} ceramic coating</p>
                    <p>{item.copy}</p>
                    <div className="ceramic-package-inclusions">
                      <strong>Inclusions:</strong>
                      <ul>{item.includes.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                    </div>
                    <Link className="ceramic-package-book" to="/book" state={item.bookingState}>
                      Book now <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="ceramic-package-close"
                    onClick={() => setOpenPackage(null)}
                    aria-label={`Close ${item.title} details`}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SplitFeature({ id, eyebrow, item, reverse = false }) {
  return (
    <section id={id} className={`home-split-feature${reverse ? ' is-reverse' : ''}`} data-motion-section={id}>
      <div className="public-shell home-split-grid">
        <div className="home-split-media" data-motion="media">
          <img src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
        </div>
        <div className="home-split-copy" data-motion="copy">
          <p className="eyebrow eyebrow-light">{eyebrow}</p>
          <h2 className="section-title light">{item.title}</h2>
          <p>{item.copy}</p>
        </div>
      </div>
    </section>
  )
}

export function PpfInformationSection() {
  const [captionKey, setCaptionKey] = useState('introduction')

  const handleProgress = useCallback((progress) => {
    setCaptionKey(getPpfCaptionKey(progress, ppfInformation))
  }, [])

  return (
    <section
      id="ppf-information"
      className="ppf-information-stage"
      data-motion-section="ppf-information"
      data-ppf-stage
    >
      <div className="ppf-information-pin" data-ppf-pin>
        <PpfInstallSequence onProgress={handleProgress} />
        <div className="ppf-information-scrim" aria-hidden="true" />

        <div
          className="public-shell ppf-information-heading"
          data-active={captionKey === 'introduction' ? 'true' : 'false'}
        >
          <p>{ppfInformation.eyebrow}</p>
          <h2>{cinematicLines(ppfInformation.title)}</h2>
          <span>{ppfInformation.copy}</span>
        </div>

        <div className="public-shell ppf-information-chapters">
          {ppfInformation.chapters.map((chapter, index) => (
            <article
              className="ppf-information-chapter"
              key={chapter.label}
              data-active={captionKey === index ? 'true' : 'false'}
            >
              <div className="ppf-information-chapter-meta">
                <span aria-hidden="true">{chapter.number}</span>
                <strong>{chapter.label}</strong>
              </div>
              <h3>{cinematicLines(chapter.heading)}</h3>
              <p>{chapter.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function NanoCeramicTintSection() {
  return <SplitFeature id="nano-ceramic-tint" eyebrow="Nano ceramic tint" item={nanoCeramicTint} reverse />
}

export function MediaGallerySection() {
  return (
    <section id="media-gallery" className="home-media-section" data-motion-section="media-gallery">
      <div className="public-shell home-media-heading">
        <div data-motion="heading">
          <p className="eyebrow eyebrow-light">Inside Hakum</p>
          <h2 className="section-title light">Photos.</h2>
        </div>
        <p>See the finish, process, and precision behind the work our teams deliver every day.</p>
      </div>
      <div className="home-media-grid" data-motion="cards">
        {mediaGallery.map((item, index) => (
          <figure key={item.title} className={index === 0 ? 'is-featured' : ''} data-motion-item>
            <img src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
            <figcaption><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
