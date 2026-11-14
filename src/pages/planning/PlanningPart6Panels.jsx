import { useCallback, useEffect, useState } from 'react'
import { Edit3, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NamedSelect } from '@/components/ui/named-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { supabase } from '@/lib/supabase'
import { listBranches } from '@/lib/adminApi'
import { slugifyEventTitle } from '@/lib/planningPart6'
import {
  deleteCmsEvent,
  prepareEventForEditor,
  saveCmsEvent,
} from '@/lib/contentCmsApi'
import { toast } from 'sonner'

export { default as PlanningFormsPanel } from './PlanningFormsSmartPanel'

export function PlanningEventsPanel({ canEdit, highlightId, onCreateForm }) {
  const [events, setEvents] = useState([])
  const [opsForms, setOpsForms] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioDraft, setStudioDraft] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    branch: '',
    starts_at: '',
    ends_at: '',
    is_published: true,
    form_id: '',
  })

  const load = useCallback(async () => {
    let eventsQ = supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, banner_url, is_published, slug, form_id, content_blocks, ops_forms!form_id ( id, name, slug )')
      .order('starts_at', { ascending: false })
      .limit(50)
    if (!canEdit) eventsQ = eventsQ.eq('is_published', true)
    const [ev, forms, branches] = await Promise.all([
      eventsQ,
      supabase
        .from('ops_forms')
        .select('id, name, slug, status, public_enabled')
        .eq('is_active', true)
        .neq('status', 'archived')
        .order('name'),
      listBranches().catch(() => []),
    ])
    if (ev.error) toast.error(ev.error.message)
    else setEvents(ev.data || [])
    if (!forms.error) setOpsForms(forms.data || [])
    const opts = (branches || [])
      .filter((b) => b && !b.is_archived && b.is_active !== false)
      .map((b) => ({ value: b.slug, label: b.name || b.slug }))
    setBranchOptions(opts)
    setForm((prev) => (prev.branch ? prev : { ...prev, branch: opts[0]?.value || '' }))
  }, [canEdit])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      ?.channel?.('planning-events-live')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        load()
      })
      ?.subscribe?.()
    return () => {
      if (channel) supabase?.removeChannel?.(channel)
    }
  }, [load])

  function openEditEvent(ev) {
    setStudioDraft(prepareEventForEditor(ev))
    setStudioOpen(true)
  }

  function openStudioCreate() {
    setStudioDraft(prepareEventForEditor(null))
    setStudioOpen(true)
  }

  async function handleDeleteEvent(ev) {
    if (!canEdit || !ev?.id) return
    if (!window.confirm(`Delete event "${ev.title}"?`)) return
    const res = await deleteCmsEvent(ev.id)
    if (!res.ok) {
      toast.error(res.error || 'Could not delete event')
      return
    }
    toast.success('Event deleted')
    load()
  }

  async function createEvent(e) {
    e.preventDefault()
    if (!canEdit) return
    const title = form.title.trim()
    if (!title || !form.starts_at) return toast.error('Title and start required')
    const tempId = crypto.randomUUID()
    const slug = slugifyEventTitle(title, tempId)
    const res = await saveCmsEvent(
      {
        id: tempId,
        title,
        description: form.description.trim() || null,
        branch: form.branch.trim() || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_published: Boolean(form.is_published),
        slug,
        form_id: form.form_id || null,
      },
      { publish: Boolean(form.is_published) },
    )
    if (!res.ok) toast.error(res.error)
    else {
      toast.success('Event created')
      setForm({
        title: '',
        description: '',
        branch: branchOptions[0]?.value || '',
        starts_at: '',
        ends_at: '',
        is_published: true,
        form_id: '',
      })
      setCreateOpen(false)
      load()
    }
  }

  async function assignForm(ev, formId) {
    if (!canEdit) return
    const res = await saveCmsEvent(
      prepareEventForEditor({ ...ev, form_id: formId || '' }),
      { publish: Boolean(ev.is_published) },
    )
    if (!res.ok) toast.error(res.error)
    else {
      toast.success(formId ? 'Form attached' : 'Form cleared')
      load()
    }
  }

  async function togglePublish(ev) {
    if (!canEdit) return
    const nextPublished = !ev.is_published
    const res = await saveCmsEvent(
      prepareEventForEditor({ ...ev, is_published: nextPublished }),
      { publish: nextPublished },
    )
    if (!res.ok) toast.error(res.error)
    else load()
  }

  const visibleEvents = canEdit ? events : events.filter((ev) => ev.is_published)

  function shareUrl(ev) {
    return `${window.location.origin}/events/${ev.slug}`
  }

  async function copyLink(ev) {
    try {
      await navigator.clipboard.writeText(shareUrl(ev))
      toast.success('Share link copied')
    } catch {
      toast.message(shareUrl(ev))
    }
  }

  return (
    <div className="planner-events flex flex-col gap-6">
      {canEdit && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New event</DialogTitle>
              <DialogDescription>Creates a public page you can share. Attach a form if people need to RSVP.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createEvent} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ev-title">Title</Label>
                <Input id="ev-title" required className="min-h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ev-desc">Description</Label>
                <Textarea id="ev-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <NamedSelect
                  value={form.branch || ''}
                  onChange={(branch) => setForm({ ...form, branch })}
                  className="min-h-11"
                  options={[{ value: '', label: 'All / none' }, ...branchOptions]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Published</Label>
                <Select value={form.is_published ? 'yes' : 'no'} onValueChange={(v) => setForm({ ...form, is_published: v === 'yes' })}>
                  <SelectTrigger className="min-h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Published</SelectItem>
                    <SelectItem value="no">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ev-starts">Starts</Label>
                <Input id="ev-starts" type="datetime-local" required className="min-h-11" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ev-ends">Ends</Label>
                <Input id="ev-ends" type="datetime-local" className="min-h-11" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="ev-form">Optional form for attendees</Label>
                <NamedSelect
                  id="ev-form"
                  value={form.form_id || ''}
                  onChange={(v) => setForm({ ...form, form_id: v })}
                  emptyLabel="No form"
                  className="min-h-11"
                  options={opsForms.map((f) => ({ value: f.id, label: f.name }))}
                />
                <p className="text-xs text-muted-foreground">Shown on the public event page when set. Publish the form + enable its public link to accept answers.</p>
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" className="min-h-11 cursor-pointer">Create event</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <Card className="planner-ticket">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle>Events</CardTitle>
            <CardDescription>Share links, photo blocks, and optional attached smart forms.</CardDescription>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {onCreateForm ? (
                <Button type="button" variant="outline" className="min-h-11" onClick={onCreateForm}>Create event form</Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-11" onClick={openStudioCreate}>
                <Edit3 size={16} className="mr-1.5" aria-hidden />
                Studio Editor
              </Button>
              <Button type="button" className="min-h-11" onClick={() => setCreateOpen(true)}>
                <Plus size={16} className="mr-1.5" aria-hidden />
                New event
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="planning-event-list">
            {visibleEvents.map((ev) => (
              <article key={`m-${ev.id}`} className={`planning-event-card planner-ticket${ev.id === highlightId ? ' is-highlight' : ''}`}>
                <div>
                  <h3>{ev.title}</h3>
                  <p>{new Date(ev.starts_at).toLocaleString()}{ev.branch ? ` · ${ev.branch}` : ''}</p>
                </div>
                <div className="planning-event-card-meta">
                  <Badge variant={ev.is_published ? 'default' : 'secondary'}>
                    {ev.is_published ? 'Published' : 'Draft'}
                  </Badge>
                  {ev.ops_forms?.name ? <span>{ev.ops_forms.name}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ev.slug ? (
                    <>
                      <Button size="sm" variant="outline" className="max-xl:min-h-11" asChild>
                        <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">Open page</a>
                      </Button>
                      <Button size="sm" variant="ghost" className="max-xl:min-h-11" onClick={() => copyLink(ev)}>Copy link</Button>
                    </>
                  ) : null}
                  {canEdit ? (
                    <>
                      <Button size="sm" variant="outline" className="max-xl:min-h-11" onClick={() => openEditEvent(ev)}>
                        <Edit3 size={14} className="mr-1" aria-hidden />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="max-xl:min-h-11" onClick={() => togglePublish(ev)}>
                        {ev.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 max-xl:min-h-11" onClick={() => handleDeleteEvent(ev)}>
                        <Trash2 size={14} className="mr-1" aria-hidden />
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
            {!visibleEvents.length ? <p className="text-sm text-muted-foreground">{canEdit ? 'No events yet.' : 'No published events yet.'}</p> : null}
          </div>
          <div className="planning-event-table min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Share &amp; Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEvents.map((ev) => (
                <TableRow key={ev.id} className={ev.id === highlightId ? 'is-highlight' : undefined}>
                  <TableCell>
                    <div className="font-medium text-foreground">{ev.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{ev.branch}</div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{new Date(ev.starts_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={ev.is_published ? 'default' : 'secondary'}>
                      {ev.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="ml-2 cursor-pointer max-xl:min-h-11" onClick={() => togglePublish(ev)}>
                        Toggle
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <NamedSelect
                        value={ev.form_id || ''}
                        onChange={(v) => assignForm(ev, v)}
                        emptyLabel="None"
                        className="w-48 min-w-40 max-xl:min-h-11 xl:h-9"
                        options={opsForms.map((f) => ({ value: f.id, label: f.name }))}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{ev.ops_forms?.name || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {ev.slug ? (
                        <>
                          <a className="inline-flex items-center text-sm text-primary underline max-xl:min-h-11" href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">
                            /events/{ev.slug}
                          </a>
                          <Button size="sm" variant="outline" className="cursor-pointer max-xl:min-h-11" onClick={() => copyLink(ev)}>Copy</Button>
                        </>
                      ) : null}
                      {canEdit ? (
                        <>
                          <Button size="sm" variant="outline" className="cursor-pointer max-xl:min-h-11" onClick={() => openEditEvent(ev)}>
                            <Edit3 size={13} className="mr-1" aria-hidden />
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="cursor-pointer text-red-500 max-xl:min-h-11" onClick={() => handleDeleteEvent(ev)}>
                            <Trash2 size={13} aria-hidden />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!visibleEvents.length && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">{canEdit ? 'No events yet.' : 'No published events yet.'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <ContentStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          kind="event"
          initialData={studioDraft}
          opsForms={opsForms}
          branchOptions={branchOptions}
          onSaved={() => load()}
          onDeleted={() => load()}
        />
      ) : null}
    </div>
  )
}
