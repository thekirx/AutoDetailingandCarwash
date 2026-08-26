import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import ContentBlockEditor from '@/components/content/ContentBlockEditor'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NamedSelect } from '@/components/ui/named-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listBranches } from '@/lib/adminApi'
import { normalizeBlocks, slugifyContentTitle } from '@/lib/contentBlocks'
import { slugifyEventTitle } from '@/lib/planningPart6'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

function emptyBlog() {
  return {
    id: null,
    title: '',
    slug: '',
    excerpt: '',
    cover_url: '/branding/hakum-lw-blue.png',
    author_label: 'Hakum Auto Care',
    status: 'draft',
    is_published: false,
    content_blocks: [normalizeBlocks([{ type: 'paragraph', text: '' }])[0]],
  }
}

function emptyEvent(defaultBranch = '') {
  return {
    id: null,
    title: '',
    slug: '',
    description: '',
    branch: defaultBranch,
    starts_at: '',
    ends_at: '',
    banner_url: '/branding/hakum-lw-ow.png',
    is_published: false,
    form_id: '',
    content_blocks: [],
  }
}

export default function ContentAdminPage() {
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const [tab, setTab] = useState('blogs')
  const [blogs, setBlogs] = useState([])
  const [events, setEvents] = useState([])
  const [forms, setForms] = useState([])
  const [blogEditor, setBlogEditor] = useState(null)
  const [eventEditor, setEventEditor] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [branchOptions, setBranchOptions] = useState([])

  const load = useCallback(async () => {
    const [b, e, f, branches] = await Promise.all([
      supabase.from('blogs').select('*').order('updated_at', { ascending: false }).limit(100),
      supabase
        .from('events')
        .select('id, title, description, branch, starts_at, ends_at, is_published, slug, form_id, banner_url, content_blocks, ops_forms!form_id ( id, name, slug )')
        .order('starts_at', { ascending: false })
        .limit(80),
      supabase
        .from('ops_forms')
        .select('id, name, slug, status, public_enabled, kind')
        .eq('is_active', true)
        .neq('status', 'archived')
        .order('name'),
      listBranches().catch(() => []),
    ])
    if (b.error) toast.error(b.error.message)
    else setBlogs(b.data || [])
    if (e.error) toast.error(e.error.message)
    else setEvents(e.data || [])
    if (!f.error) setForms(f.data || [])
    setBranchOptions(
      (branches || [])
        .filter((row) => row && !row.is_archived && row.is_active !== false)
        .map((row) => ({ value: row.slug, label: row.name || row.slug })),
    )
  }, [])

  const defaultBranchSlug = branchOptions[0]?.value || ''

  useEffect(() => {
    if (canEdit) load()
  }, [canEdit, load])

  const formsById = useMemo(() => {
    const map = {}
    for (const f of forms) map[f.id] = f
    return map
  }, [forms])

  if (!canEdit) return <Navigate to="/operations/access-denied" replace />

  async function saveBlog(e) {
    e.preventDefault()
    const title = blogEditor.title.trim()
    if (!title) return toast.error('Title is required')
    const blocks = normalizeBlocks(blogEditor.content_blocks)
    setSaving(true)
    const id = blogEditor.id || crypto.randomUUID()
    const slug = (blogEditor.slug || '').trim() || slugifyContentTitle(title, id)
    const published = blogEditor.status === 'published'
    const row = {
      id,
      title,
      slug,
      excerpt: blogEditor.excerpt.trim() || null,
      cover_url: blogEditor.cover_url.trim() || null,
      author_label: blogEditor.author_label.trim() || 'Hakum Auto Care',
      status: blogEditor.status,
      is_published: published,
      published_at: published ? (blogEditor.published_at || new Date().toISOString()) : null,
      content_blocks: blocks,
      updated_at: new Date().toISOString(),
    }
    const { error } = blogEditor.id
      ? await supabase.from('blogs').update(row).eq('id', blogEditor.id)
      : await supabase.from('blogs').insert({ ...row, created_by: profile?.id || null })
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success(blogEditor.id ? 'Blog saved' : 'Blog created')
      setBlogEditor(null)
      load()
    }
  }

  async function deleteBlog(id) {
    if (!window.confirm('Delete this blog post?')) return
    const { error } = await supabase.from('blogs').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Deleted')
      load()
    }
  }

  async function saveEvent(e) {
    e.preventDefault()
    const title = eventEditor.title.trim()
    if (!title || !eventEditor.starts_at) return toast.error('Title and start required')
    setSaving(true)
    const id = eventEditor.id || crypto.randomUUID()
    const slug = (eventEditor.slug || '').trim() || slugifyEventTitle(title, id)
    const row = {
      id,
      title,
      slug,
      description: eventEditor.description.trim() || null,
      branch: eventEditor.branch.trim() || null,
      starts_at: new Date(eventEditor.starts_at).toISOString(),
      ends_at: eventEditor.ends_at ? new Date(eventEditor.ends_at).toISOString() : null,
      banner_url: eventEditor.banner_url.trim() || null,
      is_published: Boolean(eventEditor.is_published),
      form_id: eventEditor.form_id || null,
      content_blocks: normalizeBlocks(eventEditor.content_blocks),
      updated_at: new Date().toISOString(),
    }
    const { error } = eventEditor.id
      ? await supabase.from('events').update(row).eq('id', eventEditor.id)
      : await supabase.from('events').insert(row)
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success(eventEditor.id ? 'Event saved' : 'Event created')
      setEventEditor(null)
      load()
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Deleted')
      load()
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

  function toLocalInput(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <section className="flex flex-col gap-6 pb-10">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Content</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Blogs &amp; Events</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          WordPress-style blocks: headings, images, videos, lists, quotes, and optional form buttons on events.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="blogs">Blogs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="blogs" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button type="button" className="cursor-pointer" onClick={() => setBlogEditor(emptyBlog())}>
              <Plus className="size-4" /> New blog
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Blog posts</CardTitle>
              <CardDescription>Published posts appear on /blog and in the customer app.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="font-medium">{post.title}</div>
                        <div className="text-xs text-muted-foreground">/blog/{post.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.is_published ? 'default' : 'secondary'}>
                          {post.is_published ? 'Published' : post.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(post.updated_at).toLocaleString()}</TableCell>
                      <TableCell className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setPreview({ kind: 'blog', ...post })}>Preview</Button>
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setBlogEditor({
                          ...post,
                          content_blocks: normalizeBlocks(post.content_blocks),
                        })}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        {post.is_published && (
                          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => copyUrl(`/blog/${post.slug}`)}>
                            <Copy className="size-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="cursor-pointer text-destructive" onClick={() => deleteBlog(post.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!blogs.length && (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No blogs yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button type="button" className="cursor-pointer" onClick={() => setEventEditor(emptyEvent(defaultBranchSlug))}>
              <Plus className="size-4" /> New event
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Attach a form globally and/or add form buttons inside content sections.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">/events/{ev.slug}</div>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(ev.starts_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{ev.ops_forms?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={ev.is_published ? 'default' : 'secondary'}>
                          {ev.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setPreview({ kind: 'event', ...ev })}>Preview</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setEventEditor({
                            ...ev,
                            starts_at: toLocalInput(ev.starts_at),
                            ends_at: toLocalInput(ev.ends_at),
                            form_id: ev.form_id || '',
                            content_blocks: normalizeBlocks(ev.content_blocks),
                          })}
                        >
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        {ev.is_published && (
                          <Button size="sm" variant="ghost" className="cursor-pointer" asChild>
                            <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="cursor-pointer text-destructive" onClick={() => deleteEvent(ev.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!events.length && (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">No events yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(blogEditor)} onOpenChange={(open) => !open && setBlogEditor(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{blogEditor?.id ? 'Edit blog' : 'New blog'}</DialogTitle>
          </DialogHeader>
          {blogEditor && (
            <form onSubmit={saveBlog} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Title</Label>
                  <Input required value={blogEditor.title} onChange={(e) => setBlogEditor({ ...blogEditor, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Slug</Label>
                  <Input value={blogEditor.slug} onChange={(e) => setBlogEditor({ ...blogEditor, slug: e.target.value })} placeholder="auto from title" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <NamedSelect
                    value={blogEditor.status}
                    onChange={(status) => setBlogEditor({ ...blogEditor, status, is_published: status === 'published' })}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'published', label: 'Published' },
                      { value: 'archived', label: 'Archived' },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Excerpt</Label>
                  <Textarea value={blogEditor.excerpt} onChange={(e) => setBlogEditor({ ...blogEditor, excerpt: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cover URL</Label>
                  <Input value={blogEditor.cover_url} onChange={(e) => setBlogEditor({ ...blogEditor, cover_url: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Author label</Label>
                  <Input value={blogEditor.author_label} onChange={(e) => setBlogEditor({ ...blogEditor, author_label: e.target.value })} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Content blocks</p>
                <ContentBlockEditor
                  blocks={blogEditor.content_blocks}
                  onChange={(content_blocks) => setBlogEditor({ ...blogEditor, content_blocks })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setPreview({ kind: 'blog', ...blogEditor })}>Preview</Button>
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setBlogEditor(null)}>Cancel</Button>
                <Button type="submit" className="cursor-pointer" disabled={saving}>{saving ? 'Saving…' : 'Save blog'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(eventEditor)} onOpenChange={(open) => !open && setEventEditor(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{eventEditor?.id ? 'Edit event' : 'New event'}</DialogTitle>
          </DialogHeader>
          {eventEditor && (
            <form onSubmit={saveEvent} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Title</Label>
                  <Input required value={eventEditor.title} onChange={(e) => setEventEditor({ ...eventEditor, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Short description</Label>
                  <Textarea value={eventEditor.description} onChange={(e) => setEventEditor({ ...eventEditor, description: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Branch</Label>
                  <NamedSelect
                    value={eventEditor.branch || ''}
                    onChange={(branch) => setEventEditor({ ...eventEditor, branch })}
                    options={[{ value: '', label: 'All / none' }, ...branchOptions]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Published</Label>
                  <NamedSelect
                    value={eventEditor.is_published ? 'yes' : 'no'}
                    onChange={(v) => setEventEditor({ ...eventEditor, is_published: v === 'yes' })}
                    options={[
                      { value: 'yes', label: 'Published' },
                      { value: 'no', label: 'Draft' },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Starts</Label>
                  <Input type="datetime-local" required value={eventEditor.starts_at} onChange={(e) => setEventEditor({ ...eventEditor, starts_at: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ends</Label>
                  <Input type="datetime-local" value={eventEditor.ends_at} onChange={(e) => setEventEditor({ ...eventEditor, ends_at: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Banner URL</Label>
                  <Input value={eventEditor.banner_url} onChange={(e) => setEventEditor({ ...eventEditor, banner_url: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Default event form</Label>
                  <NamedSelect
                    value={eventEditor.form_id || ''}
                    onChange={(form_id) => setEventEditor({ ...eventEditor, form_id })}
                    emptyLabel="No form"
                    options={forms.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Content sections</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Add a Button / CTA block and pick a form to place an RSVP button inside any section.
                </p>
                <ContentBlockEditor
                  allowFormCta
                  forms={forms}
                  blocks={eventEditor.content_blocks}
                  onChange={(content_blocks) => setEventEditor({ ...eventEditor, content_blocks })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setPreview({ kind: 'event', ...eventEditor })}>Preview</Button>
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEventEditor(null)}>Cancel</Button>
                <Button type="submit" className="cursor-pointer" disabled={saving}>{saving ? 'Saving…' : 'Save event'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview · {preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              {preview.cover_url || preview.banner_url ? (
                <img
                  src={preview.cover_url || preview.banner_url}
                  alt=""
                  className="max-h-48 w-full rounded-xl object-cover"
                />
              ) : null}
              <ContentBlockRenderer
                blocks={preview.content_blocks}
                formsById={formsById}
              />
              {preview.kind === 'blog' && preview.slug ? (
                <Button asChild variant="outline" className="cursor-pointer">
                  <Link to={`/blog/${preview.slug}`} target="_blank">Open live</Link>
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
