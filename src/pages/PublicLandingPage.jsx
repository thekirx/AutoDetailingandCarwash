import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowRight, CarFront, ChevronRight, Radio, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import PPFVisualizer from '../components/PPFVisualizer'
import { PrimaryButton, SecondaryButton, StatCard } from '../components/ui'

const stats = [
  { value: 15000, suffix: '+', label: 'Vehicles rejuvenated annually' },
  { value: 3000, suffix: '+', label: 'Growing satisfied clients' },
  { value: 10, suffix: ' years', label: 'Auto industry experience combined' },
  { value: 26, suffix: '', label: 'Team members' },
]

const services = [
  { number: '01', title: 'Signature detailing', copy: 'Meticulous interior and exterior care, shaped around your vehicle and the way you drive.', icon: Sparkles },
  { number: '02', title: 'Paint correction', copy: 'Precision polishing that restores depth, clarity, and a finish that catches every light.', icon: CarFront },
  { number: '03', title: 'Ceramic protection', copy: 'Long-term gloss and hydrophobic protection engineered for tropical roads and weather.', icon: ShieldCheck },
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
  return <>
    <section className="hero-stage">
      <div className="hero-glow" />
      <div className="hero-car" aria-hidden="true"><CarFront /></div>
      <div className="public-shell hero-content">
        <p className="eyebrow eyebrow-light">Premium auto detailing · Bacoor & Batangas</p>
        <h1 className="display-title">Give your car<br/><span>the pampering</span><br/>it deserves.</h1>
        <div className="hero-bottom">
          <p>Expert detailing, precision car care, and the shine that turns heads — all in one place.</p>
          <div className="hero-actions">
            <PrimaryButton to="/book">Book a service</PrimaryButton>
            <SecondaryButton to="/services">Explore services</SecondaryButton>
          </div>
        </div>
      </div>
      <div className="scroll-note">Scroll to discover <ArrowDownRight size={15}/></div>
    </section>

    <section className="stats-band" aria-label="Hakum milestones">
      <div className="public-shell stats-grid">
        {stats.map((stat) => <StatCard key={stat.label} value={<AnimatedNumber value={stat.value} suffix={stat.suffix}/>} label={stat.label}/>)}
      </div>
    </section>

    <section className="editorial-section about-section">
      <div className="public-shell editorial-grid">
        <div><p className="eyebrow">About Hakum</p><h2 className="section-title">Care is in<br/>our name.</h2></div>
        <div className="about-copy"><p className="lead">Founded on the principle that exceptional service begins with genuine care and pride in every job we undertake.</p><p>The name “Hakum” comes from a heartfelt expression the founder&apos;s son used to say “I love you.” It remains our reminder that every wash, detail, and protection service should come from sincerity and dedication.</p><Link className="text-link dark-link" to="/branches">Meet your nearest branch <ArrowRight size={18}/></Link></div>
      </div>
    </section>

    <section className="services-section" id="services">
      <div className="public-shell">
        <div className="section-heading-row"><div><p className="eyebrow eyebrow-light">Services</p><h2 className="section-title light">Made to turn<br/>heads.</h2></div><p>From immaculate daily care to long-term paint protection, every service is delivered with obsessive attention to detail.</p></div>
        <div className="service-list">{services.map(({ number, title, copy, icon: Icon }) => <Link to="/services" className="service-row" key={title}><span>{number}</span><Icon/><h3>{title}</h3><p>{copy}</p><ChevronRight/></Link>)}</div>
      </div>
    </section>

    <PPFVisualizer />

    <section className="queue-teaser">
      <div className="public-shell queue-grid"><div><p className="eyebrow eyebrow-light"><Radio size={13}/> Live branch status</p><h2 className="section-title light">Know the queue.<br/>Own your time.</h2></div><div><p>See the customer-safe live service queue before you leave home. No internal records, no clutter — just the status you need.</p><Link className="button button-white" to="/queue">View live queue <ArrowRight size={18}/></Link></div></div>
    </section>

    <section className="cta-strip"><div className="public-shell"><p>Ready for the Hakum treatment?</p><Link to="/book">Book your service <ArrowRight/></Link></div></section>
  </>
}
