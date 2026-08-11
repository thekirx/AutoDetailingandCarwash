import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { supabase } from '@/lib/supabase'

export default function CustomerEventsPage() {
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [active, setActive] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('events')
        .select('id, title, slug, description, branch, starts_at, ends_at, banner_url, content_blocks, form_id, ops_forms ( id, name, slug, public_enabled, status )')
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

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

  if (active) {
    const attached = active.ops_forms
    const formOpen = attached?.slug && attached.public_enabled && attached.status === 'published'
    return (
      <CustomerAppFrame
        title={active.title}
        subtitle={`${active.branch ? `${active.branch} · ` : ''}${new Date(active.starts_at).toLocaleString()}`}
        onBack={() => setActive(null)}
      >
        {active.banner_url ? <img className="capp-cover" src={active.banner_url} alt="" /> : null}
        <div className="capp-article capp-ticket">
          {active.description ? <p className="capp-meta">{active.description}</p> : null}
          <ContentBlockRenderer mobile blocks={active.content_blocks} formsById={formsById} />
          {formOpen ? (
            <Link className="capp-btn capp-btn-fill" to={`/f/${attached.slug}`}>
              Open {attached.name}
            </Link>
          ) : null}
          {active.slug ? (
            <Link className="account-link-btn" to={`/events/${active.slug}`}>
              Open full event page
            </Link>
          ) : null}
        </div>
      </CustomerAppFrame>
    )
  }

  return (
    <CustomerAppFrame title="Events" subtitle="Meets, promos, and branch days you can join." backTo="/account">
      {loading && !error ? (
        <>
          <div className="capp-skel" aria-hidden />
          <div className="capp-skel" aria-hidden />
        </>
      ) : null}
      {error ? <p className="capp-empty" role="alert">{error}</p> : null}
      {!loading && !events.length && !error ? (
        <div className="capp-empty">No upcoming events. New meets will show here.</div>
      ) : null}
      {events.map((ev) => (
        <button key={ev.id} type="button" className="capp-row" onClick={() => setActive(ev)}>
          {ev.banner_url ? (
            <img className="capp-thumb" src={ev.banner_url} alt="" />
          ) : (
            <CalendarDays className="capp-thumb" style={{ padding: '0.9rem' }} />
          )}
          <span>
            <strong>{ev.title}</strong>
            <em>
              {new Date(ev.starts_at).toLocaleString()}
              {ev.branch ? ` · ${ev.branch}` : ''}
            </em>
          </span>
        </button>
      ))}
    </CustomerAppFrame>
  )
}
