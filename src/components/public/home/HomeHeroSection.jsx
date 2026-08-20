import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

import desktopHeroVideo from '../../../assets/hero/desktop-hero.mp4'
import mobileHeroVideo from '../../../assets/hero/mobile-hero.mp4'
import { PrimaryButton, SecondaryButton, StatCard } from '../../ui'

const stats = [
  { value: 10, suffix: ' years', label: 'Auto industry experience combined' },
  { value: 3000, suffix: '+', label: 'Growing satisfied clients' },
  { value: 15000, suffix: '+', label: 'Vehicles rejuvenated annually' },
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
  return (
    <section id="hero" className="hero-stage" data-motion-section="hero">
      <div className="hero-media" aria-hidden="true" data-motion="hero-media">
        <video autoPlay loop muted playsInline preload="metadata" tabIndex={-1}>
          <source src={mobileHeroVideo} type="video/mp4" media="(max-width: 800px)" />
          <source src={desktopHeroVideo} type="video/mp4" />
        </video>
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
