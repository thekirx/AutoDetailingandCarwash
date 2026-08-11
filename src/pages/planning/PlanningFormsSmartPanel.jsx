import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Pencil,
  Plus,
  QrCode,
  Trash2,
} from 'lucide-react'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import { useAuth } from '@/auth/AuthProvider'
import {
  canManageOpsFormTemplates,
  canSubmitOpsFormKind,
} from '@/auth/permissions'
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
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  DEFAULT_FORM_LOGO,
  FIELD_TYPES,
  FIXED_FORM_TEMPLATES,
  FORM_KINDS,
  FORM_STATUSES,
  SUBMISSION_STATUSES,
  extractCalendarAt,
  extractComplaintBranch,
  formKindLabel,
  formQrImageUrl,
  formatFormPayloadDescription,
  normalizeFields,
  normalizeFormSettings,
  shareFormUrl,
  submissionTitle,
  templateFields,
  validatePayload,
} from '@/lib/opsForms'
import { toast } from 'sonner'

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

async function notifyComplaintIfNeeded(form, payload, submissionId) {
  if (form?.kind !== 'complaint') return
  try {
    const token = await getAccessTokenFresh().catch(() => null)
    await fetch('/api/notify-ops-form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        slug: form.slug,
        form_name: form.name,
        payload,
        submission_id: submissionId || null,
        branch: extractComplaintBranch(payload),
      }),
    })
  } catch {
    // ponytail: notify is best-effort; submission already saved
  }
}

function emptyEditorFromForm(form) {
  const kind = form?.kind || 'complaint'
  return {
    id: form?.id || null,
    name: form?.name || '',
    kind,
    description: form?.description || '',
    status: form?.status || 'published',
    public_enabled: Boolean(form?.public_enabled),
    event_id: form?.event_id || '',
    fields: normalizeFields(form?.fields?.length ? form.fields : templateFields(kind)),
    settings: normalizeFormSettings(form?.settings, kind),
    slug: form?.slug || '',
  }
}

