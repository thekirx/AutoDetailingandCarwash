import { ArrowLeft, MapPin, Radio, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePublicBranches } from '../lib/branches'
import { supabase } from '../lib/supabase'
import VehicleMakeModelFields from '../components/VehicleMakeModelFields'

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
  const [plateHint, setPlateHint] = useState('')
  const [form, setForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    vehicle_plate: '',
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

  useEffect(() => {
    const plate = form.vehicle_plate.trim()
    if (plate.length < 2) {
      setPlateHint('')
      return undefined
    }
    const t = window.setTimeout(() => {
      fetch(`/api/plate-lookup?plate=${encodeURIComponent(plate)}`)
        .then((r) => r.json())
        .then((body) => {
          if (!body?.found) {
            setPlateHint('New plate — enter vehicle details.')
            return
          }
          setPlateHint('Known plate — brand/model filled from past visits.')
          setForm((current) => ({
            ...current,
            vehicle_make: body.vehicle_make || current.vehicle_make,
            vehicle_model: body.vehicle_model || current.vehicle_model,
          }))
        })
        .catch(() => setPlateHint(''))
    }, 280)
    return () => window.clearTimeout(t)
  }, [form.vehicle_plate])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`
      }
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
      if (!res.ok) throw new Error(body.error || 'Booking failed')
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <section className="booking-page">
        <div className="public-shell">
          <Sparkles />
          <p className="eyebrow">Request received</p>
          <h1 className="section-title">You’re on the list.</h1>
          <p>We’ll confirm by SMS. Track status anytime from My account if you signed in.</p>
          <Link to="/" className="button button-blue" style={{ marginTop: 24 }}>Back home</Link>
        </div>
      </section>
    )
  }

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
          <label>First name<input required value={form.customer_first_name} placeholder="Juan" onChange={update('customer_first_name')} /></label>
          <label>Last name<input required value={form.customer_last_name} placeholder="Dela Cruz" onChange={update('customer_last_name')} /></label>
          <label>Mobile number<input required value={form.customer_phone} placeholder="09XX XXX XXXX" onChange={update('customer_phone')} /></label>
          <label>
            Plate number
            <input required value={form.vehicle_plate} placeholder="ABC 1234" onChange={update('vehicle_plate')} autoComplete="off" />
            {plateHint ? <span className="field-hint">{plateHint}</span> : null}
          </label>
          <VehicleMakeModelFields
            make={form.vehicle_make}
            model={form.vehicle_model}
            onMakeChange={(vehicle_make) => setForm((f) => ({ ...f, vehicle_make }))}
            onModelChange={(vehicle_model) => setForm((f) => ({ ...f, vehicle_model }))}
            variant="public"
            makeLabel="Vehicle brand"
            modelLabel="Vehicle model"
          />
          <label>Preferred date & time<input required type="datetime-local" value={form.scheduled_start} onChange={update('scheduled_start')} /></label>
          <label>
            Service
            <select required value={form.service_id} onChange={update('service_id')}>
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
