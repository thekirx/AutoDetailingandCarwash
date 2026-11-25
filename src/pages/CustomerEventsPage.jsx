import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin } from 'lucide-react'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { useBackOr } from '@/lib/useBackOr'
import { Pills, Skeleton } from '@/components/customer/CustomerUi'
import { supabase } from '@/lib/supabase'

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function timeRange(ev) {
  if (ev.is_date_tba) return 'Schedule to be announced'
  if (!ev.starts_at) return 'Time to be announced'
  const start = new Date(ev.starts_at)
  const opts = { hour: 'numeric', minute: '2-digit' }
  const from = start.toLocaleTimeString('en-PH', opts)
  if (!ev.ends_at) return from
  return `${from} - ${new Date(ev.ends_at).toLocaleTimeString('en-PH', opts)}`
}

function formOpen(ev) {
  const f = ev.ops_forms
  return f?.slug && f.public_enabled && f.status === 'published' && f.kind !== 'event' ? f : null
}

export default function CustomerEventsPage() {
  const back = useBackOr('/account/more')
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [active, setActive] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      supabase
        .from('events')
        .select('id, title, slug, description, branch, starts_at, ends_at, is_date_tba, banner_url, content_blocks, form_id, ops_forms!form_id ( id, name, slug, kind, public_enabled, status )')
        .eq('is_published', true)
        .order('starts_at', { ascending: true }),
      supabase.from('ops_forms').select('id, name, slug, kind, public_enabled, status').eq('is_active', true),
    ])
      .then(([ev, fo]) => {
        if (ev.error) setError(ev.error.message)
        else setError('')
        setEvents(ev.data || [])
        if (!fo.error) setForms(fo.data || [])
      })
      .catch((err) => setError(err?.message || 'Could not load events.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const formsById = useMemo(() => Object.fromEntries(forms.map((f) => [f.id, f])), [forms])
  const now = Date.now()
  const shown = useMemo(() => {
    const list = events.filter((ev) => {
      if (ev.is_date_tba || (!ev.starts_at && !ev.ends_at)) return filter === 'upcoming'
      const end = new Date(ev.ends_at || ev.starts_at).getTime()
      return filter === 'upcoming' ? end >= now : end < now
    })
    return filter === 'past' ? list.reverse() : list
  }, [events, filter, now])

  if (active) {
    const attached = formOpen(active)
    const activeWhenLabel = active.is_date_tba
      ? 'To be announced'
      : active.starts_at
        ? new Date(active.starts_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'To be announced'
    return (
      <CustomerAppFrame
        title={active.title}
        subtitle={`${active.branch ? `${active.branch} · ` : ''}${activeWhenLabel}`}
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
    <CustomerAppFrame title="Events" subtitle="Join our upcoming events and activities." onBack={back} cols>
      <div className="capp-span">
        <Pills items={FILTERS} value={filter} onChange={setFilter} label="Events" />
      </div>
      {loading && !error ? (
        <div className="capp-span">
          <Skeleton n={2} />
        </div>
      ) : null}
      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>Could not load events</strong>
          <span>{error}</span>
          <button type="button" className="capp-btn capp-btn-fill" onClick={loadEvents}>
            Retry
          </button>
        </div>
      ) : null}
      {!loading && !shown.length && !error ? (
        <div className="capp-empty capp-span">{filter === 'upcoming' ? 'No upcoming events. New meets will show here.' : 'No past events yet.'}</div>
      ) : null}
      {shown.map((ev) => {
        const hasStart = Boolean(ev.starts_at) && !ev.is_date_tba
        const start = hasStart ? new Date(ev.starts_at) : null
        const attached = formOpen(ev)
        return (
          <article key={ev.id} className="capp-card capp-event">
            <div className="capp-event-head">
              <div className="capp-date" aria-hidden>
                <small>{start ? start.toLocaleDateString('en-PH', { month: 'short' }) : 'TBA'}</small>
                <b>{start ? start.getDate() : '—'}</b>
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
