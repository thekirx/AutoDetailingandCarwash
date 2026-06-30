import { ArrowLeft, MapPin, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const branchDetails = {
  bacoor: { name: 'Bacoor Branch', location: 'RFC Mall, Bacoor' },
  batangas: { name: 'Hakum Batangas', location: 'Batangas' },
}

export function QueuePage() {
  const { branch } = useParams()
  const details = branchDetails[branch]
  if (!details) return <PublicMessage eyebrow="Live queue" title="Branch not found" message="Choose a valid Hakum branch from the home page." />

  return <PublicMessage eyebrow="Live queue" title={details.name} message={`Live queue information for ${details.location} will appear here.`} icon={Radio} />
}

export function BookingPage() {
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
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
      .then(({ data, error: servicesError }) => {
        if (servicesError) setError(servicesError.message)
        else setServices(data ?? [])
      })
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')

    const { error: insertError } = await supabase
      .from('bookings')
      .insert({
        ...form,
        scheduled_start: new Date(form.scheduled_start).toISOString(),
        status: 'pending',
      })

    if (insertError) {
      setError(insertError.message)
      setStatus('idle')
      return
    }

    setStatus('success')
  }

  if (status === 'success') {
    return (
      <section className="grid min-h-[620px] place-items-center">
        <h1 className="text-3xl font-bold">Booking request received.</h1>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-2xl gap-5 px-5 py-20">
      <input required placeholder="Customer name" className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400"
        onChange={(event) => setForm({ ...form, customer_name: event.target.value })} />

      <input required placeholder="Phone" className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400"
        onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} />

      <input required placeholder="Vehicle make" className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400"
        onChange={(event) => setForm({ ...form, vehicle_make: event.target.value })} />

      <input required placeholder="Vehicle model" className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400"
        onChange={(event) => setForm({ ...form, vehicle_model: event.target.value })} />

      <input required type="datetime-local" className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400"
        onChange={(event) => setForm({ ...form, scheduled_start: event.target.value })} />

      <select required className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400" onChange={(event) => setForm({ ...form, service_id: event.target.value })}>
        <option value="">Select service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>{service.name}</option>
        ))}
      </select>

      <select required value={form.branch} className="rounded border border-white/10 bg-[#10161e] p-3 text-white outline-none focus:border-lime-400" onChange={(event) => setForm({ ...form, branch: event.target.value })}>
        <option value="">Select branch</option>
        <option value="bacoor">Bacoor</option>
        <option value="batangas">Batangas</option>
      </select>

      {error && <p className="text-red-300">{error}</p>}

      <button disabled={status === 'loading'} className="mt-4 rounded-xl bg-lime-400 p-4 font-bold text-[#090d12] transition hover:bg-lime-300 disabled:opacity-50">
        {status === 'loading' ? 'Submitting…' : 'Book now'}
      </button>
    </form>
  )
}

function PublicMessage({ eyebrow, title, message, icon: Icon = MapPin }) {
  return (
    <section className="grid min-h-[620px] place-items-center px-5 py-20 text-center">
      <div className="max-w-xl"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lime-400/10 text-lime-300"><Icon /></span><p className="mt-7 text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">{eyebrow}</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1><p className="mt-5 leading-7 text-slate-400">{message}</p><Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-lime-400/40 hover:text-lime-300"><ArrowLeft size={17} />Back to home</Link></div>
    </section>
  )
}
