import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Edit3, Eye, EyeOff, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { listBranches } from '@/lib/adminApi'
import { shareFormUrl } from '@/lib/opsForms'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import { submitPublicInquiry } from '@/lib/publicInquiryApi'
import { usePageMeta } from '@/lib/pageMeta'
import {
  deleteCmsEvent,
  prepareEventForEditor,
  saveCmsEvent,
} from '@/lib/contentCmsApi'
import FormLegalNotice from '@/components/FormLegalNotice'

export default function EventSharePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const [event, setEvent] = useState(null)
  const [forms, setForms] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState('idle')
  const [guard, setGuard] = useState(() => createPublicFormGuard())
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioDraft, setStudioDraft] = useState(null)

  // Event share links are pasted into Facebook, Messenger and WhatsApp. Before
  // this, every one of them scraped as "Hakum Auto Care · Hakum Auto Care" with
  // the homepage blurb (BUG-051).
  usePageMeta({
    title: event?.title,
    description: event?.description || 'Hakum Auto Care event — dates, branch, and registration.',
    path: slug ? `/events/${slug}` : '/events',
    image: event?.banner_url || '/og-image.png',
  })

  const loadEvent = useCallback(async () => {
    if (!slug) return
    let evQuery = supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, is_published, form_id, content_blocks, ops_forms!form_id ( id, name, slug, public_enabled, status )')
      .eq('slug', slug)
    if (!canEdit) {
      evQuery = evQuery.eq('is_published', true)
    }
    const [ev, fo] = await Promise.all([
      evQuery.maybeSingle(),
      supabase.from('ops_forms').select('id, name, slug, public_enabled, status').eq('is_active', true),
    ])
    if (ev.error) setError(ev.error.message)
    else if (!ev.data) setError('Event not found or not published.')
    else {
      setEvent(ev.data)
      setError('')
    }
    if (!fo.error) setForms(fo.data || [])
  }, [slug, canEdit])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  useEffect(() => {
    if (!canEdit) return
    listBranches()
      .then((rows) => {
        setBranchOptions(
          (rows || [])
            .filter((b) => b && !b.is_archived && b.is_active !== false)
            .map((b) => ({ value: b.slug, label: b.name || b.slug })),
        )
      })
      .catch(() => {})
  }, [canEdit])

  useEffect(() => {
    if (!slug) return undefined
    const channel = supabase
      ?.channel?.(`event-share-live-${slug}`)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        loadEvent()
      })
      ?.subscribe?.()
    return () => {
      if (channel) supabase?.removeChannel?.(channel)
    }
  }, [slug, loadEvent])

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

  function openEditEvent() {
    if (!event) return
    setStudioDraft(prepareEventForEditor(event))
    setStudioOpen(true)
  }

  function openNewEvent() {
    setStudioDraft(prepareEventForEditor(null))
    setStudioOpen(true)
  }

  async function handleTogglePublish() {
    if (!event) return
    const nextPublished = !event.is_published
    const prepared = prepareEventForEditor({
      ...event,
      is_published: nextPublished,
    })
    const res = await saveCmsEvent(prepared, { publish: nextPublished })
    if (!res.ok) {
      toast.error(res.error || 'Could not update event status')
      return
    }
    toast.success(nextPublished ? 'Event published' : 'Event moved to draft')
    await loadEvent()
  }

  async function handleDeleteEvent() {
    if (!event?.id) return
    if (!window.confirm(`Delete event "${event.title}"?`)) return
    const res = await deleteCmsEvent(event.id)
    if (!res.ok) {
      toast.error(res.error || 'Could not delete event')
      return
    }
    toast.success('Event deleted')
    navigate('/events')
  }

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
    const result = await submitPublicInquiry(
      'event_registration',
      {
        event_id: event.id,
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
          <p className="eyebrow eyebrow-light">
            Event{event && !event.is_published ? ' · DRAFT PREVIEW' : ''}
          </p>
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
          {canEdit && event ? (
            <div className="bd-cms-toolbar" role="region" aria-label="Event Studio Controls" style={{ marginBottom: 24 }}>
              <div className="bd-cms-toolbar-info">
                <span className="bd-cms-badge">
                  <Sparkles size={13} />
                  {event.is_published ? 'Live Event' : 'Draft Event'}
                </span>
                <span className="bd-cms-toolbar-text">
                  Edit event details, upload banners &amp; gallery photos, attach smart RSVP forms, or publish.
                </span>
              </div>
              <div className="bd-cms-toolbar-actions">
                <button type="button" className="bd-cms-btn is-primary" onClick={openEditEvent}>
                  <Edit3 size={14} />
                  Edit Event
                </button>
                <button type="button" className="bd-cms-btn" onClick={handleTogglePublish}>
                  {event.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                  {event.is_published ? 'Move to Draft' : 'Publish Now'}
                </button>
                <button type="button" className="bd-cms-btn" onClick={openNewEvent}>
                  <Plus size={14} />
                  New Event
                </button>
                <button type="button" className="bd-cms-btn is-danger" onClick={handleDeleteEvent}>
                  <Trash2 size={14} />
                  Delete
                </button>
                <Link to="/operations/content" className="bd-cms-btn is-link">
                  CMS Studio
                </Link>
              </div>
            </div>
          ) : null}

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
            <Link className="dark-link" to="/blog">Blog</Link>
            {' · '}
            <Link className="dark-link" to="/">Home</Link>
          </p>
        </div>
      </section>

      {canEdit ? (
        <ContentStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          kind="event"
          initialData={studioDraft}
          opsForms={forms}
          branchOptions={branchOptions}
          onSaved={(saved) => {
            if (saved?.slug && saved.slug !== slug) {
              navigate(`/events/${saved.slug}`)
            } else {
              loadEvent()
            }
          }}
          onDeleted={() => navigate('/events')}
        />
      ) : null}
    </>
  )
}
