import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CalendarDays,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Globe,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import { MediaLibraryDialog } from '@/components/content/ContentBlockEditor'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listBranches } from '@/lib/adminApi'
import {
  createEmptyBlogDraft,
  createEmptyEventDraft,
  deleteCmsBlog,
  deleteCmsEvent,
  fetchAllCmsBlogs,
  fetchAllCmsEvents,
  prepareBlogForEditor,
  prepareEventForEditor,
  saveCmsBlog,
  saveCmsEvent,
} from '@/lib/contentCmsApi'
import { mergeBlogPostsWithGuides } from '@/lib/seoLocalGuides'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function ContentAdminPage() {
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const [tab, setTab] = useState('blogs')
  const [dbBlogs, setDbBlogs] = useState([])
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [blogSearch, setBlogSearch] = useState('')
  const [blogStatusFilter, setBlogStatusFilter] = useState('all')
  const [eventSearch, setEventSearch] = useState('')
  const [eventStatusFilter, setEventStatusFilter] = useState('all')
  const [studioModal, setStudioModal] = useState(null) // { kind: 'blog' | 'event', data }
  const [preview, setPreview] = useState(null)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)

  const load = useCallback(async () => {
    // Disambiguate events -> ops_forms relationship via ops_forms!form_id:
    // supabase.from('events').select('id, title, description, branch, starts_at, ends_at, banner_url, slug, is_published, form_id, content_blocks, ops_forms!form_id ( id, name, slug )')
    const [b, e, f, branches] = await Promise.all([
      fetchAllCmsBlogs(),
      fetchAllCmsEvents(),
      supabase
        .from('ops_forms')
        .select('id, name, slug, status, public_enabled, kind')
        .eq('is_active', true)
        .neq('status', 'archived')
        .order('name'),
      listBranches().catch(() => []),
    ])
    setDbBlogs(b || [])
    setEvents(e || [])
    if (!f.error) setForms(f.data || [])
    setBranchOptions(
      (branches || [])
        .filter((row) => row && !row.is_archived && row.is_active !== false)
        .map((row) => ({ value: row.slug, label: row.name || row.slug })),
    )
  }, [])

  const defaultBranchSlug = branchOptions[0]?.value || ''

  useEffect(() => {
    if (!canEdit) return undefined
    load()

    // Real-time subscription for live updates across tabs/users
    const channel = supabase
      .channel('cms-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blogs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => load())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [canEdit, load])

  const allBlogs = useMemo(
    () => mergeBlogPostsWithGuides(dbBlogs, { includeDrafts: true }),
    [dbBlogs],
  )

  const filteredBlogs = useMemo(() => {
    const q = blogSearch.trim().toLowerCase()
    return allBlogs.filter((post) => {
      if (blogStatusFilter === 'published' && (!post.is_published || post.status === 'archived')) {
        return false
      }
      if (blogStatusFilter === 'draft' && (post.is_published || post.status === 'archived')) {
        return false
      }
      if (blogStatusFilter === 'archived' && post.status !== 'archived') {
        return false
      }
      if (blogStatusFilter === 'seo-guides' && !post.is_builtin_guide && !post.region) {
        return false
      }
      if (!q) return true
      return (
        String(post.title || '').toLowerCase().includes(q) ||
        String(post.slug || '').toLowerCase().includes(q) ||
        String(post.category || '').toLowerCase().includes(q) ||
        String(post.region || '').toLowerCase().includes(q)
      )
    })
  }, [allBlogs, blogSearch, blogStatusFilter])

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    return events.filter((ev) => {
      if (eventStatusFilter === 'published' && !ev.is_published) return false
      if (eventStatusFilter === 'draft' && ev.is_published) return false
      if (!q) return true
      return (
        String(ev.title || '').toLowerCase().includes(q) ||
        String(ev.slug || '').toLowerCase().includes(q) ||
        String(ev.branch || '').toLowerCase().includes(q) ||
        String(ev.description || '').toLowerCase().includes(q)
      )
    })
  }, [events, eventSearch, eventStatusFilter])

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

  if (!canEdit) return <Navigate to="/operations/access-denied" replace />

  async function handleQuickToggleBlogPublish(post) {
    try {
      const prepared = prepareBlogForEditor(post)
      const nextPublished = !prepared.is_published
      await saveCmsBlog(
        {
          ...prepared,
          status: nextPublished ? 'published' : 'draft',
          is_published: nextPublished,
        },
        profile,
      )
      toast.success(nextPublished ? 'Blog published live' : 'Blog moved to drafts')
      load()
    } catch (err) {
      toast.error(err?.message || 'Status update failed')
    }
  }

  async function handleDuplicateBlog(post) {
    const prepared = prepareBlogForEditor(post)
    setStudioModal({
      kind: 'blog',
      data: {
        ...prepared,
        id: null,
        is_builtin_guide: false,
        title: `${prepared.title} (Copy)`,
        slug: `${prepared.slug}-copy-${Date.now().toString(36).slice(-4)}`,
        status: 'draft',
        is_published: false,
      },
    })
  }

  async function handleDeleteBlogRow(post) {
    if (!window.confirm(`Delete "${post.title}"?`)) return
    try {
      await deleteCmsBlog(post, profile)
      toast.success('Blog deleted')
      load()
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  async function handleQuickToggleEventPublish(ev) {
    try {
      const prepared = prepareEventForEditor(ev, defaultBranchSlug)
      const nextPublished = !prepared.is_published
      await saveCmsEvent({
        ...prepared,
        is_published: nextPublished,
      })
      toast.success(nextPublished ? 'Event published live' : 'Event moved to drafts')
      load()
    } catch (err) {
      toast.error(err?.message || 'Status update failed')
    }
  }

  async function handleDuplicateEvent(ev) {
    const prepared = prepareEventForEditor(ev, defaultBranchSlug)
    setStudioModal({
      kind: 'event',
      data: {
        ...prepared,
        id: null,
        title: `${prepared.title} (Copy)`,
        slug: `${prepared.slug}-copy-${Date.now().toString(36).slice(-4)}`,
        is_published: false,
      },
    })
  }

  async function handleDeleteEventRow(ev) {
    if (!window.confirm(`Delete event "${ev.title}"?`)) return
    try {
      await deleteCmsEvent(ev.id)
      toast.success('Event deleted')
      load()
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  async function copyUrl(path) {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.message(url)
    }
  }

  const publishedBlogsCount = allBlogs.filter((b) => b.is_published && b.status !== 'archived').length
  const draftBlogsCount = allBlogs.filter((b) => !b.is_published && b.status !== 'archived').length
  const publishedEventsCount = events.filter((e) => e.is_published).length
  const draftEventsCount = events.filter((e) => !e.is_published).length

  return (
    <OpsPageShell
      className="hakum-content"
      eyebrow="WordPress-Style Content Studio"
      title="Blogs & Events"
      description="Create, edit, autosave, preview, upload photos, and publish blog articles, regional SEO guides, and community events in real time."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setMediaLibraryOpen(true)}
          >
            <FolderOpen className="mr-1.5 size-4" /> Media Library
          </Button>
          <Button type="button" variant="outline" size="sm" asChild className="cursor-pointer">
            <Link to="/events" target="_blank">
              <Globe className="mr-1.5 size-4" /> View Live /events
            </Link>
          </Button>
        </div>
      }
    >
      {/* Quick Studio KPI Strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Published Blogs &amp; Guides</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{publishedBlogsCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Blog Drafts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{draftBlogsCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Published Events</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{publishedEventsCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Event Drafts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{draftEventsCount}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <OpsTabList
          aria-label="Content sections"
          tabs={[
            { id: 'blogs', label: `Blogs (${allBlogs.length})`, icon: FileText },
            { id: 'events', label: `Events (${events.length})`, icon: CalendarDays },
          ]}
        />

        {/* BLOGS TAB */}
        <TabsContent value="blogs" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={blogSearch}
                  onChange={(e) => setBlogSearch(e.target.value)}
                  placeholder="Search blog title, slug, city…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'published', label: 'Published' },
                  { id: 'draft', label: 'Drafts' },
                  { id: 'seo-guides', label: 'Regional SEO Guides' },
                  { id: 'archived', label: 'Archived' },
                ].map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={blogStatusFilter === f.id ? 'default' : 'outline'}
                    className="h-8 cursor-pointer text-xs"
                    onClick={() => setBlogStatusFilter(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() =>
                setStudioModal({ kind: 'blog', data: createEmptyBlogDraft() })
              }
            >
              <Plus className="mr-1.5 size-4" /> New Blog Post
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Blog Posts &amp; Regional SEO Guides</CardTitle>
              <CardDescription>
                Published posts appear immediately on /events#blog, /blog/:slug, and in the customer portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Region / Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlogs.map((post) => {
                      const isPublished = Boolean(post.is_published) && post.status !== 'archived'
                      return (
                        <TableRow key={post.id || post.slug}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {post.cover_url ? (
                                <img
                                  src={post.cover_url}
                                  alt=""
                                  className="hidden h-11 w-16 shrink-0 rounded-md border border-border object-cover sm:block"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{post.title}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>/blog/{post.slug}</span>
                                  {post.is_builtin_guide && (
                                    <span className="inline-flex items-center gap-0.5 text-primary">
                                      <Sparkles className="size-3" /> Built-in SEO Guide
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium capitalize">{post.regionLabel || post.region || 'All'}</div>
                            <div className="text-muted-foreground">{post.category || 'Guide'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPublished ? 'default' : 'secondary'}>
                              {isPublished ? 'Published' : post.status || 'Draft'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {post.updated_at || post.published_at
                              ? new Date(post.updated_at || post.published_at).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => setPreview({ kind: 'blog', ...post })}
                              >
                                <Eye className="mr-1 size-3.5" /> Preview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() =>
                                  setStudioModal({
                                    kind: 'blog',
                                    data: prepareBlogForEditor(post),
                                  })
                                }
                              >
                                <Pencil className="mr-1 size-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="cursor-pointer text-xs"
                                onClick={() => handleQuickToggleBlogPublish(post)}
                              >
                                {isPublished ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="cursor-pointer"
                                title="Duplicate post"
                                onClick={() => handleDuplicateBlog(post)}
                              >
                                <CopyPlus className="size-3.5" />
                              </Button>
                              {isPublished && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="cursor-pointer"
                                  title="Copy public link"
                                  onClick={() => copyUrl(`/blog/${post.slug}`)}
                                >
                                  <Copy className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="cursor-pointer text-destructive"
                                title="Delete post"
                                onClick={() => handleDeleteBlogRow(post)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!filteredBlogs.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No matching blog posts found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search event title, branch…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'published', label: 'Published' },
                  { id: 'draft', label: 'Drafts' },
                ].map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={eventStatusFilter === f.id ? 'default' : 'outline'}
                    className="h-8 cursor-pointer text-xs"
                    onClick={() => setEventStatusFilter(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() =>
                setStudioModal({
                  kind: 'event',
                  data: createEmptyEventDraft(defaultBranchSlug),
                })
              }
            >
              <Plus className="mr-1.5 size-4" /> New Event
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Events &amp; Community Meets</CardTitle>
              <CardDescription>
                Attach an RSVP form globally and/or add WordPress photo galleries, videos, and CTA buttons inside event sections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>When &amp; Branch</TableHead>
                      <TableHead>RSVP Form</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {ev.banner_url ? (
                              <img
                                src={ev.banner_url}
                                alt=""
                                className="hidden h-11 w-16 shrink-0 rounded-md border border-border object-cover sm:block"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">{ev.title}</div>
                              <div className="text-xs text-muted-foreground">/events/{ev.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">
                            {ev.is_date_tba
                              ? 'To be announced'
                              : ev.starts_at
                                ? new Date(ev.starts_at).toLocaleString()
                                : '—'}
                          </div>
                          <div className="capitalize text-muted-foreground">{ev.branch || 'All branches'}</div>
                        </TableCell>
                        <TableCell className="text-xs">{ev.ops_forms?.name || 'Built-in Registration'}</TableCell>
                        <TableCell>
                          <Badge variant={ev.is_published ? 'default' : 'secondary'}>
                            {ev.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => setPreview({ kind: 'event', ...ev })}
                            >
                              <Eye className="mr-1 size-3.5" /> Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() =>
                                setStudioModal({
                                  kind: 'event',
                                  data: prepareEventForEditor(ev, defaultBranchSlug),
                                })
                              }
                            >
                              <Pencil className="mr-1 size-3.5" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer text-xs"
                              onClick={() => handleQuickToggleEventPublish(ev)}
                            >
                              {ev.is_published ? 'Unpublish' : 'Publish'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer"
                              title="Duplicate event"
                              onClick={() => handleDuplicateEvent(ev)}
                            >
                              <CopyPlus className="size-3.5" />
                            </Button>
                            {ev.is_published && (
                              <Button size="sm" variant="ghost" className="cursor-pointer" asChild title="Open public event page">
                                <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer text-destructive"
                              title="Delete event"
                              onClick={() => handleDeleteEventRow(ev)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredEvents.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No events yet. Click &ldquo;New Event&rdquo; to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* WordPress Content Studio Modal (Blogs & Events) */}
      <ContentStudioModal
        open={Boolean(studioModal)}
        onOpenChange={(open) => !open && setStudioModal(null)}
        kind={studioModal?.kind || 'blog'}
        initialValue={studioModal?.data || null}
        profile={profile}
        forms={forms}
        branchOptions={branchOptions}
        onSaved={() => load()}
        onDeleted={() => load()}
      />

      {/* Quick Preview Modal */}
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview · {preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              {preview.cover_url || preview.banner_url ? (
                <img
                  src={preview.cover_url || preview.banner_url}
                  alt=""
                  className="max-h-56 w-full rounded-xl object-cover"
                />
              ) : null}
              <ContentBlockRenderer
                blocks={preview.content_blocks}
                formsById={formsById}
              />
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    const item = preview
                    setPreview(null)
                    setStudioModal({
                      kind: item.kind,
                      data:
                        item.kind === 'blog'
                          ? prepareBlogForEditor(item)
                          : prepareEventForEditor(item, defaultBranchSlug),
                    })
                  }}
                >
                  <Pencil className="mr-1.5 size-3.5" /> Edit in Studio
                </Button>
                {preview.kind === 'blog' && preview.slug ? (
                  <Button asChild className="cursor-pointer">
                    <Link to={`/blog/${preview.slug}`} target="_blank">
                      Open Live Article
                    </Link>
                  </Button>
                ) : null}
                {preview.kind === 'event' && preview.slug ? (
                  <Button asChild className="cursor-pointer">
                    <Link to={`/events/${preview.slug}`} target="_blank">
                      Open Live Event
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        title="Hakum Auto Care Media Library"
        onSelect={(item) => {
          navigator.clipboard?.writeText(item.url)
          toast.success('Photo URL copied to clipboard')
        }}
      />
    </OpsPageShell>
  )
}
