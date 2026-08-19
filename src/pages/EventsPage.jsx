import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import FormLegalNotice from '@/components/FormLegalNotice'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [registerFor, setRegisterFor] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')
  const [guard, setGuard] = useState(() => createPublicFormGuard())

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, form_id, is_date_tba, ops_forms!form_id ( id, name, slug, public_enabled, status )')
      .eq('is_published', true)
      .order('starts_at')
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        setEvents(data || [])
      })
  }, [])

  async function register(event) {
    event.preventDefault()
    setStatus('loading')
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
      setStatus('idle')
      return
    }
    const { error: e } = await supabase.from('event_registrations').insert({
      event_id: registerFor,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
    })
    if (e) {
      setError(e.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    setRegisterFor(null)
    setForm({ name: '', phone: '', email: '' })
    setGuard(createPublicFormGuard())
  }

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Community</p>
          <h1 className="display-title">Events &amp; meets.</h1>
          <p className="inner-hero-copy">Promotions, branch days, and car meets from Hakum Auto Care.</p>
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell hakum-event-stack">
          {error && <p className="form-error">{error}</p>}
          {status === 'success' && <p>Registration confirmed.</p>}
          {!events.length && !error && <p>No published events yet. Check back soon.</p>}
          {events.map((item) => {
            const attached = item.ops_forms
            const formOpen = attached?.slug && attached.public_enabled && attached.status === 'published'
            return (
              <article key={item.id} className="hakum-event-card">
                {item.banner_url ? (
                  <Link to={`/events/${item.slug}`} className="hakum-event-card-media">
                    <img src={item.banner_url} alt="" loading="lazy" />
                  </Link>
                ) : null}
                <div className="hakum-event-card-body">
                  <p className="hakum-blog-meta">
                    {item.branch ? `${item.branch} · ` : ''}
                    {item.is_date_tba ? 'To be announced' : new Date(item.starts_at).toLocaleString()}
                  </p>
                  <h2>
                    <Link to={`/events/${item.slug}`}>{item.title}</Link>
                  </h2>
                  {item.description ? <p>{item.description}</p> : null}
                  <div className="hakum-event-actions">
                    {item.slug && (
                      <Link className="button button-blue" to={`/events/${item.slug}`}>
                        Details
                      </Link>
                    )}
                    {formOpen ? (
                      <Link className="button button-blue" to={`/f/${attached.slug}`}>
                        {attached.name}
                      </Link>
                    ) : (
                      <button type="button" className="button button-blue" onClick={() => setRegisterFor(item.id)}>
                        Register
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        {registerFor && (
          <form onSubmit={register} className="public-shell booking-form" style={{ marginTop: 40, maxWidth: 480 }}>
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
            <FormLegalNotice id="events-legal" className="form-legal-notice booking-span-2" />
            <button className="button button-blue" disabled={status === 'loading'}>Confirm registration</button>
            <button type="button" className="dark-link" onClick={() => setRegisterFor(null)}>Cancel</button>
          </form>
        )}
        <div className="public-shell" style={{ marginTop: 48 }}>
          <Link className="dark-link" to="/blog">Blog</Link>
          {' · '}
          <Link className="dark-link" to="/">Back home</Link>
        </div>
      </section>
    </>
  )
}
