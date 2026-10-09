import TintComparison from './TintComparison'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Info, RotateCcw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isApprovalPreview } from '../../lib/approvalPreview'
import { useTintFinderConfig } from '../../lib/tintFinderData'
import { TINT_QUESTIONS, TINT_VEHICLES, orderedBenefits, suggestTint, tintPackageName, tintPeso, tintShade, tintWarranty } from '../../lib/tintFinder'
import { usePublicBranches } from '../../lib/branches'
import { submitPublicInquiry } from '../../lib/publicInquiryApi'
import tintPhoto from '../../assets/services/tint-toyota86.webp'
import './TintFinder.css'

const icons = import.meta.glob('../../assets/tint-finder/icon-*.png', {eager:true,query:'?url',import:'default'})
const seal = new URL('../../assets/tint-finder/seal.png', import.meta.url).href
const specLabels = [['vlt','VLT'],['tser','TSER'],['irr','IRR'],['uvr','UVR']]
const FREEBIES = ['Premium Carwash','Bactozero','Old tint removal']

/* The shade and its four numbers stay on the card; a guide line under them
   says what the numbers mean. */
function ZoneFilm({config,filmKey,zone}) {
  const film=config.films[filmKey]
  return <div className="tf-zone"><span className="tf-zone-label">{zone}</span><strong>{tintShade(filmKey)} <em>{film.name.replace(/ Nano$/,'')}</em></strong>
    <dl className="tf-metrics">{specLabels.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{film[key]}%</dd></div>)}</dl></div>
}
/* Hover or keyboard focus opens it on desktop; a tap toggles it on touch. */
function WhySuggestion({reasons}) {
  const [open,setOpen]=useState(false)
  return <div className={`tf-why${open?' is-open':''}`}>
    <button type="button" className="tf-why-btn" aria-expanded={open} aria-controls="tf-why-body" onClick={()=>setOpen(o=>!o)}>Why this suggestion? <Info size={16} aria-hidden="true"/></button>
    <div className="tf-why-body" id="tf-why-body" role="region" aria-label="Why we suggested this tint"><b>Based on your answers</b><ul>{reasons.map(([lead,rest])=><li key={lead}><strong>{lead}</strong>, {rest}</li>)}</ul></div>
  </div>
}
/* Free inclusions sit beside the price, so the offer reads with the number. */
function CardFreebies() {
  return <div className="tf-card-free"><p>Free with this package</p><ul>{FREEBIES.map(label=><li key={label}><CheckCircle2 size={15} aria-hidden="true"/>{label}</li>)}</ul></div>
}
function TintBenefits({config,answers,options}) {
  const showSeal = config.sealEnabled && options.every(o=>config.sealVerifiedPackages.includes(o.package))
  return <div className="tf-benefits">
    <h2>Key Advantages of Our Window Films</h2>
    <p>Advanced technology for long-lasting protection, comfort and a clearer view.</p>
    <div className="tf-benefit-grid">{orderedBenefits(config,answers).map(b=><article key={b.id}>
      <img src={icons[`../../assets/tint-finder/icon-${b.id}.png`]} alt="" loading="lazy" width="100" height="100" />
      {b.personalized && <span className="tf-for-you">Matters for you</span>}
      <h3>{b.title}</h3><p>{b.description}</p>
    </article>)}</div>
    {showSeal && <div className="tf-seal"><img src={seal} alt="The Skin Cancer Foundation Seal of Recommendation" loading="lazy" /><div><h3>Seal of Recommendation</h3><p>The Skin Cancer Foundation gives this seal to sun protection products that meet its standard, including window film and tint for cars.</p></div></div>}
    <small>Benefits summarized from ClearPro (<a href="https://www.clearpro.com/" target="_blank" rel="noreferrer">clearpro.com</a>). Actual results vary by film and installation.</small>
  </div>
}
function TintBooking({option,config,answers,onCancel}) {
  const {branches,loading,error:branchError}=usePublicBranches()
  const [form,setForm]=useState({name:'',phone:'',branch:'',preferredDate:'',vehicleModel:'',acknowledged:false})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sent,setSent]=useState(false)
  const guard=useRef({openedAt:Date.now(),honeypot:''})
  const heading=useRef(null)
  useEffect(()=>{heading.current?.focus()},[])
  const set=(key,value)=>setForm(f=>({...f,[key]:value}))
  async function submit(e) {
    e.preventDefault()
    if (isApprovalPreview) { setSent(true); return }
    setBusy(true);setError('')
    const result=await submitPublicInquiry('tint_finder',{...form,answers,optionId:option.id},guard.current)
    setBusy(false)
    if(result.ok) setSent(true)
    else setError(result.error)
  }
  return <div className="tf-booking" id="tint-booking">
    <h3 ref={heading} tabIndex={-1}>{sent?(isApprovalPreview?'Preview complete.':'Your request is with Hakum.'):'Book your tint package.'}</h3>
    <p>{tintPackageName(config,option.package)} · {tintShade(option.front)} front / {tintShade(option.rear)} rear · {tintPeso(option.price)}</p>
    {sent ? <div role="status"><p>{isApprovalPreview ? 'This is a client approval demo. Nothing was sent or saved, and no appointment was created.' : 'Our team will contact you to confirm availability, your film choice and the final price. Your preferred date is a request until the branch confirms it.'}</p><button className="bd-btn bd-btn-quiet" onClick={onCancel}>Back to my results</button></div> : <form onSubmit={submit}>
      <div className="tf-form-grid">
        <label>Your name<input autoComplete="name" required maxLength={120} value={form.name} onChange={e=>set('name',e.target.value)} /></label>
        <label>Mobile number<input type="tel" autoComplete="tel" required pattern="(09[0-9]{9}|[+]?639[0-9]{9})" placeholder="0917 123 4567 (no spaces)" value={form.phone} onChange={e=>set('phone',e.target.value)} /></label>
        <label>Preferred branch<select required value={form.branch} disabled={loading || !!branchError} onChange={e=>set('branch',e.target.value)}><option value="">{loading?'Loading branches…':'Select a branch'}</option>{branches.map(b=><option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label>
        <label>Preferred date<input type="date" required min={new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})} value={form.preferredDate} onChange={e=>set('preferredDate',e.target.value)} /></label>
        <label className="tf-form-wide">Vehicle model<input required maxLength={160} placeholder="e.g. Toyota Vios" value={form.vehicleModel} onChange={e=>set('vehicleModel',e.target.value)} /></label>
      </div>
      <label className="tf-honeypot" aria-hidden="true">Company website<input tabIndex={-1} autoComplete="off" onChange={e=>{guard.current.honeypot=e.target.value}} /></label>
      <label className="tf-consent"><input type="checkbox" required checked={form.acknowledged} onChange={e=>set('acknowledged',e.target.checked)} /><span>I understand the information above. I agree that Hakum may contact me about this request. <Link to="/privacy">Privacy policy</Link></span></label>
      {(error || branchError) && <p role="alert" className="tf-error">{error || 'Unable to load branches. Please try again or message us.'}</p>}
      <div className="tf-actions"><button type="submit" className="bd-btn bd-btn-primary" disabled={busy || loading || !!branchError || !branches.length}>{busy?'Sending…':'Request booking'}<ArrowRight size={18}/></button><button className="bd-btn bd-btn-quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
      <small>{isApprovalPreview ? 'Client preview only. No booking requests are sent from this preview.' : 'We’ll confirm availability and final pricing with you before your visit.'}</small>
    </form>}
  </div>
}
export default function TintFinder() {
  const {config,loading}=useTintFinderConfig()
  const [step,setStep]=useState(0)
  const [answers,setAnswers]=useState({})
  const [selected,setSelected]=useState(null)
  const [booking,setBooking]=useState(null)
  const title=useRef(null)
  const hasMoved=useRef(false)
  useEffect(()=>{
    if(hasMoved.current) title.current?.focus({preventScroll:true})
    hasMoved.current=true
  },[step])
  const q=TINT_QUESTIONS[step]
  const suggestion=step===4?suggestTint(config,answers):null
  const results=suggestion?.options || []
  const move=n=>{setSelected(n<4?answers[TINT_QUESTIONS[n].key] || null:null);setBooking(null);setStep(n)}
  const next=()=>{setAnswers(a=>({...a,[q.key]:selected}));setSelected(answers[TINT_QUESTIONS[step+1]?.key] || null);setStep(s=>s+1)}
  return <><section className="tf-section" id="tint-finder" aria-labelledby="tint-finder-title">
    {isApprovalPreview && <aside className="tf-approval-review" aria-label="Client design choices"><span>Client review · A / Original</span><nav><a href="/tint-designs/index.html">All designs</a>{['B','C','D','E'].map(id=><a key={id} href={`/tint-designs/option-${id.toLowerCase()}.html`}>{id}</a>)}</nav></aside>}
    <div className="bd-shell">
      <div className="tf-section-head"><p className="bd-eyebrow" id="tint-finder-title">Tint Finder</p><p>Four quick questions. We’ll suggest a front and rear shade, in both of our tints.</p></div>
      {step<4 ? <div className="tf-quiz">
        <div className="tf-question">
          <div className="tf-progress-label"><span>Step {step+1} of 4</span><span>Tint Finder</span></div>
          <div className="tf-progress" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step+1}>{TINT_QUESTIONS.map((v,i)=><span className={i<=step?'is-filled':''} key={v.key}/>)}</div>
          <h3 ref={title} tabIndex={-1}>{q.title}</h3><p>{q.hint}</p>
          <div className="tf-choices" role="group" aria-label={q.title}>{q.choices.map(c=><button type="button" key={c.id} aria-pressed={selected===c.id} className={selected===c.id?'is-selected':''} onClick={()=>setSelected(c.id)}><span><strong>{c.label}</strong>{c.description && <small>{c.description}</small>}</span><span className="tf-choice-mark" aria-hidden="true">{selected===c.id && <Check size={17}/>}</span></button>)}</div>
          <div className="tf-actions"><button type="button" className="tf-back" onClick={()=>step?move(step-1):document.getElementById('tint-finder-title')?.scrollIntoView({block:'center'})}><ArrowLeft size={17}/>Back</button><button type="button" className="bd-btn bd-btn-primary" disabled={!selected || loading} onClick={next}>{step===3?'See my matches':'Continue'}<ArrowRight size={18}/></button></div>
        </div>
        <aside className="tf-photo"><img src={tintPhoto} alt="Nano ceramic tint fitted to a Toyota 86 at Hakum"/><div><ShieldCheck size={26}/><h3>Comfort starts<br/>with the right film.</h3><p>Heat protection. Clear choices.<br/>Fitted by Hakum.</p></div></aside>
      </div> : <div className="tf-results">
        <div className="tf-results-head"><h3 ref={title} tabIndex={-1}>Your suggested tint.</h3><button className="tf-back" onClick={()=>move(3)}><ArrowLeft size={17}/>Edit answers</button></div>
        <div className="tf-answer-summary">{TINT_QUESTIONS.map(v=><span key={v.key}><small>{v.key==='night'?'Night driving':v.key==='eyesight'?'Eyesight':v.key==='priority'?'Priority':'Vehicle'}</small>{v.choices.find(c=>c.id===answers[v.key])?.label}</span>)}</div>
        {suggestion && <div className="tf-pick"><span className="tf-pick-tag">★ Our pick for you</span><h4>{suggestion.title}</h4><p>{suggestion.summary}</p><WhySuggestion reasons={suggestion.reasons}/></div>}
        <div className="tf-options">{results.map(o=>{
          const vehicle=TINT_VEHICLES.find(v=>v.id===answers.vehicle)?.label
          return <article key={o.id} className={`tf-option${o.package==='pro'?' is-pro':''}`} data-tint-option={o.id}>
            <div className="tf-card-head">
              <h3>{tintPackageName(config,o.package)}</h3>
              <div className="tf-warranty"><ShieldCheck size={22} aria-hidden="true"/><span><small>Covered by</small>{tintWarranty(config.packages[o.package].warranty)}</span></div>
              <div className="tf-seal-badge" title="Skin Cancer Foundation Seal of Recommendation"><img src={seal} alt="The Skin Cancer Foundation Seal of Recommendation" loading="lazy"/></div>
            </div>
            {o.front===o.rear ? <ZoneFilm config={config} filmKey={o.front} zone="All windows"/> : <div className="tf-zones"><ZoneFilm config={config} filmKey={o.front} zone="Front windows"/><ZoneFilm config={config} filmKey={o.rear} zone="Rear windows"/></div>}
            <p className="tf-guide"><b>VLT</b> light let through (lower is darker) · <b>TSER</b> total heat blocked · <b>IRR</b> infrared heat blocked · <b>UVR</b> UV blocked</p>
            <div className="tf-price"><span>Your {vehicle} · all windows incl. windshield</span><strong>{tintPeso(o.price)}</strong><CardFreebies/></div>
            <div className="tf-option-actions"><button className="bd-btn bd-btn-primary" onClick={()=>setBooking(o)}>Book this package<ArrowRight size={17}/></button></div>
          </article>
        })}</div>
        <p className="tf-fine">Your branch confirms the final shade and price. Ask us about current LTO tint limits before you book.</p>
        {booking && <TintBooking key={booking.id} option={booking} config={config} answers={answers} onCancel={()=>setBooking(null)}/>}
        <TintBenefits config={config} answers={answers} options={results}/>
        <button className="tf-back tf-restart" onClick={()=>{setAnswers({});move(0);setSelected(null)}}><RotateCcw size={17}/>Start again</button>
      </div>}
    </div>
  </section>
  <TintComparison config={config} />
  </>
}
