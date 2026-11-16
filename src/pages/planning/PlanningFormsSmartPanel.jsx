import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  GripVertical,
  Link2,
  Lock,
  RotateCcw,
} from 'lucide-react'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import FormQrCard from '@/components/FormQrCard'
import { useAuth } from '@/auth/AuthProvider'
import {
  canApproveCashAdvance,
  canEditDeleteFormResults,
  canManageOpsFormTemplates,
  canSubmitOpsFormKind,
  getBranchScopeList,
} from '@/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { notifyOpsEvent } from '@/lib/opsEventNotify'
import { listBranches } from '@/lib/adminApi'
import { permanentFormResultsPath } from '@/lib/formResults'
import { updateFormSubmissionAsOwner } from '@/lib/formResultsApi'
import {
  FIELD_TYPES,
  FORM_KINDS,
  SUBMISSION_STATUSES,
  extractCalendarAt,
  extractComplaintBranch,
  extractSubmissionBranch,
  filterFormBranchSlugs,
  filterSubmissionsByBranchScope,
  formatBranchSlugLabel,
  formKindLabel,
  formatFormPayloadDescription,
  moveFormField,
  normalizeFields,
  normalizeFormSettings,
  shareFormUrl,
  submissionTitle,
  validatePayload,
  withLiveBranchOptions,
} from '@/lib/opsForms'
import { toast } from 'sonner'
import { enrichCashAdvancePayload } from '@/lib/payroll'

const ACTIVE_FORM_KINDS = FORM_KINDS.filter((k) => k.value !== 'event')
const FIELD_TYPE_LABELS = new Map(FIELD_TYPES.map((t) => [t.value, t.label]))

function fieldSignature(fields) {
  return normalizeFields(fields)
    .map((f) => f.key)
    .join(',')
}

