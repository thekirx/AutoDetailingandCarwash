import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, MapPin, Radio, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import PPFVisualizer from '../components/PPFVisualizer'
import { PrimaryButton, SecondaryButton, StatCard } from '../components/ui'
import { aboutImage } from '../data/publicHomeContent'
import { ceramicPackages, ceramicSection, featuredServices, otherServices } from '../data/publicHomeContent'
import { usePublicBranches, branchLabel } from '../lib/branches'

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
      frame = requestAnimationFrame(run); observer.disconnect()
    }, { threshold: .35 })
    observer.observe(node)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [value])
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

export default function PublicLandingPage() {
  const [isOtherServicesOpen, setIsOtherServicesOpen] = useState(false)
  const otherServicesModalRef = useRef(null)
  const otherServicesCloseRef = useRef(null)
  const { branches } = usePublicBranches()
  const locationLine = branches.length
    ? branches.map((b) => b.name.replace('Hakum Auto Care ', '')).join(' / ')
    : 'Bacoor / Batangas'

  useEffect(() => {
    if (!isOtherServicesOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    const modal = otherServicesModalRef.current
    document.body.style.overflow = 'hidden'
    otherServicesCloseRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOtherServicesOpen(false)
        return
      }

      if (event.key !== 'Tab' || !modal) return
      const focusable = [...modal.querySelectorAll('button, a[href]')].filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [isOtherServicesOpen])

  return <>
    <section className="hero-stage">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-content">
        <p className="hero-location">{locationLine}</p>
        <h1 className="display-title">
          <span className="hero-line hero-line-one">Give your car</span>
          <span className="hero-line hero-line-three">The pampering it deserves</span>
        </h1>
        <p className="hero-subheading">Expert detailing, precision car care, and the shine that turns heads — all in one place.</p>
        <div className="hero-actions">
          <PrimaryButton to="/services">Start now</PrimaryButton>
          <SecondaryButton to="/book">Book a service</SecondaryButton>
        </div>
        <div className="hero-experience" aria-labelledby="experience-heading">
          <h2 id="experience-heading">Experience</h2>
          <div className="hero-metrics" aria-label="Hakum milestones">
            {stats.map((stat) => <StatCard key={stat.label} value={<AnimatedNumber value={stat.value} suffix={stat.suffix}/>} label={stat.label}/>)}
          </div>
        </div>
      </div>
      <a className="scroll-note" href="#about">Discover <ArrowDown size={15}/></a>
    </section>

    <section className="editorial-section about-section" id="about">
      <div className="public-shell about-heading">
        <p className="eyebrow eyebrow-light">Our story · Since 2024</p>
        <h2 className="section-title light">About us</h2>
      </div>
      <div className="public-shell about-layout">
        <div className="about-visual">
          <img className="about-visual-image" src={aboutImage} alt="Hakum Auto Care precision vehicle detailing" />
          <span>Care in every detail</span>
          <strong>01</strong>
        </div>
        <div className="about-copy">
          <p className="about-lead">Founded in 2024, Hakum Auto Care was established on the principle that exceptional service begins with genuine care and pride in every job we undertake.</p>
          <p>We specialize in fast, high-quality auto detailing, treating every vehicle with the same attention and respect we give our own. The name “Hakum” originates from a heartfelt expression my son used as a child to say “I love you.” It serves as a constant reminder that our work should always come from a place of sincerity and dedication.</p>
          <p>Whether it’s a quick wash or comprehensive detailing, our customers can expect expert craftsmanship, premium products, and a team that truly treats every car as if it were their own.</p>
          <Link className="about-link" to="/branches">Meet your nearest branch <ArrowRight size={18}/></Link>
        </div>
      </div>
    </section>

    <section className="services-section" id="services">
      <div className="public-shell services-intro">
        <p className="services-eyebrow">Made to turn heads</p>
        <h2 className="services-display-title">Services</h2>
        <p className="services-intro-copy">From immaculate daily care to long-term paint protection, every service is delivered with obsessive attention to detail.</p>
      </div>
      <div className="featured-services-grid">
        {featuredServices.map((service) => (
          <article className="featured-service-card" key={service.title}>
            <img src={service.image} alt={service.imageAlt} loading="lazy" decoding="async" />
            <div className="featured-service-copy">
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="services-footer">
        <button className="other-services-trigger" type="button" onClick={() => setIsOtherServicesOpen(true)}>
          Other services <span aria-hidden="true">»</span>
        </button>
      </div>
    </section>

    {isOtherServicesOpen && (
      <div className="other-services-modal" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOtherServicesOpen(false)
      }}>
        <section
          className="other-services-dialog"
          ref={otherServicesModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="other-services-title"
        >
          <header className="other-services-header">
            <h2 id="other-services-title">Other services <span aria-hidden="true">»</span></h2>
            <button ref={otherServicesCloseRef} type="button" onClick={() => setIsOtherServicesOpen(false)} aria-label="Close other services">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="other-services-grid">
            {otherServices.map((service) => (
              <article className="other-service-card" key={service.title}>
                <img src={service.image} alt={service.imageAlt} loading="lazy" decoding="async" />
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    )}

    <section className="coating-section">
      <div className="public-shell ceramic-layout">
        <div className="ceramic-intro">
          <p>{ceramicSection.eyebrow}</p>
          <h2>{ceramicSection.title.split(' ').map((word) => <span key={word}>{word}</span>)}</h2>
          <div>{ceramicSection.copy}</div>
        </div>
        <div className="ceramic-package-grid">
          {ceramicPackages.map((item) => (
            <article className="ceramic-package-panel" key={item.title}>
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

    <PPFVisualizer />

    <section className="queue-teaser">
      <div className="public-shell queue-grid"><div><p className="eyebrow eyebrow-light"><Radio size={13}/> Live branch status</p><h2 className="section-title light">Know the queue.<br/>Own your time.</h2></div><div><p>See the customer-safe live service queue before you leave home. No internal records, no clutter — just the status you need.</p><Link className="button button-white" to="/queue">View live queue <ArrowRight size={18}/></Link></div></div>
    </section>

    <section className="home-branches">
      <div className="public-shell">
        <div className="section-heading-row">
          <div><p className="eyebrow eyebrow-light">Branches / Contact</p><h2 className="section-title light">Closer than<br />you think.</h2></div>
          <p>Premium car care across {branchLabel(branches.length)}. Choose your nearest branch and let us take it from here.</p>
        </div>
        <div className="home-branch-grid">
          {branches.map((b, i) => (
            <Link to={`/queue/${b.slug}`} key={b.slug}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <MapPin />
              <div><h3>{b.name.replace('Hakum Auto Care ', '')}</h3><p>{b.address || b.slug}</p></div>
              <ArrowRight />
            </Link>
          ))}
          {!branches.length && (
            <>
              <Link to="/branches"><span>01</span><MapPin /><div><h3>Bacoor</h3><p>RFC Mall, Cavite</p></div><ArrowRight /></Link>
              <Link to="/branches"><span>02</span><MapPin /><div><h3>Batangas</h3><p>Batangas City</p></div><ArrowRight /></Link>
            </>
          )}
        </div>
      </div>
    </section>
  </>
}
