import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import { supabase } from '@/lib/supabase'
import { shareFormUrl } from '@/lib/opsForms'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import FormLegalNotice from '@/components/FormLegalNotice'

export default function EventSharePage() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [forms, setForms] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')
  const [guard, setGuard] = useState(() => createPublicFormGuard())

  useEffect(() => {
    if (!slug) return
    Promise.all([
      supabase
        .from('events')
        .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, is_published, form_id, content_blocks, ops_forms ( id, name, slug, public_enabled, status )')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle(),
      supabase.from('ops_forms').select('id, name, slug, public_enabled, status').eq('is_active', true),
    ]).then(([ev, fo]) => {
      if (ev.error) setError(ev.error.message)
      else if (!ev.data) setError('Event not found or not published.')
      else setEvent(ev.data)
      if (!fo.error) setForms(fo.data || [])
    })
  }, [slug])

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

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
  const hasBlocks = Array.isArray(event?.content_blocks) && event.content_blocks.length > 0

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
        <div className="public-shell hakum-article" style={{ maxWidth: 720 }}>
          {error && <p className="form-error">{error}</p>}
          {status === 'success' && <p>Registration confirmed.</p>}
          {event && (
            <>
              {event.banner_url ? (
                <img className="hakum-article-cover" src={event.banner_url} alt="" />
              ) : null}
              {event.description && !hasBlocks ? (
                <p className="hakum-block-p" style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
              ) : null}
              {event.description && hasBlocks ? (
                <p className="hakum-block-p">{event.description}</p>
              ) : null}
              {event.ends_at && (
                <p className="hakum-blog-meta">Ends {new Date(event.ends_at).toLocaleString()}</p>
              )}
              <ContentBlockRenderer blocks={event.content_blocks} formsById={formsById} />
              {formOpen && (
                <p className="hakum-block-cta-wrap">
                  <Link className="hakum-block-cta is-primary" to={`/f/${attached.slug}`}>
                    Open {attached.name}
                  </Link>
                  <a className="dark-link" href={shareFormUrl(attached.slug)} style={{ marginLeft: 12 }}>
                    Direct link
                  </a>
                </p>
              )}
              {!formOpen && (
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
                  <FormLegalNotice id="event-share-legal" className="form-legal-notice booking-span-2" />
                  <button className="button button-blue" disabled={status === 'loading'}>Register</button>
                </form>
              )}
            </>
          )}
          <p className="hakum-article-footer">
            <Link className="dark-link" to="/events">All events</Link>
            {' · '}
            <Link className="dark-link" to="/blog">Journal</Link>
            {' · '}
            <Link className="dark-link" to="/">Home</Link>
          </p>
        </div>
      </section>
    </>
  )
}
