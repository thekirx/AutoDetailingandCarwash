import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NamedSelect } from '@/components/ui/named-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { slugifyEventTitle } from '@/lib/planningPart6'
import { toast } from 'sonner'

export { default as PlanningFormsPanel } from './PlanningFormsSmartPanel'

export function PlanningSettingsPanel({ canEdit, onPresetsChanged }) {
  const [labels, setLabels] = useState([])
  const [templates, setTemplates] = useState([])
  const [labelForm, setLabelForm] = useState({ name: '', color: '#38bdf8' })
  const [tmplForm, setTmplForm] = useState({ name: '', items: '' })

  const load = useCallback(async () => {
    const [lab, tmpl] = await Promise.all([
      supabase.from('plan_label_presets').select('id, name, color, position').order('position'),
      supabase
        .from('plan_checklist_templates')
        .select('id, name, position, plan_checklist_template_items ( id, title, position )')
        .order('position'),
    ])
    if (lab.error) toast.error(lab.error.message)
    else {
      setLabels(lab.data || [])
      onPresetsChanged?.(lab.data || [])
    }
    if (tmpl.error) toast.error(tmpl.error.message)
    else setTemplates(tmpl.data || [])
  }, [onPresetsChanged])

  useEffect(() => {
    load()
  }, [load])

  async function addLabel(e) {
    e.preventDefault()
    if (!canEdit) return
    const name = labelForm.name.trim()
    if (!name) return
    const { error } = await supabase.from('plan_label_presets').insert({
      name,
      color: labelForm.color,
      position: labels.length,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Label preset added')
      setLabelForm({ name: '', color: '#38bdf8' })
      load()
    }
  }

  async function deleteLabel(id) {
    if (!canEdit || !window.confirm('Delete label preset?')) return
    const { error } = await supabase.from('plan_label_presets').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Deleted')
      load()
    }
  }

  async function addTemplate(e) {
    e.preventDefault()
    if (!canEdit) return
    const name = tmplForm.name.trim()
    const titles = tmplForm.items.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!name || !titles.length) return toast.error('Name and at least one checklist line required')
    const { data, error } = await supabase
      .from('plan_checklist_templates')
      .insert({ name, position: templates.length })
      .select('id')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    const { error: itemErr } = await supabase.from('plan_checklist_template_items').insert(
      titles.map((title, i) => ({ template_id: data.id, title, position: i })),
    )
    if (itemErr) toast.error(itemErr.message)
    else {
      toast.success('Checklist template saved')
      setTmplForm({ name: '', items: '' })
      load()
    }
  }

  async function deleteTemplate(id) {
    if (!canEdit || !window.confirm('Delete checklist template?')) return
    const { error } = await supabase.from('plan_checklist_templates').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Deleted')
      load()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Card labels</CardTitle>
          <CardDescription>Colors you can tap onto a task so the team can spot it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <form onSubmit={addLabel} className="flex flex-wrap gap-2">
              <Input className="max-w-xs" required placeholder="Label name" value={labelForm.name} onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })} />
              <Input type="color" className="h-11 w-16 p-1" value={labelForm.color} onChange={(e) => setLabelForm({ ...labelForm, color: e.target.value })} />
              <Button type="submit">Add label</Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => (
              <div key={l.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
                <span className="size-3 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
                {canEdit && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => deleteLabel(l.id)}>×</button>
                )}
              </div>
            ))}
            {!labels.length && <p className="text-sm text-muted-foreground">No presets yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist templates</CardTitle>
          <CardDescription>Saved checklists you can apply when you open a card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <form onSubmit={addTemplate} className="grid max-w-xl gap-3">
              <Input required placeholder="Template name" value={tmplForm.name} onChange={(e) => setTmplForm({ ...tmplForm, name: e.target.value })} />
              <Textarea required placeholder={'One checklist item per line\nInspect exterior\nVacuum cabin'} value={tmplForm.items} onChange={(e) => setTmplForm({ ...tmplForm, items: e.target.value })} />
              <Button type="submit" className="w-fit">Save template</Button>
            </form>
          )}
          <div className="planning-event-list">
            {templates.map((t) => (
              <article key={`m-${t.id}`} className="planning-event-card">
                <div>
                  <h3>{t.name}</h3>
                  <p>
                    {(t.plan_checklist_template_items || [])
                      .sort((a, b) => a.position - b.position)
                      .map((i) => i.title)
                      .join(' · ') || 'No items'}
                  </p>
                </div>
                {canEdit ? (
                  <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>Delete</Button>
                ) : null}
              </article>
            ))}
            {!templates.length ? <p className="text-sm text-muted-foreground">No templates yet.</p> : null}
          </div>
          <div className="planning-event-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Items</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(t.plan_checklist_template_items || []).sort((a, b) => a.position - b.position).map((i) => i.title).join(' · ') || '—'}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>Delete</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!templates.length && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No templates yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function PlanningEventsPanel({ canEdit }) {
  const [events, setEvents] = useState([])
  const [opsForms, setOpsForms] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    branch: 'bacoor',
    starts_at: '',
    ends_at: '',
    is_published: true,
    form_id: '',
  })

  const load = useCallback(async () => {
    const [ev, forms] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, branch, starts_at, ends_at, is_published, slug, form_id, ops_forms ( id, name, slug )')
        .order('starts_at', { ascending: false })
        .limit(50),
      supabase
        .from('ops_forms')
        .select('id, name, slug, status, public_enabled')
        .eq('is_active', true)
        .neq('status', 'archived')
        .order('name'),
    ])
    if (ev.error) toast.error(ev.error.message)
    else setEvents(ev.data || [])
    if (!forms.error) setOpsForms(forms.data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createEvent(e) {
    e.preventDefault()
    if (!canEdit) return
    const title = form.title.trim()
    if (!title || !form.starts_at) return toast.error('Title and start required')
    const tempId = crypto.randomUUID()
    const slug = slugifyEventTitle(title, tempId)
    const { error } = await supabase.from('events').insert({
      id: tempId,
      title,
      description: form.description.trim() || null,
      branch: form.branch.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_published: Boolean(form.is_published),
      slug,
      form_id: form.form_id || null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Event created')
      setForm({ title: '', description: '', branch: 'bacoor', starts_at: '', ends_at: '', is_published: true, form_id: '' })
      load()
    }
  }

  async function assignForm(ev, formId) {
    if (!canEdit) return
    const { error } = await supabase.from('events').update({ form_id: formId || null }).eq('id', ev.id)
    if (error) toast.error(error.message)
    else {
      toast.success(formId ? 'Form attached' : 'Form cleared')
      load()
    }
  }

  async function togglePublish(ev) {
    if (!canEdit) return
    const { error } = await supabase.from('events').update({ is_published: !ev.is_published }).eq('id', ev.id)
    if (error) toast.error(error.message)
    else load()
  }

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
    <div className="flex flex-col gap-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>New event</CardTitle>
            <CardDescription>Creates a public page you can share. Attach a form if people need to RSVP.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createEvent} className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Published</Label>
                <Select value={form.is_published ? 'yes' : 'no'} onValueChange={(v) => setForm({ ...form, is_published: v === 'yes' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Published</SelectItem>
                    <SelectItem value="no">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Starts</Label>
                <Input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Ends</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="ev-form">Optional form for attendees</Label>
                <NamedSelect
                  id="ev-form"
                  value={form.form_id || ''}
                  onChange={(v) => setForm({ ...form, form_id: v })}
                  emptyLabel="No form"
                  options={opsForms.map((f) => ({ value: f.id, label: f.name }))}
                />
                <p className="text-xs text-muted-foreground">Shown on the public event page when set. Publish the form + enable its public link to accept answers.</p>
              </div>
              <Button type="submit" className="md:col-span-2 w-fit cursor-pointer">Create event</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Share links and optional attached smart forms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="planning-event-list">
            {events.map((ev) => (
              <article key={`m-${ev.id}`} className="planning-event-card">
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
                {ev.slug ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">Open page</a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyLink(ev)}>Copy link</Button>
                    {canEdit ? (
                      <Button size="sm" variant="ghost" onClick={() => togglePublish(ev)}>
                        {ev.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
            {!events.length ? <p className="text-sm text-muted-foreground">No events yet.</p> : null}
          </div>
          <div className="planning-event-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
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
                      <Button size="sm" variant="ghost" className="ml-2 cursor-pointer" onClick={() => togglePublish(ev)}>
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
                        className="h-9 w-48"
                        options={opsForms.map((f) => ({ value: f.id, label: f.name }))}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{ev.ops_forms?.name || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ev.slug ? (
                      <div className="flex flex-wrap gap-2">
                        <a className="text-sm text-primary underline" href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">
                          /events/{ev.slug}
                        </a>
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => copyLink(ev)}>Copy</Button>
                      </div>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!events.length && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No events yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
