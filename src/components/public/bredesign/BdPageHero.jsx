import heroPoster from '../../../assets/hero/bredesign-hero-poster.webp'

/**
 * The hero for interior marketing pages.
 *
 * Deliberately not the homepage's video hero: the clip is a 2–7 MB entrance
 * that earns its weight once, on the page people land on. Every page after it
 * gets the same composition as a still, so the pages read as one site without
 * paying for the video again on each navigation.
 */
export default function BdPageHero({ eyebrow, title, copy, image = heroPoster, children }) {
  return (
    <section className="bd-page-hero">
      <img className="bd-page-hero-media" src={image} alt="" />
      <div className="bd-shell bd-page-hero-in">
        {eyebrow ? <p className="bd-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {copy ? <p className="bd-page-hero-copy">{copy}</p> : null}
        {children}
      </div>
    </section>
  )
}
