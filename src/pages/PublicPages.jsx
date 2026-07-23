import { ArrowRight, Clock3, MapPin, ShieldCheck, Sparkles, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import PPFVisualizer from '../components/PPFVisualizer'
import { usePublicBranches, branchLabel } from '../lib/branches'

const serviceItems = [
  ['Premium car wash','A careful exterior clean, wheel treatment, and hand finish for a crisp everyday reset.'],
  ['Interior deep clean','Extraction, steam, detail brushing, and conditioning for a cabin that feels renewed.'],
  ['Paint correction','Multi-stage refinement to reduce swirls, haze, and defects while restoring deep gloss.'],
  ['Ceramic coating','Durable hydrophobic protection with richer color, easier upkeep, and serious shine.'],
  ['Paint protection film','Virtually invisible impact protection, precisely installed around every edge and contour.'],
  ['Maintenance detailing','A tailored care plan that preserves your finish between major detailing sessions.'],
]

export function ServicesPage(){return <PageHero eyebrow="Our services" title={<>Precision in<br/><i>every pass.</i></>} copy="Every vehicle receives a considered process, premium workmanship, and the same care we give our own."><section className="content-section"><div className="public-shell numbered-grid">{serviceItems.map(([name,copy],i)=><article key={name}><span>0{i+1}</span><Sparkles/><h2>{name}</h2><p>{copy}</p><Link to="/book">Book this service <ArrowRight/></Link></article>)}</div></section></PageHero>}

export function PackagesPage(){return <><PageHero eyebrow="Protection packages" title={<>Shine beyond limits.<br/><i>Shield beyond compare.</i></>} copy="Long-term ceramic gloss and precision-fit PPF, built around how much protection your vehicle needs."/><section className="package-section"><div className="public-shell package-columns"><Package title="Ceramic coating" icon={Waves} plans={['Essential gloss','Signature ceramic','Ultimate ceramic']}/><Package title="Paint protection film" icon={ShieldCheck} plans={['Essential front','Signature full front','Ultimate full body']}/></div></section><PPFVisualizer/></>}
function Package({title,icon:Icon,plans}){return <article className="package-card"><Icon/><p className="eyebrow">Protection system</p><h2>{title}</h2>{plans.map((p,i)=><div className="plan-row" key={p}><span>0{i+1}</span><strong>{p}</strong><Link to="/book"><ArrowRight/></Link></div>)}</article>}

export function BranchesPage() {
  const { branches, loading, error } = usePublicBranches({ mode: 'visible' })
  return (
    <PageHero
      eyebrow="Find Hakum"
      title={<>Our branches.<br /><i>One standard.</i></>}
      copy={`Premium care across ${branchLabel(branches.length)} — comfortable customer spaces and teams who take pride in the details.`}
    >
      <section className="content-section branch-section">
        <div className="public-shell branch-grid">
          {error && <p className="form-error">{error}</p>}
          {loading && <p className="text-slate-400">Loading branches…</p>}
          {branches.map((b) => (
            <Branch
              key={b.slug}
              city={b.name}
              address={b.address || '—'}
              comingSoon={Boolean(b.coming_soon)}
              queueTo={`/queue/${b.slug}`}
              mapsUrl={b.latitude != null ? `https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=16/${b.latitude}/${b.longitude}` : null}
            />
          ))}
          {!loading && !branches.length && <p className="text-slate-400">No branches listed yet.</p>}
        </div>
      </section>
    </PageHero>
  )
}
function Branch({ city, address, queueTo, comingSoon, mapsUrl }) {
  return (
    <article>
      <div className="branch-map"><MapPin /></div>
      <p className="eyebrow">Hakum Auto Care{comingSoon ? ' · Coming soon' : ''}</p>
      <h2>{city}</h2>
      <p>{address}</p>
      <span><Clock3 /> {comingSoon ? 'Opening soon' : 'Open daily · Queue varies'}</span>
      <div>
        {comingSoon ? (
          <Link className="button button-blue" to="/contact">Ask about opening</Link>
        ) : (
          <>
            <Link className="button button-blue" to="/book">Book this branch</Link>
            <Link className="dark-link" to={queueTo}>View queue <ArrowRight /></Link>
          </>
        )}
        {mapsUrl ? <a className="dark-link" href={mapsUrl} target="_blank" rel="noreferrer">Map <ArrowRight /></a> : null}
      </div>
    </article>
  )
}

function PageHero({eyebrow,title,copy,children}){return <><section className="inner-hero"><div className="public-shell"><p className="eyebrow eyebrow-light">{eyebrow}</p><h1 className="display-title">{title}</h1><p className="inner-hero-copy">{copy}</p></div></section>{children}</>}
