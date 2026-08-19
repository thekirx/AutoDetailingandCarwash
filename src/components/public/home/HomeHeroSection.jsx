import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

import { PrimaryButton, SecondaryButton, StatCard } from '../../ui'
import HeroLiveStatus from './HeroLiveStatus'

const stats = [
  { value: 10, suffix: ' years', label: 'Auto industry experience combined' },
  { value: 3000, suffix: '+', label: 'Growing satisfied clients' },
  { value: 15000, suffix: '+', label: 'Vehicles rejuvenated annually' },
  { value: 26, suffix: '', label: 'Team members' },
]

const HERO_POSTER = '/media/hero/hero-poster.webp'
const HERO_LOOP_DESKTOP = '/media/hero/hakum-hero-loop-1600.mp4'
const HERO_LOOP_MOBILE = '/media/hero/hakum-hero-loop-960.mp4'

/**
 * The hero loop is decoration, not content. It is skipped entirely when the
 * visitor has asked for less motion or is paying for their bytes — in those
 * cases the CSS background image on .hero-media is the whole hero and nothing
 * extra is fetched.
 */
function useHeroLoopSource() {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileQuery = window.matchMedia('(max-width: 800px)')
    const connection = navigator.connection

    const resolve = () => {
      const saveData = connection?.saveData
      const slow = /(^|-)2g$/.test(connection?.effectiveType || '')
      if (motionQuery.matches || saveData || slow) {
        setSrc(null)
        return
      }
      setSrc(mobileQuery.matches ? HERO_LOOP_MOBILE : HERO_LOOP_DESKTOP)
    }

    resolve()
    motionQuery.addEventListener('change', resolve)
    mobileQuery.addEventListener('change', resolve)
    connection?.addEventListener?.('change', resolve)
    return () => {
      motionQuery.removeEventListener('change', resolve)
      mobileQuery.removeEventListener('change', resolve)
      connection?.removeEventListener?.('change', resolve)
    }
  }, [])

  return src
}

function AnimatedNumber({ value, suffix }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    let frame
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      const started = performance.now()
      const run = (time) => {
        const progress = Math.min((time - started) / 1200, 1)
        setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))))
        if (progress < 1) frame = requestAnimationFrame(run)
      }
      frame = requestAnimationFrame(run)
      observer.disconnect()
    }, { threshold: 0.35 })
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

export default function HomeHeroSection({ locationLine, branches = [] }) {
  const loopSrc = useHeroLoopSource()
  const videoRef = useRef(null)

  /* autoPlay covers the common case. This only re-nudges when the element is
     still paused once it has data — swapping src between the mobile and
     desktop cut leaves it paused on some browsers. Calling play() before
     that point races the load and aborts. */
  useEffect(() => {
    const node = videoRef.current
    if (!node || !loopSrc) return

    const nudge = () => {
      if (!node.paused) return
      const play = node.play()
      if (play?.catch) play.catch(() => {})
    }

    node.addEventListener('loadeddata', nudge)
    if (node.readyState >= 2) nudge()
    return () => node.removeEventListener('loadeddata', nudge)
  }, [loopSrc])

  return (
    <section id="hero" className="hero-stage" data-motion-section="hero">
      <div className="hero-media" aria-hidden="true" data-motion="hero-media">
        {loopSrc ? (
          <video
            ref={videoRef}
            className="hero-loop"
            src={loopSrc}
            poster={HERO_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
          />
        ) : null}
      </div>
      <div className="hero-content">
        <p className="hero-location" data-motion="eyebrow">{locationLine}</p>
        <h1 className="display-title" data-motion="heading">
          <span className="hero-line hero-line-one">Give your car</span>
          <span className="hero-line hero-line-three">The pampering it deserves</span>
        </h1>
        <p className="hero-subheading" data-motion="copy">Expert detailing, precision car care, and the shine that turns heads — all in one place.</p>
        <div className="hero-actions" data-motion="actions">
          <PrimaryButton to="/services">Start now</PrimaryButton>
          <SecondaryButton to="/book">Book a service</SecondaryButton>
          <HeroLiveStatus branches={branches} />
        </div>
        <div className="hero-experience" aria-labelledby="experience-heading" data-motion="metrics">
          <h2 id="experience-heading">Experience</h2>
          <div className="hero-metrics" aria-label="Hakum milestones">
            {stats.map((stat) => <StatCard key={stat.label} value={<AnimatedNumber value={stat.value} suffix={stat.suffix} />} label={stat.label} />)}
          </div>
        </div>
      </div>
      <a className="scroll-note" href="#ceramic">Discover <ArrowDown size={15} /></a>
    </section>
  )
}
