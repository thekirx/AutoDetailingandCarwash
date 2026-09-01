import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { isHeroLogoMoment } from '../../../lib/homeHero'

import heroPoster from '../../../assets/hero/bredesign-hero-poster.webp'
import heroVideo from '../../../assets/hero/bredesign-hero.mp4'

/* Fixed figures, not live counts. They are a claim about the business rather
   than a reading of the booking table, so they belong in content. */
const STATS = [
  { value: 10, suffix: '+', label: 'Years combined experience' },
  { value: 3000, suffix: '+', label: 'Satisfied clients' },
  { value: 15000, suffix: '+', label: 'Vehicles cared for yearly' },
  { value: 26, suffix: '', label: 'Team members' },
]

function CountUp({ value, suffix }) {
  const [display, setDisplay] = useState(value)
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    // Counting from zero is decoration. If the reader has asked for less
    // motion, or the browser cannot tell us when the number is on screen, the
    // final figure is what shows — never a wrong number.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      return undefined
    }

    let frame = 0
    let started = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return
        started = true
        observer.disconnect()
        const start = performance.now()
        const run = (now) => {
          const t = Math.min(1, (now - start) / 1400)
          const eased = 1 - (1 - t) ** 3
          setDisplay(Math.round(value * eased))
          if (t < 1) frame = requestAnimationFrame(run)
        }
        setDisplay(0)
        frame = requestAnimationFrame(run)
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <span ref={ref} className="bd-stat-value">
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function BdHero({ locationLine }) {
  const [videoFailed, setVideoFailed] = useState(false)
  /* The clip opens and closes on the Hakum mark. The overlay copy clears while
     the mark is on screen so the two never share the frame, and comes back a
     beat after it goes — the same treatment the shipping hero uses. */
  const [logoMoment, setLogoMoment] = useState(true)
  const videoRef = useRef(null)

  useEffect(() => {
    const node = videoRef.current
    if (!node) return undefined

    // Recomputed from the current time on every tick, so a loop restart needs
    // no special case — the new time simply reads as inside the opening window.
    const sync = () => setLogoMoment(isHeroLogoMoment('bredesign', node.currentTime))

    node.addEventListener('timeupdate', sync)
    node.addEventListener('seeked', sync)
    sync()
    return () => {
      node.removeEventListener('timeupdate', sync)
      node.removeEventListener('seeked', sync)
    }
  }, [videoFailed])

  // With no video there is no mark to avoid, so the copy simply shows.
  const copyHidden = !videoFailed && logoMoment

  return (
    <section className="bd-hero" id="top">
      {videoFailed ? (
        <img className="bd-hero-media" src={heroPoster} alt="" />
      ) : (
        <video
          ref={videoRef}
          className="bd-hero-media"
          autoPlay
          muted
          loop
          playsInline
          poster={heroPoster}
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
      )}

      <div
        className={`bd-shell bd-hero-in${copyHidden ? ' is-logo-moment' : ''}`}
        aria-hidden={copyHidden || undefined}
      >
        <p className="bd-eyebrow">{locationLine}</p>
        <h1>
          Give your car
          <br />
          the <em>pampering</em>
          <br />
          it deserves.
        </h1>
        <p className="bd-hero-lede">
          Detailing, protection, and care by a team that treats every panel like it is going back on a
          showroom floor.
        </p>
        <div className="bd-cta-row bd-hero-cta">
          <Link className="bd-btn bd-btn-primary" to="/services">
            See what we do
          </Link>
          <a className="bd-btn bd-btn-quiet" href="#origin">
            Our story
          </a>
        </div>
      </div>

      <div className="bd-stats">
        <div className="bd-shell bd-stats-in">
          {STATS.map((stat) => (
            <div className="bd-stat" key={stat.label}>
              <CountUp value={stat.value} suffix={stat.suffix} />
              <span className="bd-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