function FixedSequenceList({ fields, steps = null, disabled, onReorder }) {
  const rows = normalizeFields(fields)
  const [dragIndex, setDragIndex] = useState(null)

  const groupFor = (field) => {
    if (!Array.isArray(steps) || !steps.length) return 0
    const idx = steps.findIndex((s) => s.id === field.step)
    return idx >= 0 ? idx : 0
  }

  const displayed = rows
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (steps ? groupFor(a.field) - groupFor(b.field) || a.index - b.index : a.index - b.index))

  return (
    <div className="flex flex-col gap-2">
      {displayed.map(({ field, index }, displayIndex) => {
        const groupIdx = groupFor(field)
        const showStepHeader =
          steps && (displayIndex === 0 || groupFor(displayed[displayIndex - 1].field) !== groupIdx)
        const prevInGroup = rows.slice(0, index).findLastIndex((f) => !steps || groupFor(f) === groupIdx)
        const nextOffset = rows.slice(index + 1).findIndex((f) => !steps || groupFor(f) === groupIdx)
        const nextInGroup = nextOffset >= 0 ? index + 1 + nextOffset : -1

        return (
          <Fragment key={field.key}>
            {showStepHeader && (
              <h4 className="mt-2 text-xs font-bold uppercase tracking-wide text-primary">
                Step {groupIdx + 1} · {steps[groupIdx]?.title}
              </h4>
            )}
            <div
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                if (!disabled && dragIndex !== null) e.preventDefault()
              }}
              onDrop={() => {
                if (!disabled && dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index)
                }
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition-colors ${
                dragIndex === index ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {!disabled && (
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {displayIndex + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{FIELD_TYPE_LABELS.get(field.type) || field.type}</span>
                    {field.required ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                        Required
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              {!disabled && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9 cursor-pointer"
                    aria-label={`Move ${field.label} up`}
                    disabled={prevInGroup < 0}
                    onClick={() => onReorder(index, prevInGroup)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9 cursor-pointer"
                    aria-label={`Move ${field.label} down`}
                    disabled={nextInGroup < 0}
                    onClick={() => onReorder(index, nextInGroup)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </Fragment>
        )
      })}
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No fixed fields configured for this form.</p>
      ) : null}
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
              options={(field.options || []).map((opt) => ({
                value: opt,
                label: field.key === 'branch' ? formatBranchSlugLabel(opt) : opt,
              }))}
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

export default function PlanningFormsSmartPanel({ canEdit, lists, resultsId }) {
  const { profile } = useAuth()
  const manageTemplates = canEdit && canManageOpsFormTemplates(profile)
  const canEditDeleteSubmissions = canEditDeleteFormResults(profile)
  const approveCash = canApproveCashAdvance(profile)
  const scopeList = getBranchScopeList(profile)
  const [forms, setForms] = useState([])
  const [branchSlugs, setBranchSlugs] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [kindFilter, setKindFilter] = useState('detailing')
  const [selectedFormId, setSelectedFormId] = useState('')
  const [draftFields, setDraftFields] = useState([])
  const [draftPublicEnabled, setDraftPublicEnabled] = useState(false)
  const [resultsFormId, setResultsFormId] = useState('')
  const [resultsOpen, setResultsOpen] = useState(false)
  const [previewForm, setPreviewForm] = useState(null)
  const [fillFormId, setFillFormId] = useState('')
  const [payload, setPayload] = useState({})
  const [listId, setListId] = useState('')
  const [pushPlanning, setPushPlanning] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  const load = useCallback(async () => {
    const [f, s, branches] = await Promise.all([
      supabase
        .from('ops_forms')
        .select('id, name, kind, fields, is_active, slug, description, status, public_enabled, settings, created_at')
        .in('kind', ACTIVE_FORM_KINDS.map((k) => k.value))
        .neq('status', 'archived')
        .order('created_at', { ascending: true }),
      supabase
        .from('ops_form_submissions')
        .select('id, form_id, payload, plan_card_id, due_at, calendar_at, status, source, respondent_label, created_at, ops_forms ( name, kind, slug )')
        .order('created_at', { ascending: false })
        .limit(200),
      listBranches().catch(() => []),
    ])
    const slugs = filterFormBranchSlugs(branches || [])
    setBranchSlugs(slugs)
    if (f.error) toast.error(f.error.message)
    else {
      const rows = (f.data || []).filter((r) => r.kind !== 'event')
      setForms(rows)
      const preferred = rows.find((r) => r.kind === kindFilter) || rows[0]
      if (preferred && !rows.some((r) => r.id === fillFormId)) setFillFormId(preferred.id)
    }
    if (s.error) toast.error(s.error.message)
    else setSubmissions(s.data || [])
    if (!listId && lists?.[0]?.id) setListId(lists[0].id)
  }, [fillFormId, kindFilter, listId, lists])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!resultsId) return
    setResultsFormId(resultsId)
    setResultsOpen(true)
  }, [resultsId])

  const formsForKind = useMemo(
    () => forms.filter((f) => f.kind === kindFilter),
    [forms, kindFilter],
  )

  const selectedTemplate = useMemo(
    () => formsForKind.find((f) => f.id === selectedFormId) || formsForKind[0] || null,
    [formsForKind, selectedFormId],
  )

  useEffect(() => {
    if (selectedTemplate && selectedFormId !== selectedTemplate.id) {
      setSelectedFormId(selectedTemplate.id)
    }
  }, [selectedTemplate, selectedFormId])

  useEffect(() => {
    if (!selectedTemplate) {
      setDraftFields([])
      setDraftPublicEnabled(false)
      return
    }
    setDraftFields(normalizeFields(selectedTemplate.fields || []))
    setDraftPublicEnabled(Boolean(selectedTemplate.public_enabled))
  }, [selectedTemplate])

  const availableBranchSlugs = useMemo(() => {
    if (!Array.isArray(scopeList)) return branchSlugs
    const allowed = new Set(scopeList.map((s) => String(s || '').toLowerCase()))
    const filtered = branchSlugs.filter((s) => allowed.has(String(s || '').toLowerCase()))
    return filtered.length ? filtered : branchSlugs
  }, [branchSlugs, scopeList])

  const selectedSettings = useMemo(
    () => (selectedTemplate ? normalizeFormSettings(selectedTemplate.settings, selectedTemplate.kind) : null),
    [selectedTemplate],
  )

  const isDirty = useMemo(() => {
    if (!selectedTemplate) return false
    return (
      fieldSignature(draftFields) !== fieldSignature(selectedTemplate.fields || []) ||
      draftPublicEnabled !== Boolean(selectedTemplate.public_enabled)
    )
  }, [draftFields, draftPublicEnabled, selectedTemplate])

  const livePreviewForm = useMemo(() => {
    if (!selectedTemplate) return null
    return {
      ...selectedTemplate,
      public_enabled: draftPublicEnabled,
      fields: withLiveBranchOptions(draftFields, branchSlugs),
      settings: selectedSettings,
    }
  }, [selectedTemplate, draftPublicEnabled, draftFields, branchSlugs, selectedSettings])

  const fillableForms = useMemo(
    () => forms.filter((f) => f.is_active && f.status !== 'archived' && f.kind !== 'event' && canSubmitOpsFormKind(profile, f.kind)),
    [forms, profile],
  )
  const activeForm = fillableForms.find((f) => f.id === fillFormId) || fillableForms[0]
  const activeFormFields = useMemo(
    () => withLiveBranchOptions(activeForm?.fields || [], availableBranchSlugs),
    [activeForm, availableBranchSlugs],
  )
  const scopedSubmissions = useMemo(
    () => filterSubmissionsByBranchScope(submissions, { branchFilter, scopeList }),
    [submissions, branchFilter, scopeList],
  )
  const resultsForm = forms.find((f) => f.id === resultsFormId)
  const resultsRows = useMemo(() => {
    let rows = scopedSubmissions.filter((s) => s.form_id === resultsFormId)
    if (statusFilter !== 'all') rows = rows.filter((s) => s.status === statusFilter)
    return rows
  }, [scopedSubmissions, resultsFormId, statusFilter])

  const countsByForm = useMemo(() => {
    const map = new Map()
    for (const s of scopedSubmissions) map.set(s.form_id, (map.get(s.form_id) || 0) + 1)
    return map
  }, [scopedSubmissions])

  useEffect(() => {
    if (activeForm && fillFormId !== activeForm.id) setFillFormId(activeForm.id)
  }, [activeForm, fillFormId])

  function handleReorder(fromIndex, toIndex) {
    if (!manageTemplates) return
    const steps = selectedSettings?.layout === 'wizard' ? selectedSettings.steps : null
    setDraftFields((current) => moveFormField(current, fromIndex, toIndex, steps))
  }

  function resetDraftOrder() {
    if (!selectedTemplate) return
    setDraftFields(normalizeFields(selectedTemplate.fields || []))
    setDraftPublicEnabled(Boolean(selectedTemplate.public_enabled))
  }

  async function saveSequence({ publish = null } = {}) {
    if (!manageTemplates || !selectedTemplate?.id) return
    const nextFields = normalizeFields(draftFields)
    if (!nextFields.length) return toast.error('No fields to save')
    setSaving(true)

    const nextStatus = publish === true ? 'published' : publish === false ? 'draft' : selectedTemplate.status
    const settings = normalizeFormSettings(selectedTemplate.settings, selectedTemplate.kind)
    if (nextStatus === 'published' && draftPublicEnabled) {
      settings.slug_locked = true
    }

    const updateRow = {
      fields: nextFields,
      public_enabled: Boolean(draftPublicEnabled),
      status: nextStatus,
      is_active: nextStatus !== 'archived',
      settings,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('ops_forms')
      .update(updateRow)
      .eq('id', selectedTemplate.id)

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setForms((current) =>
      current.map((f) => (f.id === selectedTemplate.id ? { ...f, ...updateRow } : f)),
    )
    toast.success(
      publish === true
        ? 'Input sequence saved & form published'
        : publish === false
          ? 'Form moved to draft'
          : 'Input sequence saved',
    )
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
    const errors = validatePayload(activeFormFields, payload)
    if (errors[0]) return toast.error(errors[0])
    const calendarAt = extractCalendarAt(activeFormFields, payload)
    const submitPayload =
      activeForm.kind === 'cash_advance' ? enrichCashAdvancePayload(payload, profile) : payload
    let planCardId = null
    if (pushPlanning && listId && manageTemplates) {
      const title = submissionTitle(activeForm, submitPayload)
      const { data: card, error: cardErr } = await supabase
        .from('plan_cards')
        .insert({
          list_id: listId,
          title: title.slice(0, 200),
          description: formatFormPayloadDescription(submitPayload),
          due_at: calendarAt,
          position: Date.now() % 1_000_000,
          labels:
            activeForm.kind === 'complaint'
              ? [{ name: 'Complaint', color: '#38bdf8' }]
              : activeForm.kind === 'equipment_repair'
                ? [{ name: 'Equipment', color: '#f59e0b' }]
                : activeForm.kind === 'cash_advance'
                  ? [{ name: 'Cash advance', color: '#22c55e' }]
                  : activeForm.kind === 'detailing'
                    ? [{ name: 'Detailing', color: '#8b5cf6' }]
                    : activeForm.kind === 'custom'
                      ? [{ name: 'Custom', color: getComputedStyle(document.documentElement).getPropertyValue('--color-form-custom').trim() }]
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
        payload: submitPayload,
        plan_card_id: planCardId,
        due_at: calendarAt,
        calendar_at: calendarAt,
        respondent_label:
          submitPayload.customer_name ||
          submitPayload.name ||
          submitPayload.employee_name ||
          null,
        source: 'staff',
        status: 'new',
      })
      .select('id')
      .single()
    if (error) toast.error(error.message)
    else {
      await notifyComplaintIfNeeded(activeForm, submitPayload, inserted?.id)
      if (activeForm.kind === 'cash_advance') notifyOpsEvent('cash_advance_submitted', inserted?.id)
      toast.success(planCardId ? 'Submitted and added to Tasks' : 'Submission saved')
      setPayload({})
      load()
    }
  }

  async function decideCashAdvance(id, action) {
    const { data, error } = await supabase.rpc('approve_cash_advance', { payload: { id, action } })
    if (error) toast.error(error.message)
    else if (action === 'approve') {
      notifyOpsEvent('cash_advance_approved', id)
      toast.success(`Approved. Code ${data?.approval_code}. The branch admin types it on the Daily Sheet.`)
      load()
    } else {
      toast.success('Declined. No cash leaves the drawer.')
      load()
    }
  }

  async function setSubmissionStatus(id, status) {
    if (!canEditDeleteSubmissions) {
      toast.error('Only Owner can edit form results.')
      return
    }
    try {
      await updateFormSubmissionAsOwner(id, { status })
      toast.success(`Marked ${status}`)
      load()
    } catch (err) {
      toast.error(err.message || 'Could not update status')
    }
  }

  const shareUrl = selectedTemplate?.slug ? shareFormUrl(selectedTemplate.slug) : ''
  const permanentResultsHref = selectedTemplate
    ? permanentFormResultsPath(selectedTemplate.slug || selectedTemplate.id)
    : '/operations/forms/results'

  return (
    <div className="planner-forms flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Forms</h2>
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
            Fixed operational forms. Questions and slugs are locked; rearrange input order, check the real-time preview, then save and publish.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-10 cursor-pointer" asChild>
          <Link to="/operations/forms/results">
            <ClipboardList className="size-4" /> Form Results Board
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:max-w-2xl sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="form-kind-filter">Which form</Label>
          <NamedSelect
            id="form-kind-filter"
            value={kindFilter}
            onChange={setKindFilter}
            options={ACTIVE_FORM_KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
        </div>
        {formsForKind.length > 1 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="fixed-form-pick">Form</Label>
            <NamedSelect
              id="fixed-form-pick"
              value={selectedTemplate?.id || ''}
              onChange={setSelectedFormId}
              options={formsForKind.map((f) => ({ value: f.id, label: f.name }))}
            />
          </div>
        )}
        {availableBranchSlugs.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-branch-filter">Branch scope</Label>
            <NamedSelect
              id="form-branch-filter"
              value={branchFilter}
              onChange={setBranchFilter}
              options={[
                { value: 'all', label: 'All branches' },
                ...availableBranchSlugs.map((slug) => ({
                  value: slug,
                  label: formatBranchSlugLabel(slug),
                })),
              ]}
            />
          </div>
        )}
      </div>

      <Card className="planner-ticket">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{selectedTemplate?.name || formKindLabel(kindFilter)}</CardTitle>
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" /> Fixed
              </Badge>
              {selectedTemplate ? (
                <Badge variant={selectedTemplate.status === 'published' ? 'default' : 'secondary'} className="capitalize">
                  {selectedTemplate.status}
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              {selectedTemplate
                ? `${formKindLabel(selectedTemplate.kind)} · ${selectedTemplate.status}${
                    draftPublicEnabled ? ' · public link on' : ''
                  }${selectedTemplate.slug ? ` · /f/${selectedTemplate.slug}` : ''}`
                : 'No fixed form seeded for this category yet.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTemplate && (
              <>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setPreviewForm(livePreviewForm)}>
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
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{selectedTemplate?.description || 'Fixed operational form.'}</p>
              {shareUrl ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Permanent share link</p>
                  <p className="break-all font-mono text-xs text-foreground">{shareUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => copyShare({ ...selectedTemplate, public_enabled: draftPublicEnabled })}>
                      <Copy className="size-3.5" /> Copy link
                    </Button>
                    <Button size="sm" variant="outline" className="cursor-pointer" asChild>
                      <Link to={permanentResultsHref}>
                        <ClipboardList className="size-3.5" /> Results board
                      </Link>
                    </Button>
                    {selectedTemplate?.public_enabled && selectedTemplate?.status === 'published' ? (
                      <Button size="sm" variant="ghost" className="cursor-pointer" asChild>
                        <a href={shareUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" /> Open
                        </a>
                      </Button>
                    ) : (
                      <span className="self-center text-xs text-muted-foreground">Save & Publish with public link on for live answers</span>
                    )}
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Input labels, types, and slugs are fixed. Use Up/Down or drag rows to rearrange sequence, then Save &amp; Publish.
              </p>
            </div>
            {shareUrl ? <FormQrCard url={shareUrl} title={selectedTemplate?.name || 'form'} size={180} /> : null}
          </div>

          {selectedTemplate && (
            <div className="grid gap-6 border-t border-border pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <section aria-label="Input sequence" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Input sequence</h3>
                    <p className="text-xs text-muted-foreground">
                      {manageTemplates ? 'Drag or use Up / Down to change question order.' : 'Read-only fixed field sequence.'}
                    </p>
                  </div>
                  {isDirty && manageTemplates ? (
                    <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={resetDraftOrder} disabled={saving}>
                      <RotateCcw className="size-3.5" /> Reset order
                    </Button>
                  ) : null}
                </div>

                <FixedSequenceList
                  fields={draftFields}
                  steps={selectedSettings?.layout === 'wizard' ? selectedSettings.steps : null}
                  disabled={!manageTemplates || saving}
                  onReorder={handleReorder}
                />

                {manageTemplates && (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                    <label className="flex min-h-9 items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={draftPublicEnabled}
                        disabled={saving}
                        onChange={(e) => setDraftPublicEnabled(e.target.checked)}
                      />
                      <Link2 className="size-4 text-muted-foreground" />
                      Public shareable link enabled
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={saving || !isDirty}
                        onClick={() => saveSequence()}
                      >
                        {saving ? 'Saving…' : 'Save order'}
                      </Button>
                      <Button
                        type="button"
                        className="cursor-pointer"
                        disabled={saving}
                        onClick={() => saveSequence({ publish: true })}
                      >
                        {saving ? 'Publishing…' : 'Save & Publish'}
                      </Button>
                      {selectedTemplate.status === 'published' && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="cursor-pointer"
                          disabled={saving}
                          onClick={() => saveSequence({ publish: false })}
                        >
                          Unpublish
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section aria-label="Real-time preview" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Real-time preview</h3>
                    <p className="text-xs text-muted-foreground">Updates immediately as you rearrange inputs.</p>
                  </div>
                  {isDirty ? <Badge variant="secondary">Unsaved order</Badge> : null}
                </div>
                <BrandedOpsForm form={livePreviewForm} preview values={{}} />
              </section>
            </div>
          )}
        </CardContent>
      </Card>

      {fillableForms.length > 0 && (
        <Card className="planner-ticket">
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
              <DynamicFields fields={activeFormFields} values={payload} onChange={setPayload} />
              <Button type="submit" className="w-fit cursor-pointer" disabled={!activeForm}>Submit</Button>
            </form>
          </CardContent>
        </Card>
      )}

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
                    <span className="text-xs">Save & Publish with public link for a live URL</span>
                  )}
                  <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setPreviewForm(null)}>
                    Close
                  </Button>
                </div>
              </div>
              <BrandedOpsForm
                form={
                  previewForm
                    ? { ...previewForm, fields: withLiveBranchOptions(previewForm.fields, branchSlugs) }
                    : null
                }
                preview
                values={{}}
              />
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
            {availableBranchSlugs.length > 0 && (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {availableBranchSlugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>{formatBranchSlugLabel(slug)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {resultsForm?.slug && (
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => copyShare(resultsForm)}>Copy share link</Button>
            )}
            {resultsForm ? (
              <Button type="button" variant="outline" className="cursor-pointer" asChild>
                <Link to={permanentFormResultsPath(resultsForm.slug || resultsForm.id)}>
                  <ClipboardList className="size-3.5" /> Open Permanent Results Board
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="planning-event-list">
            {resultsRows.map((row) => {
              const rowBranch = extractSubmissionBranch(row)
              return (
              <article key={`m-${row.id}`} className="planning-event-card">
                <div>
                  <h3>{row.respondent_label || 'No name'}</h3>
                  <p>{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <div className="planning-event-card-meta">
                  <Badge variant="secondary" className="capitalize">{row.source}</Badge>
                  {rowBranch ? <Badge variant="outline">{formatBranchSlugLabel(rowBranch)}</Badge> : null}
                  {row.plan_card_id ? <Badge variant="secondary">On Tasks</Badge> : null}
                </div>
                <Select value={row.status || 'new'} onValueChange={(status) => setSubmissionStatus(row.id, status)} disabled={!canEditDeleteSubmissions}>
                  <SelectTrigger className="h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {resultsForm?.kind === 'cash_advance' && row.payload?.approval_code ? (
                  <p className="font-medium">Code {row.payload.approval_code}</p>
                ) : null}
                {resultsForm?.kind === 'cash_advance' && approveCash && !row.payload?.approval_code ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="min-h-11" onClick={() => decideCashAdvance(row.id, 'approve')}>Approve</Button>
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => decideCashAdvance(row.id, 'decline')}>Decline</Button>
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap">{formatFormPayloadDescription(row.payload || {})}</p>
              </article>
              )
            })}
            {!resultsRows.length ? <p className="text-sm text-muted-foreground">No submissions for this filter.</p> : null}
          </div>
          <div className="planning-event-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Answers</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultsRows.map((row) => {
                const rowBranch = extractSubmissionBranch(row)
                return (
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
                  <TableCell>
                    {rowBranch ? (
                      <Badge variant="outline" className="text-xs">{formatBranchSlugLabel(rowBranch)}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{row.source}</TableCell>
                  <TableCell>
                    <Select value={row.status || 'new'} onValueChange={(status) => setSubmissionStatus(row.id, status)} disabled={!canEditDeleteSubmissions}>
                      <SelectTrigger className="h-8 w-32 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBMISSION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-[16rem] whitespace-pre-wrap text-xs text-muted-foreground">
                    {resultsForm?.kind === 'cash_advance' && row.payload?.approval_code ? (
                      <p className="mb-1 font-medium text-foreground">Code {row.payload.approval_code}</p>
                    ) : null}
                    {resultsForm?.kind === 'cash_advance' && approveCash && !row.payload?.approval_code ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" className="min-h-11" onClick={() => decideCashAdvance(row.id, 'approve')}>Approve</Button>
                        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => decideCashAdvance(row.id, 'decline')}>Decline</Button>
                      </div>
                    ) : null}
                    {formatFormPayloadDescription(row.payload || {})}
                  </TableCell>
                  <TableCell>{row.plan_card_id ? <Badge variant="secondary">Card</Badge> : null}</TableCell>
                </TableRow>
                )
              })}
              {!resultsRows.length && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">No submissions for this filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
