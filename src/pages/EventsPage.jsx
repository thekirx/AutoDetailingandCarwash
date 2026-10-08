import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import { submitPublicInquiry } from '@/lib/publicInquiryApi'
import FormLegalNotice from '@/components/FormLegalNotice'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import { usePageMeta } from '../lib/pageMeta'
import { BlogListSection } from './BlogPage'

export default function EventsPage() {
  const { hash } = useLocation()
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [registerFor, setRegisterFor] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')
  const [guard, setGuard] = useState(() => createPublicFormGuard())

  usePageMeta({
    title: 'Events & Blog',
    description:
      'Hakum Auto Care events, registrations, car care stories, and blog posts in Bacoor and Batangas.',
    path: '/events',
  })

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, form_id, is_date_tba, ops_forms!form_id ( id, name, slug, public_enabled, status )')
      .eq('is_published', true)
      .order('starts_at')
      .then(({ data, error: e }) => {
        if (e) setError('Events are temporarily unavailable. Please check back soon.')
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
    const result = await submitPublicInquiry(
      'event_registration',
      {
        event_id: registerFor,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || '',
      },
      guard,
    )
    if (!result.ok) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('success')
    setRegisterFor(null)
    setForm({ name: '', phone: '', email: '' })
    setGuard(createPublicFormGuard())
  }

  useReveal()
  useEffect(() => {
    if (hash !== '#blog') return undefined
    const frame = requestAnimationFrame(() => document.getElementById('blog')?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <>
      <BdPageHero
        eyebrow="Community & stories"
        title={
          <>
            Events
            <br />
            <em>&amp; blog.</em>
          </>
        }
        copy="Explore Hakum events, car meets, detailing tips, and stories from the bay."
      />
      <section id="events-list" className="bd-community-events">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div><p className="bd-eyebrow">Community</p><h2 className="bd-skew">Events &amp; meets.</h2></div>
            <p>Promotions, branch days, and car meets from Hakum Auto Care.</p>
          </div>
          <div className="bd-event-stack">
          {error ? (
            <p className="bd-state is-error" role="alert">
              {error}
            </p>
          ) : null}
          {status === 'success' ? (
            <p className="bd-state" role="status">
              Registration confirmed.
            </p>
          ) : null}
          {!events.length && !error ? (
            <p className="bd-state">No published events yet. Check back soon.</p>
          ) : null}
          {events.map((item) => {
            const attached = item.ops_forms
            const formOpen = attached?.slug && attached.public_enabled && attached.status === 'published'
            return (
              <article key={item.id} className="bd-event-row bd-reveal">
                {item.banner_url ? (
                  <Link to={`/events/${item.slug}`} className="bd-event-media">
                    <img src={item.banner_url} alt="" loading="lazy" />
                  </Link>
                ) : null}
                <div className="bd-event-row-body">
                  <p className="bd-event-date">
                    {item.branch ? `${item.branch} · ` : ''}
                    {item.is_date_tba ? 'To be announced' : new Date(item.starts_at).toLocaleString()}
                  </p>
                  <h2>
                    <Link to={`/events/${item.slug}`}>{item.title}</Link>
                  </h2>
                  {item.description ? <p className="bd-event-summary">{item.description}</p> : null}
                  <div className="bd-cta-row">
                    {item.slug ? (
                      <Link className="bd-btn bd-btn-primary" to={`/events/${item.slug}`}>
                        Details
                      </Link>
                    ) : null}
                    {formOpen ? (
                      <Link className="bd-btn bd-btn-quiet" to={`/f/${attached.slug}`}>
                        {attached.name}
                      </Link>
                    ) : (
                      <button type="button" className="bd-btn bd-btn-quiet" onClick={() => setRegisterFor(item.id)}>
                        Register
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
          </div>
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
      </section>
      <BlogListSection />
    </>
  )
}
