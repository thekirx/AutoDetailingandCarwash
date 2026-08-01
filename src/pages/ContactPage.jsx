import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import FormLegalNotice from '@/components/FormLegalNotice'

export default function ContactPage() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [guard, setGuard] = useState(() => createPublicFormGuard())
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' })

  async function submit(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
      setStatus('idle')
      return
    }
    const { error: e } = await supabase.from('contact_inquiries').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      subject: form.subject.trim(),
      message: form.message.trim(),
    })
    if (e) {
      setError(e.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    setGuard(createPublicFormGuard())
  }

  if (status === 'success') {
    return (
      <section className="utility-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Contact</p>
          <h1 className="display-title">Message received.</h1>
          <p className="inner-hero-copy">Our team will reply shortly at sales@hakumautocare.com.</p>
          <Link className="button button-blue" to="/">Back home</Link>
        </div>
      </section>
    )
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <section className="booking-page">
      <div className="public-shell booking-grid">
        <div>
          <p className="eyebrow">Talk to Hakum</p>
          <h1 className="section-title">Contact us</h1>
          <p>Questions about services, bookings, or branches — send a note and we will follow up.</p>
        </div>
        <form onSubmit={submit} className="booking-form">
          <label>Name<input required value={form.name} onChange={update('name')} /></label>
          <label>Phone<input required value={form.phone} onChange={update('phone')} /></label>
          <label>Email<input type="email" value={form.email} onChange={update('email')} /></label>
          <label>Subject<input required value={form.subject} onChange={update('subject')} /></label>
          <label>Message<textarea required value={form.message} onChange={update('message')} /></label>
          {/* honeypot — leave empty */}
          <label className="sr-only" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            Company website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={guard.honeypot}
              onChange={(e) => setGuard((g) => ({ ...g, honeypot: e.target.value }))}
            />
          </label>
          <FormLegalNotice id="contact-legal" />
          {error && <p className="form-error">{error}</p>}
          <button disabled={status === 'loading'} className="button button-blue">{status === 'loading' ? 'Sending…' : 'Send message'}</button>
        </form>
      </div>
    </section>
  )
}
