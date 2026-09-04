import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin } from 'lucide-react'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { Pills, Skeleton } from '@/components/customer/CustomerUi'
import { supabase } from '@/lib/supabase'

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function timeRange(ev) {
  const start = new Date(ev.starts_at)
  const opts = { hour: 'numeric', minute: '2-digit' }
  const from = start.toLocaleTimeString('en-PH', opts)
  if (!ev.ends_at) return from
  return `${from} - ${new Date(ev.ends_at).toLocaleTimeString('en-PH', opts)}`
}

function formOpen(ev) {
  const f = ev.ops_forms
  return f?.slug && f.public_enabled && f.status === 'published' ? f : null
}

export default function CustomerEventsPage() {
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [active, setActive] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('events')
        .select('id, title, slug, description, branch, starts_at, ends_at, banner_url, content_blocks, form_id, ops_forms!form_id ( id, name, slug, public_enabled, status )')
        .eq('is_published', true)
        .order('starts_at', { ascending: true }),
      supabase.from('ops_forms').select('id, name, slug, public_enabled, status').eq('is_active', true),
    ]).then(([ev, fo]) => {
      if (ev.error) setError(ev.error.message)
      setEvents(ev.data || [])
      if (!fo.error) setForms(fo.data || [])
      setLoading(false)
    })
  }, [])

  const formsById = useMemo(() => Object.fromEntries(forms.map((f) => [f.id, f])), [forms])
  const now = Date.now()
  const shown = useMemo(() => {
    const list = events.filter((ev) => {
      const end = new Date(ev.ends_at || ev.starts_at).getTime()
      return filter === 'upcoming' ? end >= now : end < now
    })
    return filter === 'past' ? list.reverse() : list
  }, [events, filter, now])

  if (active) {
    const attached = formOpen(active)
    return (
      <CustomerAppFrame
        title={active.title}
        subtitle={`${active.branch ? `${active.branch} · ` : ''}${new Date(active.starts_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
        onBack={() => setActive(null)}
      >
        {active.banner_url ? <img className="capp-cover" src={active.banner_url} alt="" /> : null}
        <div className="capp-article capp-card">
          {active.description ? <p className="capp-meta">{active.description}</p> : null}
          <ContentBlockRenderer mobile blocks={active.content_blocks} formsById={formsById} />
          {attached ? (
            <Link className="capp-btn capp-btn-accent" to={`/f/${attached.slug}`}>
              Register now
            </Link>
          ) : null}
          {active.slug ? (
            <Link className="capp-link" to={`/events/${active.slug}`}>
              Open full event page
            </Link>
          ) : null}
        </div>
      </CustomerAppFrame>
    )
  }

  return (
    <CustomerAppFrame title="Events" subtitle="Join our upcoming events and activities." backTo="/account" cols>
      <div className="capp-span">
        <Pills items={FILTERS} value={filter} onChange={setFilter} label="Events" />
      </div>
      {loading && !error ? (
        <div className="capp-span">
          <Skeleton n={2} />
        </div>
      ) : null}
      {error ? (
        <p className="capp-empty capp-span" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !shown.length && !error ? (
        <div className="capp-empty capp-span">{filter === 'upcoming' ? 'No upcoming events. New meets will show here.' : 'No past events yet.'}</div>
      ) : null}
      {shown.map((ev) => {
        const start = new Date(ev.starts_at)
        const attached = formOpen(ev)
        return (
          <article key={ev.id} className="capp-card capp-event">
            <div className="capp-event-head">
              <div className="capp-date" aria-hidden>
                <small>{start.toLocaleDateString('en-PH', { month: 'short' })}</small>
                <b>{start.getDate()}</b>
              </div>
              <div className="min-w-0">
                <h3>{ev.title}</h3>
                <ul className="capp-event-meta">
                  {ev.branch ? (
                    <li>
                      <MapPin size={14} strokeWidth={1.75} aria-hidden />
                      {ev.branch}
                    </li>
                  ) : null}
                  <li>
                    <Clock size={14} strokeWidth={1.75} aria-hidden />
                    {timeRange(ev)}
                  </li>
                </ul>
              </div>
            </div>
            {ev.description ? <p className="capp-meta">{ev.description}</p> : null}
            {attached && filter === 'upcoming' ? (
              <div className="capp-actions">
                <button type="button" className="capp-btn capp-btn-ghost" onClick={() => setActive(ev)}>
                  Details
                </button>
                <Link className="capp-btn capp-btn-accent" to={`/f/${attached.slug}`}>
                  Register now
                </Link>
              </div>
            ) : (
              <button type="button" className="capp-btn capp-btn-ghost capp-btn-block" onClick={() => setActive(ev)}>
                Details
              </button>
            )}
          </article>
        )
      })}
    </CustomerAppFrame>
  )
}
