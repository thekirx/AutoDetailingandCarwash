import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NamedSelect } from '@/components/ui/named-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import {
  FIELD_TYPES,
  FORM_KINDS,
  FORM_STATUSES,
  SUBMISSION_STATUSES,
  extractCalendarAt,
  formatFormPayloadDescription,
  normalizeFields,
  shareFormUrl,
  slugifyFormName,
  submissionTitle,
  templateFields,
  validatePayload,
} from '@/lib/opsForms'
import { toast } from 'sonner'

const emptyEditor = () => ({
  id: null,
  name: '',
  kind: 'custom',
  description: '',
  status: 'draft',
  public_enabled: false,
  event_id: '',
  fields: templateFields('custom'),
  settings: { push_to_planning: true, show_on_calendar: true },
})

function FieldBuilder({ fields, onChange, disabled }) {
  const rows = normalizeFields(fields)

  function update(index, patch) {
    const next = rows.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange(normalizeFields(next))
  }

  function remove(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function add() {
    onChange(normalizeFields([
      ...rows,
      { label: `Field ${rows.length + 1}`, type: 'text', required: false },
    ]))
  }

  function move(index, dir) {
    const j = index + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((field, index) => (
        <div key={`${field.key}-${index}`} className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Label</Label>
              <Input
                disabled={disabled}
                value={field.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select disabled={disabled} value={field.type} onValueChange={(type) => update(index, { type })}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex min-h-11 items-end gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                disabled={disabled}
                checked={field.required}
                onChange={(e) => update(index, { required: e.target.checked })}
              />
              Required
            </label>
            {field.type === 'select' && (
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
                <Label>Options (pipe-separated)</Label>
                <Input
                  disabled={disabled}
                  value={(field.options || []).join('|')}
                  onChange={(e) => update(index, { optionsCsv: e.target.value })}
                  placeholder="Option A|Option B"
                />
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Up</Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled || index === rows.length - 1} onClick={() => move(index, 1)}>Down</Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} className="text-destructive" onClick={() => remove(index)}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          </div>
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" className="w-fit cursor-pointer" onClick={add}>
          <Plus className="size-4" /> Add field
        </Button>
      )}
    </div>
  )
}

function DynamicFields({ fields, values, onChange }) {
  return (
    <>
      {normalizeFields(fields).map((field) => (
        <div key={field.key} className="flex flex-col gap-2">
          <Label htmlFor={`df-${field.key}`}>
            {field.label}{field.required ? ' *' : ''}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea
              id={`df-${field.key}`}
              required={field.required}
              value={values[field.key] || ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
          ) : field.type === 'select' ? (
            <NamedSelect
              id={`df-${field.key}`}
              required={field.required}
              value={values[field.key] || ''}
              onChange={(v) => onChange({ ...values, [field.key]: v })}
              placeholder="Select…"
              options={(field.options || []).map((opt) => ({ value: opt, label: opt }))}
            />
          ) : field.type === 'checkbox' ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                id={`df-${field.key}`}
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.checked })}
              />
              {field.label}
            </label>
          ) : (
            <Input
              id={`df-${field.key}`}
              type={field.type === 'datetime' ? 'datetime-local' : field.type === 'phone' ? 'tel' : field.type}
              required={field.required}
              value={values[field.key] || ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
          )}
        </div>
      ))}
    </>
  )
}

