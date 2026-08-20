import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

import desktopHeroVideo from '../../../assets/hero/desktop-hero.mp4'
import mobileHeroVideo from '../../../assets/hero/mobile-hero.mp4'
import {
  getHeroVideoVariant,
  hasHeroLogoMomentRestarted,
  HERO_MOBILE_MAX_WIDTH,
  isHeroLogoMoment,
} from '../../../lib/homeHero'
import { PrimaryButton, SecondaryButton, StatCard } from '../../ui'

const stats = [
  { value: 10, suffix: '+', label: 'Years of combined experience' },
  { value: 3000, suffix: '+', label: 'Satisfied clients' },
  { value: 15000, suffix: '+', label: 'Vehicles cared for annually' },
  { value: 26, suffix: '', label: 'Team members' },
]

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

export default function HomeHeroSection({ locationLine }) {
  const [videoVariant, setVideoVariant] = useState(() => getHeroVideoVariant(window.innerWidth))
  const [logoMoment, setLogoMoment] = useState(() => getHeroVideoVariant(window.innerWidth) === 'desktop')
  const [revealOverride, setRevealOverride] = useState(false)
  const [videoBlocked, setVideoBlocked] = useState(false)
  const videoRef = useRef(null)
  const videoTimeRef = useRef(0)
  const videoSrc = videoVariant === 'mobile' ? mobileHeroVideo : desktopHeroVideo

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${HERO_MOBILE_MAX_WIDTH}px)`)
    const updateVariant = () => setVideoVariant(mediaQuery.matches ? 'mobile' : 'desktop')
    mediaQuery.addEventListener('change', updateVariant)
    updateVariant()
    return () => mediaQuery.removeEventListener('change', updateVariant)
  }, [])

  useEffect(() => {
    setLogoMoment(videoVariant === 'desktop')
    setRevealOverride(false)
    setVideoBlocked(false)
    videoTimeRef.current = 0
  }, [videoVariant])

  /* The desktop cut opens on the logo, so the overlay starts hidden and waits
     for playback to clear it. If autoplay is refused the clock never starts,
     which would leave the hero permanently blank — so a refusal reveals the
     content instead of hiding it behind a frozen frame. */
  useEffect(() => {
    const node = videoRef.current
    if (!node) return
    const attempt = node.play()
    if (attempt?.catch) attempt.catch(() => setVideoBlocked(true))
  }, [videoVariant])

  const updateLogoMoment = (event) => {
    const currentTime = event.currentTarget.currentTime
    const nextLogoMoment = isHeroLogoMoment(videoVariant, currentTime)
    const resetOverride = hasHeroLogoMomentRestarted(videoVariant, videoTimeRef.current, currentTime)
    videoTimeRef.current = currentTime
    if (resetOverride) setRevealOverride(false)
    setLogoMoment((current) => current === nextLogoMoment ? current : nextLogoMoment)
  }

  const revealHeroContent = () => {
    if (logoMoment) setRevealOverride(true)
  }

  const hideHeroContent = logoMoment && !revealOverride && !videoBlocked

  return (
    <section
      id="hero"
      className={`hero-stage${hideHeroContent ? ' is-logo-moment' : ''}`}
      data-motion-section="hero"
      onPointerDown={revealHeroContent}
    >
      <div className="hero-media" aria-hidden="true" data-motion="hero-media">
        <video
          key={videoVariant}
          ref={videoRef}
          src={videoSrc}
          data-variant={videoVariant}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onLoadedMetadata={updateLogoMoment}
          onTimeUpdate={updateLogoMoment}
          onError={() => setVideoBlocked(true)}
        />
      </div>
      <div className="hero-content">
        <p className="hero-location" data-motion="eyebrow">{locationLine}</p>
        <h1 className="display-title" data-motion="heading">
          <span className="hero-line hero-line-one">Pamper it.</span>
          <span className="hero-line hero-line-three">Protect it.</span>
        </h1>
        <p className="hero-subheading" data-motion="copy">The Hakum treatment — detailing, protection, and care.</p>
        <div className="hero-actions" data-motion="actions">
          <PrimaryButton to="/services">Start now</PrimaryButton>
          <SecondaryButton to="/book">Book a service</SecondaryButton>
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
