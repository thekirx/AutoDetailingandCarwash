import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Droplets, Gauge, GlassWater, MapPin, Radio, Shield, ShieldCheck, Sparkles, Sun, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import PPFVisualizer from '../components/PPFVisualizer'
import { PrimaryButton, SecondaryButton, StatCard } from '../components/ui'
import { usePublicBranches, branchLabel } from '../lib/branches'

const stats = [
  { value: 10, suffix: ' years', label: 'Auto industry experience combined' },
  { value: 3000, suffix: '+', label: 'Growing satisfied clients' },
  { value: 15000, suffix: '+', label: 'Vehicles rejuvenated annually' },
  { value: 26, suffix: '', label: 'Team members' },
]

const services = [
  { number: '01', title: 'Carwash', copy: 'A careful exterior clean that brings back a crisp, spotless finish.', icon: Droplets, position: '18% center' },
  { number: '02', title: 'Interior Detailing', copy: 'Deep cabin care for cleaner surfaces, fresher air, and renewed comfort.', icon: Sparkles, position: '36% center' },
  { number: '03', title: 'Ceramic Tint', copy: 'Heat-rejecting tint with lasting clarity, comfort, and UV protection.', icon: Sun, position: '52% center' },
  { number: '04', title: 'Ceramic Coating', copy: 'Long-term gloss and hydrophobic protection for everyday driving.', icon: ShieldCheck, position: '68% center' },
  { number: '05', title: 'Glass Detailing', copy: 'Polished, decontaminated glass for sharper vision in every condition.', icon: GlassWater, position: '82% center' },
  { number: '06', title: 'Engine Wash', copy: 'A precise, component-safe clean for a neater engine bay.', icon: Gauge, position: '12% 65%' },
  { number: '07', title: 'Paint Protection Film', copy: 'Virtually invisible impact protection for the paint that matters most.', icon: Shield, position: '56% 62%' },
  { number: '08', title: 'Mobile Detailing', copy: 'Premium Hakum car care delivered where it is most convenient.', icon: Truck, position: '90% 60%' },
]

const coatingPackages = [
  {
    number: '01', name: 'Classic',
    copy: 'Reliable protection and lasting shine that guards against everyday wear at an unbeatable value.',
    includes: ['1 Layer of Hakum Ceramic Coating', '1 Layer Ceramic Hydrophobic Spray Coating', '2-Year Warranty with Unlimited Recoating for 2 Panels', '2–3 Years of Durable Paint Protection'],
  },
  {
    number: '02', name: 'Premium', recommended: true,
    copy: 'Superior, long-lasting protection, deeper gloss, and enhanced hydrophobic performance that keeps your car showroom-fresh longer.',
    includes: ['2 Layers of Hakum Ceramic Coating', '1 Layer Ceramic Hydrophobic Spray Coating', '4-Year Warranty with Unlimited Recoating for 4 Panels', '3–5 Years of Long-Term Paint Protection'],
  },
  {
    number: '03', name: 'Platinum',
    copy: 'Luxury-grade formula offering multi-year protection, mirror-like shine, and elite resistance to UV, dirt, and chemicals.',
    includes: ['3 Layers of Intergalactic Graphene Coating', '1 Layer Ceramic Hydrophobic Spray Coating', '6-Year Warranty with Unlimited Recoating for 6 Panels', '5–8 Years of Premium Paint Protection'],
  },
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
  const { branches } = usePublicBranches()
  const locationLine = branches.length
    ? branches.map((b) => b.name.replace('Hakum Auto Care ', '')).join(' / ')
    : 'Bacoor / Batangas'

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
        <div className="about-visual" role="img" aria-label="Hakum Auto Care precision vehicle detailing">
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
      <div className="public-shell">
        <div className="section-heading-row"><div><p className="eyebrow eyebrow-light">Services</p><h2 className="section-title light">Made to turn<br/>heads.</h2></div><p>From immaculate daily care to long-term paint protection, every service is delivered with obsessive attention to detail.</p></div>
        <div className="service-grid">{services.map(({ number, title, copy, icon: Icon, position }) => <article className="service-card" key={title}>
          <div className="service-card-visual" style={{ '--service-position': position }}><span>{number}</span><Icon aria-hidden="true"/></div>
          <div className="service-card-body"><h3>{title}</h3><p>{copy}</p><Link to="/book">Book now <ArrowRight/></Link></div>
        </article>)}</div>
      </div>
    </section>

    <section className="coating-section">
      <div className="public-shell">
        <div className="coating-heading"><div><p className="eyebrow">Ceramic coating packages</p><h2 className="section-title">Shine beyond<br/>limits.</h2></div><p>Choose the level of lasting gloss and paint protection that fits how you drive, park, and care for your vehicle.</p></div>
        <div className="coating-grid">{coatingPackages.map((item) => <article className={`coating-card ${item.recommended ? 'is-recommended' : ''}`} key={item.name}>
          <div className="coating-card-top"><span>{item.number}</span>{item.recommended && <strong>Recommended</strong>}</div>
          <h3>{item.name}</h3>
          <p>{item.copy}</p>
          <div className="coating-includes"><span>Package includes</span><ul>{item.includes.map((feature) => <li key={feature}>{feature}</li>)}</ul></div>
          <Link to="/book" aria-label={`Book the ${item.name} ceramic coating package`}>Book now <ArrowRight/></Link>
        </article>)}</div>
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
