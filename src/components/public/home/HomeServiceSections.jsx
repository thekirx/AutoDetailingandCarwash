import { ceramicPackages, ceramicSection, mediaGallery, nanoCeramicTint, ppfInformation } from '../../../data/publicHomeContent'

export function CeramicSection() {
  return (
    <section id="ceramic" className="coating-section" data-motion-section="ceramic">
      <div className="public-shell ceramic-layout">
        <div className="ceramic-intro" data-motion="heading">
          <p>{ceramicSection.eyebrow}</p>
          <h2>{ceramicSection.title.split(' ').map((word) => <span key={word}>{word}</span>)}</h2>
          <div>{ceramicSection.copy}</div>
        </div>
        <div className="ceramic-package-grid" data-motion="cards">
          {ceramicPackages.map((item) => (
            <article className="ceramic-package-panel" key={item.title} data-motion-item>
              <img src={item.bgImage} alt={`${item.title} ceramic coating package`} loading="lazy" decoding="async" />
              <div className="ceramic-package-overlay" aria-hidden="true" />
              <div className="ceramic-package-body">
                <h3 className="ceramic-package-name">{item.title}</h3>
                <div className="ceramic-package-content">
                  <p>{item.copy}</p>
                  <div className="ceramic-package-inclusions">
                    <strong>Inclusions:</strong>
                    <ul>{item.includes.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  </div>
                </div>
              </div>
            </article>
          ))}
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
  return (
    <section id="ppf-information" className="ppf-information-stage" data-motion-section="ppf-information">
      <div className="public-shell ppf-information-heading" data-motion="heading">
        <p>Superior protection, edge to edge</p>
        <h2>{ppfInformation.title}</h2>
        <span>{ppfInformation.copy}</span>
      </div>
      <div className="public-shell ppf-information-features" data-motion="cards">
        {ppfInformation.features.map((feature, index) => (
          <article className="ppf-information-callout" key={feature.title} data-motion-item>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
          </article>
        ))}
      </div>
      <div className="ppf-information-visual" data-motion="media">
        <img src={ppfInformation.image} alt={ppfInformation.imageAlt} loading="lazy" decoding="async" />
        <div className="ppf-information-film" aria-hidden="true" />
        <div className="ppf-information-linework" aria-hidden="true"><i /><i /><i /><i /></div>
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
          <h2 className="section-title light">Videos &amp; photos.</h2>
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