export default function PlanningFormsSmartPanel({ canEdit, lists }) {
  const { profile } = useAuth()
  const manageTemplates = canEdit && canManageOpsFormTemplates(profile)
  const [forms, setForms] = useState([])
  const [events, setEvents] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [kindFilter, setKindFilter] = useState('equipment_repair')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState(() => emptyEditorFromForm(null))
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
        .in('kind', FORM_KINDS.map((k) => k.value))
        .neq('status', 'archived')
        .order('created_at', { ascending: true }),
      supabase
        .from('ops_form_submissions')
        .select('id, form_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at, ops_forms ( name, kind, slug )')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('events').select('id, title, slug, starts_at').order('starts_at', { ascending: false }).limit(80),
    ])
    if (f.error) toast.error(f.error.message)
    else {
      const rows = f.data || []
      setForms(rows)
      const preferred = rows.find((r) => r.kind === kindFilter) || rows[0]
      if (preferred && !rows.some((r) => r.id === fillFormId)) setFillFormId(preferred.id)
    }
    if (s.error) toast.error(s.error.message)
    else setSubmissions(s.data || [])
    if (!e.error) setEvents(e.data || [])
    if (!listId && lists?.[0]?.id) setListId(lists[0].id)
  }, [fillFormId, kindFilter, listId, lists])

  useEffect(() => { load() }, [load])

  const templatesByKind = useMemo(() => {
    const map = new Map()
    for (const def of FIXED_FORM_TEMPLATES) {
      const live = forms.find((f) => f.kind === def.kind) || forms.find((f) => f.slug === def.slug)
      map.set(def.kind, live || null)
    }
    return map
  }, [forms])

  const selectedTemplate = templatesByKind.get(kindFilter) || null
  const fillableForms = useMemo(
    () => forms.filter((f) => f.is_active && f.status !== 'archived' && canSubmitOpsFormKind(profile, f.kind)),
    [forms, profile],
  )
  const activeForm = fillableForms.find((f) => f.id === fillFormId) || fillableForms[0]
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

  useEffect(() => {
    if (activeForm && fillFormId !== activeForm.id) setFillFormId(activeForm.id)
  }, [activeForm, fillFormId])

  function openEdit(form) {
    if (!form) return toast.error('Template not seeded yet - run the latest migration')
    setEditor(emptyEditorFromForm(form))
    setEditorOpen(true)
  }

  async function saveForm(e) {
    e.preventDefault()
    if (!manageTemplates || !editor.id) return
    const name = editor.name.trim()
    if (!name) return toast.error('Name is required')
    const fields = normalizeFields(editor.fields)
    if (!fields.length) return toast.error('Add at least one field')
    setSaving(true)
    const settings = normalizeFormSettings(editor.settings, editor.kind)
    const row = {
      name,
      kind: editor.kind,
      description: editor.description.trim() || null,
      status: editor.status,
      public_enabled: Boolean(editor.public_enabled),
      event_id: editor.event_id || null,
      fields,
      settings,
      is_active: editor.status !== 'archived',
      slug: editor.slug || forms.find((f) => f.id === editor.id)?.slug,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('ops_forms').update(row).eq('id', editor.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Template saved')
      setEditorOpen(false)
      load()
    }
  }

  async function copyShare(form) {
    if (!form?.slug) return toast.error('Form has no share slug yet')
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
    if (!activeForm || !canSubmitOpsFormKind(profile, activeForm.kind)) {
      return toast.error('You cannot submit this form kind')
    }
    const errors = validatePayload(activeForm.fields, payload)
    if (errors[0]) return toast.error(errors[0])
    const calendarAt = extractCalendarAt(activeForm.fields, payload)
    let planCardId = null
    if (pushPlanning && listId && manageTemplates) {
      const title = submissionTitle(activeForm, payload)
      const { data: card, error: cardErr } = await supabase
        .from('plan_cards')
        .insert({
          list_id: listId,
          title: title.slice(0, 200),
          description: formatFormPayloadDescription(payload),
          due_at: calendarAt,
          position: Date.now() % 1_000_000,
          labels:
            activeForm.kind === 'complaint'
              ? [{ name: 'Complaint', color: '#38bdf8' }]
              : activeForm.kind === 'equipment_repair'
                ? [{ name: 'Equipment', color: '#f59e0b' }]
                : activeForm.kind === 'cash_advance'
                  ? [{ name: 'Cash advance', color: '#22c55e' }]
                  : [],
        })
        .select('id')
        .single()
      if (cardErr) return toast.error(cardErr.message)
      planCardId = card.id
    }
    const { data: inserted, error } = await supabase
      .from('ops_form_submissions')
      .insert({
        form_id: activeForm.id,
        payload,
        plan_card_id: planCardId,
        due_at: calendarAt,
        calendar_at: calendarAt,
        respondent_label: payload.customer_name || payload.name || payload.employee_name || null,
        source: 'staff',
        status: 'new',
      })
      .select('id')
      .single()
    if (error) toast.error(error.message)
    else {
      await notifyComplaintIfNeeded(activeForm, payload, inserted?.id)
      toast.success(planCardId ? 'Submitted and added to Tasks' : 'Submission saved')
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

  const shareUrl = selectedTemplate?.slug ? shareFormUrl(selectedTemplate.slug) : ''
  const qrUrl = formQrImageUrl(shareUrl, 180)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Forms</h2>
        <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
          Four company forms. Edit the wording, then share a link or fill one here.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="form-kind-filter">Which form</Label>
        <NamedSelect
          id="form-kind-filter"
          value={kindFilter}
          onChange={setKindFilter}
          options={FORM_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{selectedTemplate?.name || formKindLabel(kindFilter)}</CardTitle>
            <CardDescription>
              {selectedTemplate
                ? `${formKindLabel(selectedTemplate.kind)} · ${selectedTemplate.status}${
                    selectedTemplate.public_enabled ? ' · public link on' : ''
                  }`
                : 'Template missing - apply the latest Supabase migration'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTemplate && (
              <>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setPreviewForm(selectedTemplate)}>
                  <Eye className="size-3.5" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    setResultsFormId(selectedTemplate.id)
                    setResultsOpen(true)
                    setStatusFilter('all')
                  }}
                >
                  <Link2 className="size-3.5" /> Results ({countsByForm.get(selectedTemplate.id) || 0})
                </Button>
                {manageTemplates && (
                  <Button size="sm" className="cursor-pointer" onClick={() => openEdit(selectedTemplate)}>
                    <Pencil className="size-3.5" /> Edit template
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{selectedTemplate?.description || 'No description yet.'}</p>
            {shareUrl ? (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Shareable link</p>
                <p className="break-all font-mono text-xs text-foreground">{shareUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => copyShare(selectedTemplate)}>
                    <Copy className="size-3.5" /> Copy link
                  </Button>
                  {selectedTemplate?.public_enabled && selectedTemplate?.status === 'published' ? (
                    <Button size="sm" variant="ghost" className="cursor-pointer" asChild>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Open
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Publish + enable public link for live answers</span>
                  )}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Access: Complaint + Events RSVP are shareable when published.
              Equipment repairs are crew-only.
              Cash advance is for employees except Super Admin (who still edits everything).
            </p>
          </div>
          {qrUrl ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3">
              <QrCode className="size-4 text-muted-foreground" aria-hidden />
              <img src={qrUrl} alt={`QR code for ${selectedTemplate?.name || 'form'}`} width={180} height={180} className="rounded-lg bg-white p-2" />
              <p className="text-center text-xs text-muted-foreground">Scan to open the form link</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {fillableForms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fill a form</CardTitle>
            <CardDescription>
              Use the form you are allowed to submit
              {manageTemplates ? '. Tick Add a Planner card if this should also appear on Tasks.' : '.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitStaff} className="grid max-w-xl gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-fill-form">Form</Label>
                <NamedSelect
                  id="staff-fill-form"
                  value={activeForm?.id || ''}
                  onChange={(id) => { setFillFormId(id); setPayload({}) }}
                  placeholder="Select form"
                  options={fillableForms.map((f) => ({ value: f.id, label: f.name }))}
                />
              </div>
              {manageTemplates && (
                <>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={pushPlanning} onChange={(e) => setPushPlanning(e.target.checked)} />
                    Add a Planner card
                  </label>
                  {pushPlanning && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="staff-fill-list">Which column</Label>
                      <NamedSelect
                        id="staff-fill-list"
                        value={listId}
                        onChange={setListId}
                        placeholder="Select list"
                        options={(lists || []).map((l) => ({ value: l.id, label: l.title || 'Untitled list' }))}
                      />
                    </div>
                  )}
                </>
              )}
              <DynamicFields fields={activeForm?.fields || []} values={payload} onChange={setPayload} />
              <Button type="submit" className="w-fit cursor-pointer" disabled={!activeForm}>Submit</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit template · {formKindLabel(editor.kind)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveForm} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sf-name">Name</Label>
                <Input id="sf-name" required value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Input value={formKindLabel(editor.kind)} disabled readOnly />
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
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="sf-header">Header title (optional override)</Label>
                <Input
                  id="sf-header"
                  value={editor.settings?.header_title || ''}
                  onChange={(e) => setEditor({
                    ...editor,
                    settings: { ...editor.settings, header_title: e.target.value },
                  })}
                  placeholder={editor.name || 'Uses form name'}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="sf-logo">Logo URL</Label>
                <Input
                  id="sf-logo"
                  value={editor.settings?.logo_url || DEFAULT_FORM_LOGO}
                  onChange={(e) => setEditor({
                    ...editor,
                    settings: { ...editor.settings, logo_url: e.target.value },
                  })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={editor.settings?.show_logo !== false}
                  onChange={(e) => setEditor({
                    ...editor,
                    settings: { ...editor.settings, show_logo: e.target.checked },
                  })}
                />
                Show logo on form
              </label>
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
            {editor.slug ? (
              <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-muted/20 p-3">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Link + QR</p>
                  <p className="break-all font-mono text-xs">{shareFormUrl(editor.slug)}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2 cursor-pointer" onClick={() => copyShare({ ...editor, public_enabled: editor.public_enabled, status: editor.status })}>
                    <Copy className="size-3.5" /> Copy link
                  </Button>
                </div>
                <img
                  src={formQrImageUrl(shareFormUrl(editor.slug), 140)}
                  alt="Form QR"
                  width={140}
                  height={140}
                  className="rounded-lg bg-white p-1"
                />
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Fields</p>
              <FieldBuilder
                fields={editor.fields}
                onChange={(fields) => setEditor({ ...editor, fields })}
                disabled={!manageTemplates}
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
                    slug: editor.slug,
                    public_enabled: editor.public_enabled,
                    status: editor.status,
                    settings: editor.settings,
                  })
                }
              >
                <Eye className="size-3.5" /> Preview
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button type="submit" className="cursor-pointer" disabled={saving || !editor.id}>{saving ? 'Saving…' : 'Save template'}</Button>
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
                <span>How people see this form</span>
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
          <div className="planning-event-list">
            {resultsRows.map((row) => (
              <article key={`m-${row.id}`} className="planning-event-card">
                <div>
                  <h3>{row.respondent_label || 'No name'}</h3>
                  <p>{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <div className="planning-event-card-meta">
                  <Badge variant="secondary" className="capitalize">{row.source}</Badge>
                  {row.plan_card_id ? <Badge variant="secondary">On Tasks</Badge> : null}
                </div>
                <Select value={row.status || 'new'} onValueChange={(status) => setSubmissionStatus(row.id, status)} disabled={!manageTemplates}>
                  <SelectTrigger className="h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="whitespace-pre-wrap">{formatFormPayloadDescription(row.payload || {})}</p>
              </article>
            ))}
            {!resultsRows.length ? <p className="text-sm text-muted-foreground">No submissions for this filter.</p> : null}
          </div>
          <div className="planning-event-table">
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
                    <Select value={row.status || 'new'} onValueChange={(status) => setSubmissionStatus(row.id, status)} disabled={!manageTemplates}>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
