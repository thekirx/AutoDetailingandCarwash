import { useEffect, useRef } from 'react'

import heroPoster from '../../../assets/hero/bredesign-hero-poster.webp'
import { serviceHeroProgress } from '../../../lib/serviceHeroMotion'

/**
 * The hero for interior marketing pages.
 *
 * Deliberately not the homepage's video hero: the clip is a 2–7 MB entrance
 * that earns its weight once, on the page people land on. Every page after it
 * gets the same composition as a still, so the pages read as one site without
 * paying for the video again on each navigation.
 */
export default function BdPageHero({ eyebrow, title, copy, image = heroPoster, children, scrollAnimated = false }) {
  const heroRef = useRef(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero || !scrollAnimated) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return undefined

    let frame = 0
    const update = () => {
      frame = 0
      const heroTop = hero.getBoundingClientRect().top + window.scrollY
      const progress = serviceHeroProgress(window.scrollY - heroTop, hero.offsetHeight)
      hero.style.setProperty('--bd-page-hero-media-y', `${progress * 56}px`)
      hero.style.setProperty('--bd-page-hero-copy-y', `${progress * -28}px`)
      hero.style.setProperty('--bd-page-hero-copy-opacity', String(1 - progress * 0.62))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.cancelAnimationFrame(frame)
    }
  }, [scrollAnimated])

  return (
    <section ref={heroRef} className={`bd-page-hero${scrollAnimated ? ' is-scroll-animated' : ''}`}>
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
