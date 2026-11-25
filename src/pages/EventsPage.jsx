import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { listBranches } from '@/lib/adminApi'
import {
  createEmptyEventDraft,
  deleteCmsEvent,
  fetchAllCmsEvents,
  prepareEventForEditor,
  saveCmsEvent,
} from '@/lib/contentCmsApi'
import { permanentFormResultsPath } from '@/lib/formResults'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import { usePageMeta } from '../lib/pageMeta'
import { buildEventsBlogSeoJsonLd } from '../lib/seoLocalGuides'
import { BlogListSection } from './BlogPage'

export default function EventsPage() {
  const { hash } = useLocation()
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [showDrafts, setShowDrafts] = useState(false)
  const [editorEvent, setEditorEvent] = useState(null)
  const [error, setError] = useState('')
  const eventsSeoJsonLd = useMemo(
    () => buildEventsBlogSeoJsonLd(typeof window !== 'undefined' ? window.location.origin : 'https://www.hakumautocare.com'),
    [],
  )

  usePageMeta({
    title: 'Events, Blog & Local Detailing Guides (Bacoor, Batangas City, Imus & Cavite)',
    description:
      'Hakum Auto Care events, car care blog, and local guides for the best car wash, auto detailing, ceramic coating, and PPF in Bacoor, Batangas City, Imus, and Cavite.',
    path: '/events',
    jsonLd: eventsSeoJsonLd,
    jsonLdId: 'hakum-events-seo-jsonld',
  })

  const loadEvents = useCallback(async () => {
    if (canEdit) {
      const [allEv, fo, branches] = await Promise.all([
        fetchAllCmsEvents(),
        supabase
          .from('ops_forms')
          .select('id, name, slug, status, public_enabled, kind')
          .eq('is_active', true)
          .neq('status', 'archived')
          .order('name'),
        listBranches().catch(() => []),
      ])
      setEvents(allEv || [])
      if (!fo.error) setForms(fo.data || [])
      setBranchOptions(
        (branches || [])
          .filter((row) => row && !row.is_archived && row.is_active !== false)
          .map((row) => ({ value: row.slug, label: row.name || row.slug })),
      )
      return
    }
    const { data, error: e } = await supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, slug, form_id, is_date_tba, is_published, content_blocks, ops_forms!form_id ( id, name, slug, kind, public_enabled, status )')
      .eq('is_published', true)
      .order('starts_at')
    if (e) setError('Events are temporarily unavailable. Please check back soon.')
    else setError('')
    setEvents(data || [])
  }, [canEdit])

  useEffect(() => {
    loadEvents()
    const channel = supabase
      .channel('public-events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => loadEvents())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadEvents])

  const defaultBranchSlug = branchOptions[0]?.value || 'bacoor'
  const visibleEvents = useMemo(
    () => (canEdit && showDrafts ? events : events.filter((ev) => ev.is_published !== false)),
    [events, canEdit, showDrafts],
  )

  async function handleQuickToggleEventPublish(item) {
    try {
      const prepared = prepareEventForEditor(item, defaultBranchSlug)
      const nextPublished = !prepared.is_published
      await saveCmsEvent({ ...prepared, is_published: nextPublished })
      toast.success(nextPublished ? 'Event published live' : 'Event moved to drafts')
      loadEvents()
    } catch (err) {
      toast.error(err?.message || 'Update failed')
    }
  }

  async function handleQuickDeleteEvent(item) {
    if (!window.confirm(`Delete event "${item.title}"?`)) return
    try {
      await deleteCmsEvent(item.id)
      toast.success('Event deleted')
      loadEvents()
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  useReveal()
  /* Old /blog links land on #blog. The live events above it load after the
     first paint and push the section down, so keep it pinned while the page
     settles (up to 3s), and let go as soon as the visitor scrolls themselves. */
  useEffect(() => {
    if (hash !== '#blog') return undefined
    let pinned = true
    const pin = () => {
      if (pinned) document.getElementById('blog')?.scrollIntoView()
    }
    const release = () => {
      pinned = false
    }
    const frame = requestAnimationFrame(pin)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pin)
    observer?.observe(document.body)
    const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    for (const type of userEvents) window.addEventListener(type, release, { passive: true })
    const timer = setTimeout(release, 3000)
    return () => {
      release()
      cancelAnimationFrame(frame)
      observer?.disconnect()
      clearTimeout(timer)
      for (const type of userEvents) window.removeEventListener(type, release)
    }
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

          {canEdit && (
            <div className="bd-cms-toolbar" role="region" aria-label="Events CMS Controls">
              <div className="bd-cms-toolbar-info">
                <span className="bd-post-badge">Events Studio</span>
                <span>Create, edit, upload event banners, and manage RSVPs.</span>
              </div>
              <div className="bd-cms-toolbar-actions">
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => setEditorEvent(createEmptyEventDraft(defaultBranchSlug))}
                >
                  <Plus size={15} aria-hidden="true" /> New Event
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-quiet"
                  onClick={() => setShowDrafts((v) => !v)}
                >
                  {showDrafts ? 'Showing Drafts & Published' : 'Show Draft Events'}
                </button>
                <Link className="bd-btn bd-btn-quiet" to="/operations/forms/results">
                  <ClipboardList size={15} aria-hidden="true" /> Form Results
                </Link>
                <Link className="bd-btn bd-btn-quiet" to="/operations/content?tab=events">
                  <Settings2 size={15} aria-hidden="true" /> Manage All
                </Link>
              </div>
            </div>
          )}

          <div className="bd-event-stack">
          {error ? (
            <p className="bd-state is-error" role="alert">
              {error}
            </p>
          ) : null}
          {!visibleEvents.length && !error ? (
            <p className="bd-state">No published events yet. Check back soon.</p>
          ) : null}
          {visibleEvents.map((item) => {
            const attached = item.ops_forms
            const formOpen = attached?.slug && attached.public_enabled && attached.status === 'published' && attached.kind !== 'event'
            const isPublished = item.is_published !== false
            return (
              <article key={item.id} className="bd-event-row bd-reveal">
                {item.banner_url ? (
                  <Link to={`/events/${item.slug}`} className="bd-event-media">
                    <img src={item.banner_url} alt="" loading="lazy" />
                  </Link>
                ) : null}
                <div className="bd-event-row-body">
                  <div className="bd-post-meta-row">
                    {!isPublished && <span className="bd-post-badge is-draft">Draft</span>}
                    <p className="bd-event-date">
                      {item.branch ? `${item.branch} · ` : ''}
                      {item.is_date_tba ? 'To be announced' : new Date(item.starts_at).toLocaleString()}
                    </p>
                  </div>
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
                    ) : null}
                  </div>
                  {canEdit && (
                    <div className="bd-cms-card-actions">
                      {attached?.slug ? (
                        <Link
                          className="bd-cms-inline-btn"
                          to={permanentFormResultsPath(attached.slug)}
                        >
                          <ClipboardList size={13} aria-hidden="true" /> Results
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="bd-cms-inline-btn"
                        onClick={() => setEditorEvent(prepareEventForEditor(item, defaultBranchSlug))}
                      >
                        <Pencil size={13} aria-hidden="true" /> Edit Event
                      </button>
                      <button
                        type="button"
                        className="bd-cms-inline-btn"
                        onClick={() => handleQuickToggleEventPublish(item)}
                      >
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="bd-cms-inline-btn is-danger"
                        onClick={() => handleQuickDeleteEvent(item)}
                      >
                        <Trash2 size={13} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
          </div>
        </div>
      </section>

      {canEdit && (
        <ContentStudioModal
          open={Boolean(editorEvent)}
          onOpenChange={(open) => !open && setEditorEvent(null)}
          kind="event"
          initialValue={editorEvent}
          profile={profile}
          forms={forms}
          branchOptions={branchOptions}
          onSaved={() => loadEvents()}
          onDeleted={() => loadEvents()}
        />
      )}

      <BlogListSection />
    </>
  )
}
