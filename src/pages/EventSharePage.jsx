import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { shareFormUrl } from '@/lib/opsForms'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'

export default function EventSharePage() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')
  const [guard, setGuard] = useState(() => createPublicFormGuard())

  useEffect(() => {
    if (!slug) return
    supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, is_published, form_id, ops_forms ( id, name, slug, public_enabled, status )')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        else if (!data) setError('Event not found or not published.')
        else setEvent(data)
      })
  }, [slug])

  async function register(e) {
    e.preventDefault()
    if (!event) return
    setStatus('loading')
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
      setStatus('idle')
      return
    }
    const { error: err } = await supabase.from('event_registrations').insert({
      event_id: event.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
    })
    if (err) {
      setError(err.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    setForm({ name: '', phone: '', email: '' })
    setGuard(createPublicFormGuard())
  }

  const attached = event?.ops_forms
  const formOpen = attached?.slug && attached.public_enabled && attached.status === 'published'

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Event</p>
          <h1 className="display-title">{event?.title || 'Event'}</h1>
          {event && (
            <p className="inner-hero-copy">
              {event.branch ? `${event.branch} · ` : ''}
              {new Date(event.starts_at).toLocaleString()}
            </p>
          )}
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell" style={{ maxWidth: 640 }}>
          {error && <p className="form-error">{error}</p>}
          {status === 'success' && <p>Registration confirmed.</p>}
          {event && (
            <>
              {event.description && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{event.description}</p>}
              {event.ends_at && (
                <p style={{ marginTop: 12, opacity: 0.8 }}>Ends {new Date(event.ends_at).toLocaleString()}</p>
              )}
              {formOpen && (
                <p style={{ marginTop: 24, padding: 16, border: '1px solid var(--color-border-light, #e5e7eb)', borderRadius: 12 }}>
                  This event has a form: <strong>{attached.name}</strong>
                  <br />
                  <Link className="dark-link" to={`/f/${attached.slug}`} style={{ display: 'inline-block', marginTop: 8 }}>
                    Open form →
                  </Link>
                  {' '}
                  <a className="dark-link" href={shareFormUrl(attached.slug)} style={{ marginLeft: 8 }}>
                    Direct link
                  </a>
                </p>
              )}
              <form onSubmit={register} className="booking-form" style={{ marginTop: 32 }}>
                <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label>Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label className="sr-only" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
                  Company website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={guard.honeypot}
                    onChange={(e) => setGuard((g) => ({ ...g, honeypot: e.target.value }))}
                  />
                </label>
                <button className="button button-blue" disabled={status === 'loading'}>Register</button>
              </form>
            </>
          )}
          <p style={{ marginTop: 40 }}>
            <Link className="dark-link" to="/events">All events</Link>
            {' · '}
            <Link className="dark-link" to="/">Home</Link>
          </p>
        </div>
      </section>
    </>
  )
}
