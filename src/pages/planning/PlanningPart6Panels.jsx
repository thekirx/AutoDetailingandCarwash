import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import {
  complaintFields,
  formatFormPayloadDescription,
  parseCustomFieldsCsv,
  slugifyEventTitle,
} from '@/lib/planningPart6'
import { toast } from 'sonner'

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
          <CardTitle>Label presets</CardTitle>
          <CardDescription>Shared colors used on planning cards (Trello-like).</CardDescription>
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
          <CardDescription>Apply a template from a card modal to seed checklist items.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <form onSubmit={addTemplate} className="grid max-w-xl gap-3">
              <Input required placeholder="Template name" value={tmplForm.name} onChange={(e) => setTmplForm({ ...tmplForm, name: e.target.value })} />
              <Textarea required placeholder={'One checklist item per line\nInspect exterior\nVacuum cabin'} value={tmplForm.items} onChange={(e) => setTmplForm({ ...tmplForm, items: e.target.value })} />
              <Button type="submit" className="w-fit">Save template</Button>
            </form>
          )}
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
        </CardContent>
      </Card>
    </div>
  )
}

export function PlanningFormsPanel({ canEdit, lists }) {
  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [newForm, setNewForm] = useState({ name: '', kind: 'custom', fieldsCsv: 'Issue|Notes' })
  const [fillFormId, setFillFormId] = useState('')
  const [payload, setPayload] = useState({})
  const [dueAt, setDueAt] = useState('')
  const [listId, setListId] = useState('')

  const load = useCallback(async () => {
    const [f, s] = await Promise.all([
      supabase.from('ops_forms').select('id, name, kind, fields, is_active').order('created_at'),
      supabase
        .from('ops_form_submissions')
        .select('id, form_id, payload, plan_card_id, due_at, created_at, ops_forms ( name, kind )')
        .order('created_at', { ascending: false })
        .limit(40),
    ])
    if (f.error) toast.error(f.error.message)
    else {
      setForms(f.data || [])
      if (!fillFormId && f.data?.[0]) setFillFormId(f.data[0].id)
    }
    if (s.error) toast.error(s.error.message)
    else setSubmissions(s.data || [])
    if (!listId && lists?.[0]?.id) setListId(lists[0].id)
  }, [fillFormId, listId, lists])

  useEffect(() => {
    load()
  }, [load])

  const activeForm = forms.find((f) => f.id === fillFormId)
  const fields = Array.isArray(activeForm?.fields) ? activeForm.fields : []

  async function createForm(e) {
    e.preventDefault()
    if (!canEdit) return
    const name = newForm.name.trim()
    if (!name) return
    const fields = newForm.kind === 'complaint' ? complaintFields() : parseCustomFieldsCsv(newForm.fieldsCsv)
    const { error } = await supabase.from('ops_forms').insert({
      name,
      kind: newForm.kind,
      fields,
      is_active: true,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Form created')
      setNewForm({ name: '', kind: 'custom', fieldsCsv: 'Issue|Notes' })
      load()
    }
  }

  async function submitAndPush(e) {
    e.preventDefault()
    if (!canEdit) return
    if (!activeForm || !listId) return toast.error('Pick a form and planning list')
    for (const field of fields) {
      if (field.required && !String(payload[field.key] || '').trim()) {
        return toast.error(`${field.label} is required`)
      }
    }
    const title =
      activeForm.kind === 'complaint'
        ? `Complaint: ${payload.customer_name || 'Customer'} (${payload.branch || 'branch'})`
        : `${activeForm.name}: ${payload[fields[0]?.key] || 'Submission'}`
    const description = formatFormPayloadDescription(payload)
    const dueIso = dueAt ? new Date(dueAt).toISOString() : null

    const { data: card, error: cardErr } = await supabase
      .from('plan_cards')
      .insert({
        list_id: listId,
        title: title.slice(0, 200),
        description,
        due_at: dueIso,
        position: Date.now() % 1_000_000,
        labels: activeForm.kind === 'complaint' ? [{ name: 'Ops', color: '#38bdf8' }] : [],
      })
      .select('id')
      .single()
    if (cardErr) {
      toast.error(cardErr.message)
      return
    }

    const { error: subErr } = await supabase.from('ops_form_submissions').insert({
      form_id: activeForm.id,
      payload,
      plan_card_id: card.id,
      due_at: dueIso,
    })
    if (subErr) toast.error(subErr.message)
    else {
      toast.success('Submitted and pushed to planning' + (dueIso ? ' calendar' : ''))
      setPayload({})
      setDueAt('')
      load()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Create form</CardTitle>
            <CardDescription>Complaint template or custom fields (pipe-separated labels).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createForm} className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Select value={newForm.kind} onValueChange={(kind) => setNewForm({ ...newForm, kind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newForm.kind === 'custom' && (
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Fields (Label|Label2)</Label>
                  <Input value={newForm.fieldsCsv} onChange={(e) => setNewForm({ ...newForm, fieldsCsv: e.target.value })} />
                </div>
              )}
              <Button type="submit" className="md:col-span-2 w-fit">Create form</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fill & push to planning</CardTitle>
          <CardDescription>Creates a plan card (and calendar entry when due date is set).</CardDescription>
        </CardHeader>
        <CardContent>
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">View-only — need planning_edit to submit.</p>
          ) : (
            <form onSubmit={submitAndPush} className="grid max-w-xl gap-3">
              <div className="flex flex-col gap-2">
                <Label>Form</Label>
                <Select value={fillFormId} onValueChange={(id) => { setFillFormId(id); setPayload({}) }}>
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>
                    {forms.filter((f) => f.is_active).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name} ({f.kind})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Planning list</Label>
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger><SelectValue placeholder="List" /></SelectTrigger>
                  <SelectContent>
                    {(lists || []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Due (optional → calendar)</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label>{field.label}{field.required ? ' *' : ''}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea required={!!field.required} value={payload[field.key] || ''} onChange={(e) => setPayload({ ...payload, [field.key]: e.target.value })} />
                  ) : (
                    <Input required={!!field.required} value={payload[field.key] || ''} onChange={(e) => setPayload({ ...payload, [field.key]: e.target.value })} />
                  )}
                </div>
              ))}
              <Button type="submit" disabled={!fields.length}>Submit → planning</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent submissions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Card</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.ops_forms?.name || s.form_id}</TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                  <TableCell>{s.plan_card_id ? <Badge variant="secondary">Linked</Badge> : '—'}</TableCell>
                </TableRow>
              ))}
              {!submissions.length && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No submissions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function PlanningEventsPanel({ canEdit }) {
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    branch: 'bacoor',
    starts_at: '',
    ends_at: '',
    is_published: true,
  })

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, branch, starts_at, ends_at, is_published, slug')
      .order('starts_at', { ascending: false })
      .limit(50)
    if (error) toast.error(error.message)
    else setEvents(data || [])
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
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Event created')
      setForm({ title: '', description: '', branch: 'bacoor', starts_at: '', ends_at: '', is_published: true })
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
            <CardTitle>Create event / meet</CardTitle>
            <CardDescription>Each event gets a public shareable URL.</CardDescription>
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
              <Button type="submit" className="md:col-span-2 w-fit">Create event</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Events</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>
                    <div className="font-medium">{ev.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{ev.branch}</div>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(ev.starts_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={ev.is_published ? 'default' : 'secondary'}>
                      {ev.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="ml-2" onClick={() => togglePublish(ev)}>
                        Toggle
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {ev.slug ? (
                      <div className="flex flex-wrap gap-2">
                        <a className="text-sm text-primary underline" href={`/events/${ev.slug}`} target="_blank" rel="noreferrer">
                          /events/{ev.slug}
                        </a>
                        <Button size="sm" variant="outline" onClick={() => copyLink(ev)}>Copy</Button>
                      </div>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!events.length && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No events yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
