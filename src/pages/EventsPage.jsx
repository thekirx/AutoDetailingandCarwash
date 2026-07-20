import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [registerFor, setRegisterFor] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url')
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
  }

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Community</p>
          <h1 className="display-title">Events &amp; meets.</h1>
          <p className="inner-hero-copy">Promotions, branch events, and car meets from Hakum Auto Care.</p>
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell numbered-grid">
          {error && <p className="form-error">{error}</p>}
          {status === 'success' && <p>Registration confirmed.</p>}
          {!events.length && !error && <p>No published events yet. Check back soon.</p>}
          {events.map((item, index) => (
            <article key={item.id}>
              <span>0{index + 1}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <p>{item.branch} · {new Date(item.starts_at).toLocaleString()}</p>
              <button type="button" className="button button-blue" onClick={() => setRegisterFor(item.id)}>Register</button>
            </article>
          ))}
        </div>
        {registerFor && (
          <form onSubmit={register} className="public-shell booking-form" style={{ marginTop: 40, maxWidth: 480 }}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <button className="button button-blue" disabled={status === 'loading'}>Confirm registration</button>
            <button type="button" className="dark-link" onClick={() => setRegisterFor(null)}>Cancel</button>
          </form>
        )}
        <div className="public-shell" style={{ marginTop: 48 }}>
          <Link className="dark-link" to="/">Back home</Link>
        </div>
      </section>
    </>
  )
}
