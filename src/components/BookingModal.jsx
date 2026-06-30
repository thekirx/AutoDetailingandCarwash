import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { services } from '../data/services'
import { supabase } from '../lib/supabase'

const initialForm = { customer_name: '', vehicle_model: '', preferred_at: '', branch: '', service_requested: '' }

export default function BookingModal({ open, onClose, initialService = '' }) {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ ...initialForm, service_requested: initialService })
      setStatus('idle')
      setError('')
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open, initialService])

  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  if (!open) return null

  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    if (!supabase) {
      setError('Booking is not configured yet. Add the Supabase environment variables and try again.')
      setStatus('idle')
      return
    }
    const { error: insertError } = await supabase.from('bookings').insert([form])
    if (insertError) {
      setError(insertError.message || 'We could not send your request. Please try again.')
      setStatus('idle')
      return
    }
    setStatus('success')
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl sm:p-9">
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-mist transition hover:border-acid hover:text-acid" aria-label="Close booking form"><X size={20} /></button>
        {status === 'success' ? (
          <div className="flex min-h-96 flex-col items-center justify-center text-center">
            <CheckCircle2 size={58} className="mb-5 text-acid" />
            <p className="mb-2 text-xs font-bold uppercase tracking-[.3em] text-acid">Request received</p>
            <h2 className="font-display text-3xl uppercase">Your car is on our radar.</h2>
            <p className="mt-4 max-w-md text-mist">Our team will confirm your requested schedule and final service details shortly.</p>
            <button onClick={onClose} className="mt-8 bg-acid px-7 py-3 text-sm font-extrabold uppercase tracking-wider text-ink">Done</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.3em] text-acid">Reserve your slot</p>
            <h2 id="booking-title" className="pr-10 font-display text-3xl uppercase sm:text-4xl">Book a service</h2>
            <p className="mb-7 mt-3 text-sm text-mist">Tell us what your ride needs. We’ll contact you to confirm the schedule.</p>
            <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
              <Field label="Customer name"><input required name="customer_name" value={form.customer_name} onChange={update} placeholder="Juan Dela Cruz" /></Field>
              <Field label="Vehicle model"><input required name="vehicle_model" value={form.vehicle_model} onChange={update} placeholder="Toyota Fortuner 2024" /></Field>
              <Field label="Preferred date & time"><input required name="preferred_at" type="datetime-local" value={form.preferred_at} min={new Date().toISOString().slice(0, 16)} onChange={update} /></Field>
              <Field label="Branch"><select required name="branch" value={form.branch} onChange={update}><option value="">Select a branch</option><option>Quezon City</option><option>Makati</option><option>Alabang</option></select></Field>
              <Field label="Service requested" className="sm:col-span-2"><select required name="service_requested" value={form.service_requested} onChange={update}><option value="">Choose a service</option>{services.map(({ name }) => <option key={name}>{name}</option>)}</select></Field>
              {error && <p role="alert" className="sm:col-span-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
              <button disabled={status === 'loading'} className="sm:col-span-2 flex items-center justify-center gap-2 bg-acid px-6 py-4 text-sm font-extrabold uppercase tracking-[.14em] text-ink transition hover:bg-white disabled:opacity-60">
                {status === 'loading' && <LoaderCircle size={18} className="animate-spin" />} {status === 'loading' ? 'Sending request' : 'Request booking'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function Field({ label, className = '', children }) {
  return <label className={`grid gap-2 text-xs font-bold uppercase tracking-widest text-mist ${className}`}><span>{label}</span>{children}</label>
}