export default function PlanningFormsSmartPanel({ canEdit, lists }) {
  const [forms, setForms] = useState([])
  const [events, setEvents] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState(emptyEditor)
  const [resultsFormId, setResultsFormId] = useState('')
  const [resultsOpen, setResultsOpen] = useState(false)
  const [previewForm, setPreviewForm] = useState(null)
  const [fillFormId, setFillFormId] = useState('')
  const [payload, setPayload] = useState({})
  const [listId, setListId] = useState('')
  const [pushPlanning, setPushPlanning] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    const [f, s, e] = await Promise.all([
      supabase
        .from('ops_forms')
        .select('id, name, kind, fields, is_active, slug, description, status, public_enabled, event_id, settings, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('ops_form_submissions')
        .select('id, form_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at, ops_forms ( name, kind, slug )')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('events').select('id, title, slug, starts_at').order('starts_at', { ascending: false }).limit(80),
    ])
    if (f.error) toast.error(f.error.message)
    else {
      setForms(f.data || [])
      if (!fillFormId && f.data?.[0]) setFillFormId(f.data[0].id)
    }
    if (s.error) toast.error(s.error.message)
    else setSubmissions(s.data || [])
    if (!e.error) setEvents(e.data || [])
    if (!listId && lists?.[0]?.id) setListId(lists[0].id)
  }, [fillFormId, listId, lists])

  useEffect(() => { load() }, [load])

  const activeForm = forms.find((f) => f.id === fillFormId)
  const resultsForm = forms.find((f) => f.id === resultsFormId)
  const resultsRows = useMemo(() => {
    let rows = submissions.filter((s) => s.form_id === resultsFormId)
    if (statusFilter !== 'all') rows = rows.filter((s) => s.status === statusFilter)
    return rows
  }, [submissions, resultsFormId, statusFilter])

  const countsByForm = useMemo(() => {
    const map = new Map()
    for (const s of submissions) map.set(s.form_id, (map.get(s.form_id) || 0) + 1)
    return map
  }, [submissions])

  function openCreate() {
    setEditor(emptyEditor())
    setEditorOpen(true)
  }

  function openEdit(form) {
    setEditor({
      id: form.id,
      name: form.name,
      kind: form.kind,
      description: form.description || '',
      status: form.status || 'draft',
      public_enabled: Boolean(form.public_enabled),
      event_id: form.event_id || '',
      fields: normalizeFields(form.fields),
      settings: { push_to_planning: true, show_on_calendar: true, ...(form.settings || {}) },
    })
    setEditorOpen(true)
  }

  async function saveForm(e) {
    e.preventDefault()
    if (!canEdit) return
    const name = editor.name.trim()
    if (!name) return toast.error('Name is required')
    const fields = normalizeFields(editor.fields)
    if (!fields.length) return toast.error('Add at least one field')
    setSaving(true)
    const slug = editor.id
      ? (forms.find((f) => f.id === editor.id)?.slug || slugifyFormName(name, editor.id))
      : slugifyFormName(name, crypto.randomUUID())
    const row = {
      name,
      kind: editor.kind,
      description: editor.description.trim() || null,
      status: editor.status,
      public_enabled: Boolean(editor.public_enabled),
      event_id: editor.event_id || null,
      fields,
      settings: editor.settings || {},
      is_active: editor.status !== 'archived',
      slug,
      updated_at: new Date().toISOString(),
    }
    const { error } = editor.id
      ? await supabase.from('ops_forms').update(row).eq('id', editor.id)
      : await supabase.from('ops_forms').insert(row)
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success(editor.id ? 'Form updated' : 'Form created')
      setEditorOpen(false)
      load()
    }
  }

  async function copyShare(form) {
    if (!form.slug) return toast.error('Form has no share slug yet')
    if (form.status !== 'published' || !form.public_enabled) {
      toast.message('Publish + enable public link to accept responses')
    }
    const url = shareFormUrl(form.slug)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast.message(url)
    }
  }

  async function submitStaff(e) {
    e.preventDefault()
    if (!canEdit || !activeForm) return
    const errors = validatePayload(activeForm.fields, payload)
    if (errors[0]) return toast.error(errors[0])
    const calendarAt = extractCalendarAt(activeForm.fields, payload)
    let planCardId = null
    if (pushPlanning && listId) {
      const title = submissionTitle(activeForm, payload)
      const { data: card, error: cardErr } = await supabase
        .from('plan_cards')
        .insert({
          list_id: listId,
          title: title.slice(0, 200),
          description: formatFormPayloadDescription(payload),
          due_at: calendarAt,
          position: Date.now() % 1_000_000,
          labels: activeForm.kind === 'complaint' ? [{ name: 'Ops', color: '#38bdf8' }] : [],
        })
        .select('id')
        .single()
      if (cardErr) return toast.error(cardErr.message)
      planCardId = card.id
    }
    const { error } = await supabase.from('ops_form_submissions').insert({
      form_id: activeForm.id,
      payload,
      plan_card_id: planCardId,
      due_at: calendarAt,
      calendar_at: calendarAt,
      respondent_label: payload.customer_name || payload.name || null,
      source: 'staff',
      status: 'new',
    })
    if (error) toast.error(error.message)
    else {
      toast.success(planCardId ? 'Submitted → planning' : 'Submission saved')
      setPayload({})
      load()
    }
  }

  async function setSubmissionStatus(id, status) {
    const { error } = await supabase.from('ops_form_submissions').update({ status }).eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success(`Marked ${status}`)
      load()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Smart form builder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build complaint, event, booking, or custom forms. Share a public link, review results, and sync dated answers to the calendar.
          </p>
        </div>
        {canEdit && (
          <Button type="button" className="min-h-11 cursor-pointer" onClick={openCreate}>
            <Plus className="size-4" /> New form
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forms</CardTitle>
          <CardDescription>{forms.length} templates · click Results to review submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Public</TableHead>
                <TableHead>Results</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{form.name}</div>
                    <div className="text-xs text-muted-foreground">{form.slug || '—'}</div>
                  </TableCell>
                  <TableCell className="capitalize"><Badge variant="secondary">{form.kind}</Badge></TableCell>
                  <TableCell className="capitalize text-foreground">{form.status}</TableCell>
                  <TableCell>{form.public_enabled && form.status === 'published' ? 'Open' : 'Closed'}</TableCell>
                  <TableCell className="tabular-nums">{countsByForm.get(form.id) || 0}</TableCell>
                  <TableCell className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setPreviewForm(form)}
                    >
                      <Eye className="size-3.5" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => { setResultsFormId(form.id); setResultsOpen(true); setStatusFilter('all') }}>
                      <Link2 className="size-3.5" /> Results
                    </Button>
                    {canEdit && (
                      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => openEdit(form)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => copyShare(form)}>
                      <Copy className="size-3.5" /> Link
                    </Button>
                    {form.slug && form.public_enabled && form.status === 'published' && (
                      <a
                        href={shareFormUrl(form.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center rounded-lg px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Open public form"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!forms.length && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No forms yet. Create one to get started.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff fill</CardTitle>
          <CardDescription>Submit internally and optionally push a card onto the planning board.</CardDescription>
        </CardHeader>
        <CardContent>
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">View-only — need planning edit permission to submit.</p>
          ) : (
            <form onSubmit={submitStaff} className="grid max-w-xl gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-fill-form">Form</Label>
                <NamedSelect
                  id="staff-fill-form"
                  value={fillFormId}
                  onChange={(id) => { setFillFormId(id); setPayload({}) }}
                  placeholder="Select form"
                  options={forms
                    .filter((f) => f.is_active && f.status !== 'archived')
                    .map((f) => ({ value: f.id, label: f.name }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={pushPlanning} onChange={(e) => setPushPlanning(e.target.checked)} />
                Push to planning board
              </label>
              {pushPlanning && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="staff-fill-list">Planning list</Label>
                  <NamedSelect
                    id="staff-fill-list"
                    value={listId}
                    onChange={setListId}
                    placeholder="Select list"
                    options={(lists || []).map((l) => ({ value: l.id, label: l.title || 'Untitled list' }))}
                  />
                </div>
              )}
              <DynamicFields fields={activeForm?.fields || []} values={payload} onChange={setPayload} />
              <Button type="submit" className="w-fit cursor-pointer" disabled={!activeForm}>Submit</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editor.id ? 'Edit form' : 'New form'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveForm} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sf-name">Name</Label>
                <Input id="sf-name" required value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Select
                  value={editor.kind}
                  onValueChange={(kind) => setEditor({
                    ...editor,
                    kind,
                    fields: editor.id ? editor.fields : templateFields(kind),
                  })}
                >
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORM_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={editor.status} onValueChange={(status) => setEditor({ ...editor, status })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sf-event">Attach to event (optional)</Label>
                <NamedSelect
                  id="sf-event"
                  value={editor.event_id || ''}
                  onChange={(v) => setEditor({ ...editor, event_id: v })}
                  emptyLabel="No event"
                  options={events.map((ev) => ({ value: ev.id, label: ev.title }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sf-desc">Description</Label>
              <Textarea id="sf-desc" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={editor.public_enabled}
                onChange={(e) => setEditor({ ...editor, public_enabled: e.target.checked })}
              />
              <Link2 className="size-4 text-muted-foreground" />
              Public shareable link (anyone with the URL can answer when Published)
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Fields</p>
              <FieldBuilder
                fields={editor.fields}
                onChange={(fields) => setEditor({ ...editor, fields })}
                disabled={!canEdit}
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() =>
                  setPreviewForm({
                    ...editor,
                    kind: editor.kind,
                    fields: editor.fields,
                    name: editor.name || 'Untitled form',
                    description: editor.description,
                    slug: forms.find((f) => f.id === editor.id)?.slug,
                    public_enabled: editor.public_enabled,
                    status: editor.status,
                  })
                }
              >
                <Eye className="size-3.5" /> Preview
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button type="submit" className="cursor-pointer" disabled={saving}>{saving ? 'Saving…' : 'Save form'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewForm)} onOpenChange={(open) => !open && setPreviewForm(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Customer preview · {previewForm?.name || 'Form'}</DialogTitle>
          </DialogHeader>
          {previewForm ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                <span>How customers see this form</span>
                <div className="flex flex-wrap gap-2">
                  {previewForm.slug && previewForm.public_enabled && previewForm.status === 'published' ? (
                    <Button size="sm" variant="outline" className="cursor-pointer" asChild>
                      <a href={shareFormUrl(previewForm.slug)} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Open live
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs">Publish + enable public link for a live URL</span>
                  )}
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setPreviewForm(null)}>
                    Close
                  </Button>
                </div>
              </div>
              <BrandedOpsForm form={previewForm} preview values={{}} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Results · {resultsForm?.name || 'Form'}</DialogTitle>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SUBMISSION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {resultsForm?.slug && (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => copyShare(resultsForm)}>Copy share link</Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Answers</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultsRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(row.created_at).toLocaleString()}
                    {row.calendar_at && (
                      <div className="text-xs text-muted-foreground">
                        Cal {new Date(row.calendar_at).toLocaleString()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{row.respondent_label || '—'}</TableCell>
                  <TableCell className="capitalize">{row.source}</TableCell>
                  <TableCell>
                    <Select value={row.status || 'new'} onValueChange={(status) => setSubmissionStatus(row.id, status)} disabled={!canEdit}>
                      <SelectTrigger className="h-8 w-32 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBMISSION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-[16rem] whitespace-pre-wrap text-xs text-muted-foreground">
                    {formatFormPayloadDescription(row.payload || {})}
                  </TableCell>
                  <TableCell>{row.plan_card_id ? <Badge variant="secondary">Card</Badge> : null}</TableCell>
                </TableRow>
              ))}
              {!resultsRows.length && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No submissions for this filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  )
}
