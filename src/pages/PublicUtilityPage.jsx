import { ArrowLeft, MapPin, Radio, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicBranches } from '../lib/branches'
import { supabase } from '../lib/supabase'

export function QueuePage() {
  const { branch } = useParams()
  const { branches, loading, error } = usePublicBranches()

  if (!branch) {
    return (
      <section className="utility-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Live service queue</p>
          <h1 className="display-title">Plan your<br /><span>arrival.</span></h1>
          <p className="inner-hero-copy">Choose a branch for a simple, customer-safe view of current service activity.</p>
          {error && <p className="form-error">{error}</p>}
          <div className="queue-choice">
            {loading && <p className="text-slate-400">Loading branches…</p>}
            {branches.map((b) => (
              <Link to={`/queue/${b.slug}`} key={b.slug}>
                <MapPin />
                <strong>{b.name}</strong>
                <span>{b.address || b.slug}</span>
              </Link>
            ))}
            {!loading && !branches.length && <p className="text-slate-400">No active branches yet.</p>}
          </div>
        </div>
      </section>
    )
  }

  const details = branches.find((b) => b.slug === branch)
  if (!loading && !details) return <PublicMessage title="Branch not found" message="Choose a valid Hakum branch." />
  return (
    <PublicMessage
      title={`${details?.name || branch} live queue`}
      message={`Redirecting to live queue for ${details?.address || branch}…`}
      icon={Radio}
    />
  )
}

export function BookingPage() {
  const { branches, loading: branchesLoading, error: branchesError } = usePublicBranches()
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    vehicle_make: '',
    vehicle_model: '',
    scheduled_start: '',
    service_id: '',
    branch: '',
  })

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name, price_minor')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data, error: e }) => (e ? setError(e.message) : setServices(data ?? [])))
  }, [])

  useEffect(() => {
    if (!form.branch && branches[0]?.slug) {
      setForm((f) => ({ ...f, branch: branches[0].slug }))
    }
  }, [branches, form.branch])

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/public-book', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer_first_name: form.customer_first_name,
          customer_last_name: form.customer_last_name,
          customer_phone: form.customer_phone,
          vehicle_plate: form.vehicle_plate,
          vehicle_make: form.vehicle_make,
          vehicle_model: form.vehicle_model,
          scheduled_start: form.scheduled_start,
          service_id: form.service_id,
          branch: form.branch,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to submit booking.')
      setStatus('success')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <section className="booking-page">
        <div className="booking-success">
          <Sparkles />
          <p className="eyebrow">Booking received</p>
          <h1>We’ll take it from here.</h1>
          <p>Your request is with Hakum. We’ll text you status updates{/* BusyBee */} and confirm soon.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link className="button button-blue" to="/account">My account</Link>
            <Link className="button" to="/">Back to home</Link>
          </div>
        </div>
      </section>
    )
  }

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  return (
    <section className="booking-page">
      <div className="public-shell booking-grid">
        <div>
          <p className="eyebrow">Book a service</p>
          <h1 className="section-title">Your car’s next<br />chapter starts here.</h1>
          <p>Tell us what you drive and when you’d like to visit. Works with or without an account — we’ll SMS you updates.</p>
          <p style={{ marginTop: 12 }}>
            Have an account? <Link to="/signin">Sign in</Link> so this visit appears under My account.
          </p>
        </div>
        <form onSubmit={submit} className="booking-form">
          <label>First name<input required placeholder="Juan" onChange={update('customer_first_name')} /></label>
          <label>Last name<input required placeholder="Dela Cruz" onChange={update('customer_last_name')} /></label>
          <label>Mobile number<input required placeholder="09XX XXX XXXX" onChange={update('customer_phone')} /></label>
          <label>Plate number<input required placeholder="ABC 1234" onChange={update('vehicle_plate')} /></label>
          <label>Vehicle make<input required placeholder="Toyota" onChange={update('vehicle_make')} /></label>
          <label>Vehicle model<input required placeholder="Fortuner" onChange={update('vehicle_model')} /></label>
          <label>Preferred date & time<input required type="datetime-local" onChange={update('scheduled_start')} /></label>
          <label>
            Service
            <select required onChange={update('service_id')}>
              <option value="">Select service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            Branch
            <select required value={form.branch} onChange={update('branch')} disabled={branchesLoading}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </label>
          {(error || branchesError) && <p className="form-error">{error || branchesError}</p>}
          <button disabled={status === 'loading' || branchesLoading || !form.branch} className="button button-blue">
            {status === 'loading' ? 'Submitting…' : 'Request booking'}
          </button>
        </form>
      </div>
    </section>
  )
}

function PublicMessage({ title, message, icon: Icon = MapPin }) {
  return (
    <section className="public-message">
      <div>
        <Icon />
        <p className="eyebrow">Live queue</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link to="/queue"><ArrowLeft />All branches</Link>
      </div>
    </section>
  )
}
