import { ArrowLeft, MapPin, Radio, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const branches = { bacoor: { name: 'Bacoor', location: 'RFC Mall, Bacoor' }, batangas: { name: 'Batangas', location: 'Batangas City' } }

export function QueuePage() {
  const { branch } = useParams()
  if (!branch) return <section className="utility-hero"><div className="public-shell"><p className="eyebrow eyebrow-light">Live service queue</p><h1 className="display-title">Plan your<br/><span>arrival.</span></h1><p className="inner-hero-copy">Choose a branch for a simple, customer-safe view of current service activity.</p><div className="queue-choice">{Object.entries(branches).map(([slug,b])=><Link to={`/queue/${slug}`} key={slug}><MapPin/><strong>{b.name}</strong><span>{b.location}</span></Link>)}</div></div></section>
  const details = branches[branch]
  if (!details) return <PublicMessage title="Branch not found" message="Choose a valid Hakum branch." />
  return <PublicMessage title={`${details.name} live queue`} message={`Current customer-safe service status for ${details.location} will appear here.`} icon={Radio}/>
}

export function BookingPage() {
  const [services,setServices]=useState([]), [status,setStatus]=useState('idle'), [error,setError]=useState('')
  const [form,setForm]=useState({customer_name:'',customer_phone:'',vehicle_make:'',vehicle_model:'',scheduled_start:'',service_id:'',branch:''})
  useEffect(()=>{supabase.from('services').select('id, name, price_minor').eq('is_active',true).order('display_order').then(({data,error:e})=>e?setError(e.message):setServices(data??[]))},[])
  const submit=async(event)=>{event.preventDefault();setStatus('loading');setError('');const{error:e}=await supabase.from('bookings').insert({...form,scheduled_start:new Date(form.scheduled_start).toISOString(),status:'pending'});if(e){setError(e.message);setStatus('idle')}else setStatus('success')}
  if(status==='success')return <section className="booking-page"><div className="booking-success"><Sparkles/><p className="eyebrow">Booking received</p><h1>We’ll take it from here.</h1><p>Your request is now with the Hakum team. We’ll confirm your appointment shortly.</p><Link className="button button-blue" to="/">Back to home</Link></div></section>
  const update=(key)=>(event)=>setForm({...form,[key]:event.target.value})
  return <section className="booking-page"><div className="public-shell booking-grid"><div><p className="eyebrow">Book a service</p><h1 className="section-title">Your car’s next<br/>chapter starts here.</h1><p>Tell us what you drive and when you’d like to visit. Our team will review and confirm your request.</p></div><form onSubmit={submit} className="booking-form">
    <label>Full name<input required placeholder="Juan Dela Cruz" onChange={update('customer_name')}/></label>
    <label>Mobile number<input required placeholder="09XX XXX XXXX" onChange={update('customer_phone')}/></label>
    <label>Vehicle make<input required placeholder="Toyota" onChange={update('vehicle_make')}/></label>
    <label>Vehicle model<input required placeholder="Fortuner" onChange={update('vehicle_model')}/></label>
    <label>Preferred date & time<input required type="datetime-local" onChange={update('scheduled_start')}/></label>
    <label>Service<select required onChange={update('service_id')}><option value="">Select service</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Branch<select required value={form.branch} onChange={update('branch')}><option value="">Select branch</option><option value="bacoor">Bacoor</option><option value="batangas">Batangas</option></select></label>
    {error&&<p className="form-error">{error}</p>}<button disabled={status==='loading'} className="button button-blue">{status==='loading'?'Submitting…':'Request booking'}</button>
  </form></div></section>
}

function PublicMessage({title,message,icon:Icon=MapPin}){return <section className="public-message"><div><Icon/><p className="eyebrow">Live queue</p><h1>{title}</h1><p>{message}</p><Link to="/queue"><ArrowLeft/>All branches</Link></div></section>}
