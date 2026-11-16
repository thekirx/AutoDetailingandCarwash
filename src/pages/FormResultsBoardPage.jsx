import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '@/styles/formResultsBoard.css'
import {
  Calendar,
  CalendarRange,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Filter,
  Kanban,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { useAuth } from '@/auth/AuthProvider'
import { canEditDeleteFormResults, getBranchScopeList } from '@/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { NamedSelect } from '@/components/ui/named-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { listBranches } from '@/lib/adminApi'
import {
  DATE_FILTER_PRESETS,
  FORM_RESULT_KIND_TABS,
  buildSubmissionAnswerRows,
  eventQuickResultsSlug,
  filterFormResultItems,
  groupResultsByStatus,
  normalizeEventRegistrationItem,
  normalizeSubmissionItem,
  permanentFormResultsPath,
  resolveFormResultTarget,
} from '@/lib/formResults'
import {
  deleteEventRegistrationAsOwner,
  deleteFormSubmissionAsOwner,
  fetchFormResultsSnapshot,
  updateEventRegistrationAsOwner,
  updateFormSubmissionAsOwner,
} from '@/lib/formResultsApi'
import {
  DEFAULT_FORM_LOGO,
  SUBMISSION_STATUSES,
  filterFormBranchSlugs,
  formKindLabel,
  formatBranchSlugLabel,
  normalizeFormSettings,
  shareFormUrl,
  withLiveBranchOptions,
} from '@/lib/opsForms'
import { supabase } from '@/lib/supabase'

const EMPTY_FILTERS = Object.freeze({
  query: '',
  status: 'all',
  source: 'all',
  branch: 'all',
  dateField: 'created',
  datePreset: 'all',
  dateFrom: '',
  dateTo: '',
})

function statusBadgeVariant(status) {
  if (status === 'resolved') return 'default'
  if (status === 'archived') return 'outline'
  return 'secondary'
}

function statusLabel(status) {
  return SUBMISSION_STATUSES.find((s) => s.value === status)?.label || 'New'
}

export default function FormResultsBoardPage() {
  const { formSlug } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isOwner = canEditDeleteFormResults(profile)
  const scopeList = getBranchScopeList(profile)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [forms, setForms] = useState([])
  const [events, setEvents] = useState([])
  const [branches, setBranches] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [eventRegistrations, setEventRegistrations] = useState([])

  const [kindTab, setKindTab] = useState('all')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [viewMode, setViewMode] = useState('board')
  const [activeItem, setActiveItem] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState({ respondentLabel: '', status: 'new', calendarAt: '', payload: {} })
  const [saving, setSaving] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [snapshot, branchList] = await Promise.all([
        fetchFormResultsSnapshot(),
        listBranches().catch(() => []),
      ])
      setForms(snapshot?.forms || [])
      setEvents(snapshot?.events || [])
      setSubmissions(snapshot?.submissions || [])
      setEventRegistrations(snapshot?.eventRegistrations || [])
      setBranches(branchList || [])
    } catch (err) {
      toast.error(err?.message || 'Could not load form results.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      ?.channel?.('form-results-board-live')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'ops_form_submissions' }, () => {
        load({ silent: true })
      })
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations' }, () => {
        load({ silent: true })
      })
      ?.subscribe?.()
    return () => {
      if (channel) supabase?.removeChannel?.(channel)
    }
  }, [load])

  const targetScope = useMemo(
    () => resolveFormResultTarget(formSlug, { forms, events }),
    [formSlug, forms, events],
  )

  useEffect(() => {
    if (formSlug && targetScope.kindTab !== 'all') {
      setKindTab(targetScope.kindTab)
    } else if (!formSlug) {
      setKindTab((prev) => prev || 'all')
    }
  }, [formSlug, targetScope.kindTab])

  const allItems = useMemo(() => {
    const formsById = new Map((forms || []).map((f) => [f.id, f]))
    const eventsById = new Map((events || []).map((e) => [e.id, e]))
    const eventsByFormId = new Map((events || []).filter((e) => e.form_id).map((e) => [e.form_id, e]))

    const normalizedSubs = (submissions || []).map((row) =>
      normalizeSubmissionItem(row, { formsById, eventsById, eventsByFormId, branches }),
    )
    const normalizedRegs = (eventRegistrations || []).map((row) =>
      normalizeEventRegistrationItem(row, { eventsById, branches }),
    )

    return [...normalizedSubs, ...normalizedRegs].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
  }, [forms, events, branches, submissions, eventRegistrations])

  const availableBranchSlugs = useMemo(() => {
    const baseSlugs = filterFormBranchSlugs(branches)
    if (!Array.isArray(scopeList)) return baseSlugs
    const allowed = new Set(scopeList.map((s) => String(s || '').toLowerCase()))
    const filtered = baseSlugs.filter((s) => allowed.has(s))
    return filtered.length ? filtered : baseSlugs
  }, [branches, scopeList])

  const formPills = useMemo(() => {
    const pills = []
    const seen = new Set()
    const countMap = new Map()
    for (const item of allItems) {
      countMap.set(item.formKey, (countMap.get(item.formKey) || 0) + 1)
    }

    for (const f of forms) {
      if (kindTab !== 'all' && f.kind !== kindTab) continue
      const key = f.slug || f.id
      if (!key || seen.has(key)) continue
      seen.add(key)
      pills.push({
        key,
        id: f.id,
        label: f.name,
        kind: f.kind,
        count: countMap.get(key) || 0,
      })
    }

    if (kindTab === 'all' || kindTab === 'event') {
      for (const ev of events) {
        const quickKey = eventQuickResultsSlug(ev)
        const quickCount = countMap.get(quickKey) || 0
        if (!quickKey || seen.has(quickKey)) continue
        if (!ev.form_id || quickCount > 0) {
          seen.add(quickKey)
          pills.push({
            key: quickKey,
            id: ev.id,
            label: `${ev.title} (RSVP)`,
            kind: 'event',
            count: quickCount,
          })
        }
      }
    }

    return pills
  }, [forms, events, allItems, kindTab])

  const activeFormKey = formSlug ? targetScope.formKey : 'all'

  const filteredItems = useMemo(
    () =>
      filterFormResultItems(allItems, {
        kindTab,
        formKey: activeFormKey,
        status: filters.status,
        source: filters.source,
        branch: filters.branch,
        dateField: filters.dateField,
        datePreset: filters.datePreset,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        query: filters.query,
      }),
    [allItems, kindTab, activeFormKey, filters],
  )

  const boardColumns = useMemo(() => groupResultsByStatus(filteredItems), [filteredItems])

  const tabCounts = useMemo(() => {
    const withoutKind = filterFormResultItems(allItems, {
      kindTab: 'all',
      formKey: 'all',
      status: filters.status,
      source: filters.source,
      branch: filters.branch,
      dateField: filters.dateField,
      datePreset: filters.datePreset,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      query: filters.query,
    })
    const map = { all: withoutKind.length }
    for (const item of withoutKind) {
      map[item.formKind] = (map[item.formKind] || 0) + 1
    }
    return map
  }, [allItems, filters])

  const kindTabs = useMemo(
    () =>
      FORM_RESULT_KIND_TABS.map((t) => ({
        ...t,
        badge: tabCounts[t.id] || 0,
      })),
    [tabCounts],
  )

  const hasActiveFilters = Boolean(
    filters.query ||
      filters.status !== 'all' ||
      filters.source !== 'all' ||
      filters.branch !== 'all' ||
      filters.datePreset !== 'all' ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.dateField !== 'created',
  )

  function handleKindChange(nextKind) {
    setKindTab(nextKind)
    if (formSlug) {
      navigate(permanentFormResultsPath(''))
    }
  }

  function openDetail(item) {
    setActiveItem(item)
    setEditing(false)
    setEditDraft({
      respondentLabel: item.respondentLabel || '',
      status: item.status || 'new',
      calendarAt: item.calendarAt ? String(item.calendarAt).slice(0, 16) : '',
      payload: { ...(item.payload || {}) },
    })
  }

  async function copyPermanentUrl(path, key = 'url') {
    const full = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(full)
      setCopiedKey(key)
      toast.success('Permanent results link copied')
      setTimeout(() => setCopiedKey(''), 1800)
    } catch {
      toast.message(full)
    }
  }

  async function handleStatusUpdate(item, nextStatus) {
    if (!isOwner) {
      toast.error('Only Owner can edit or delete form responses.')
      return
    }
    if (item.recordType !== 'submission') {
      toast.message('Event quick RSVPs remain in New lane; edit contact answers or delete if needed.')
      return
    }
    setSaving(true)
    try {
      await updateFormSubmissionAsOwner({ id: item.id, status: nextStatus })
      toast.success(`Moved to ${statusLabel(nextStatus)}`)
      setActiveItem((prev) => (prev?.id === item.id ? { ...prev, status: nextStatus } : prev))
      setEditDraft((prev) => ({ ...prev, status: nextStatus }))
      await load({ silent: true })
    } catch (err) {
      toast.error(err?.message || 'Could not update status.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!isOwner || !activeItem) {
      toast.error('Only Owner can edit or delete form responses.')
      return
    }
    setSaving(true)
    try {
      if (activeItem.recordType === 'event_registration') {
        await updateEventRegistrationAsOwner({
          id: activeItem.id,
          name: editDraft.payload.name ?? editDraft.respondentLabel,
          phone: editDraft.payload.phone || '',
          email: editDraft.payload.email || '',
        })
      } else {
        await updateFormSubmissionAsOwner({
          id: activeItem.id,
          status: editDraft.status,
          respondent_label: editDraft.respondentLabel,
          calendar_at: editDraft.calendarAt || null,
          payload: editDraft.payload,
        })
      }
      toast.success('Response updated')
      setEditing(false)
      setActiveItem((prev) =>
        prev
          ? {
              ...prev,
              respondentLabel:
                activeItem.recordType === 'event_registration'
                  ? editDraft.payload.name || prev.respondentLabel
                  : editDraft.respondentLabel || prev.respondentLabel,
              status: activeItem.recordType === 'submission' ? editDraft.status : prev.status,
              calendarAt:
                activeItem.recordType === 'submission' && editDraft.calendarAt
                  ? new Date(editDraft.calendarAt).toISOString()
                  : prev.calendarAt,
              payload: { ...editDraft.payload },
            }
          : null,
      )
      await load({ silent: true })
    } catch (err) {
      toast.error(err?.message || 'Could not save edits.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteItem(item) {
    if (!isOwner || !item) {
      toast.error('Only Owner can edit or delete form responses.')
      return
    }
    if (!window.confirm(`Permanently delete submission from "${item.respondentLabel}"?`)) return
    setSaving(true)
    try {
      if (item.recordType === 'event_registration') {
        await deleteEventRegistrationAsOwner(item.id)
      } else {
        await deleteFormSubmissionAsOwner(item.id)
      }
      toast.success('Response deleted')
      setActiveItem(null)
      await load({ silent: true })
    } catch (err) {
      toast.error(err?.message || 'Could not delete response.')
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = formSlug ? targetScope.label : 'Forms Results Board'
  const pageDescription = formSlug
    ? `Permanent archive of every answer submitted to ${targetScope.label}. Click any card to inspect the entire completed form.`
    : 'Permanent archive across Events RSVP, Feedback, Detailing, Equipment repairs, Cash advances, and Custom forms.'
  const permanentUrlPath = permanentFormResultsPath(formSlug || '')

  return (
    <OpsPageShell
      className="frb-page"
      eyebrow="Permanent results archive"
      title={pageTitle}
      description={pageDescription}
      icon={ClipboardList}
      breadcrumbs={[
        { label: 'Planner & Forms', to: '/operations/planning?tab=forms' },
        ...(formSlug ? [{ label: 'All Results', to: '/operations/forms/results' }] : []),
        { label: formSlug ? targetScope.label : 'Forms Results Board' },
      ]}
      meta={
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-foreground tabular-nums">{filteredItems.length}</span>
          <span>showing of {allItems.length} permanent responses</span>
          {!isOwner ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              · <Lock className="size-3" aria-hidden /> Owner-only edit/delete
            </span>
          ) : null}
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => copyPermanentUrl(permanentUrlPath, 'page')}
          >
            {copiedKey === 'page' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy permanent link
          </Button>
          {targetScope.form?.slug && targetScope.form?.public_enabled && targetScope.form?.status === 'published' ? (
            <Button type="button" variant="outline" size="sm" className="min-h-11" asChild>
              <a href={shareFormUrl(targetScope.form.slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                Open public form
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={refreshing}
            onClick={() => load({ silent: true })}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      {/* Kind sub-tabs */}
      <Tabs value={kindTab} onValueChange={handleKindChange} className="min-w-0 w-full gap-4">
        <OpsTabList tabs={kindTabs} aria-label="Filter results by form kind" className="max-w-full" />

        {/* Individual permanent form selector strip */}
        {formPills.length > 0 ? (
          <div className="frb-form-strip" role="navigation" aria-label="Specific forms in category">
            <Link
              to={permanentFormResultsPath('')}
              className={`frb-form-pill ${!formSlug ? 'is-active' : ''}`}
            >
              <span>All in {kindTab === 'all' ? 'archive' : formKindLabel(kindTab)}</span>
              <span className="frb-form-pill-count">{tabCounts[kindTab] || 0}</span>
            </Link>
            {formPills.map((pill) => (
              <Link
                key={pill.key}
                to={permanentFormResultsPath(pill.key)}
                className={`frb-form-pill ${activeFormKey === pill.key ? 'is-active' : ''}`}
              >
                <span className="truncate">{pill.label}</span>
                <span className="frb-form-pill-count">{pill.count}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {/* Search + Multi-dimensional Filters */}
        <section className="frb-filter-bar" aria-label="Search and date filters">
          <div className="frb-filter-top">
            <div className="frb-search-wrap">
              <Search className="frb-search-icon size-4" aria-hidden />
              <Input
                value={filters.query}
                onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                placeholder="Search name, phone, plate, event, form answers…"
                className="min-h-11 pl-9 pr-9"
                aria-label="Search all form answers"
              />
              {filters.query ? (
                <button
                  type="button"
                  className="frb-search-clear"
                  aria-label="Clear search"
                  onClick={() => setFilters((prev) => ({ ...prev, query: '' }))}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="frb-filter-selects">
              <NamedSelect
                value={filters.status}
                onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
                className="min-h-11 w-full sm:w-40"
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...SUBMISSION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />

              {availableBranchSlugs.length > 0 ? (
                <NamedSelect
                  value={filters.branch}
                  onChange={(branch) => setFilters((prev) => ({ ...prev, branch }))}
                  className="min-h-11 w-full sm:w-40"
                  options={[
                    { value: 'all', label: 'All branches' },
                    ...availableBranchSlugs.map((slug) => ({
                      value: slug,
                      label: formatBranchSlugLabel(slug, branches),
                    })),
                  ]}
                />
              ) : null}

              <NamedSelect
                value={filters.source}
                onChange={(source) => setFilters((prev) => ({ ...prev, source }))}
                className="min-h-11 w-full sm:w-36"
                options={[
                  { value: 'all', label: 'All sources' },
                  { value: 'public', label: 'Public link' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />

              <div className="frb-view-switch" role="group" aria-label="Results view layout">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'board' ? 'default' : 'ghost'}
                  className="min-h-9"
                  onClick={() => setViewMode('board')}
                >
                  <Kanban className="size-3.5" /> Board
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  className="min-h-9"
                  onClick={() => setViewMode('table')}
                >
                  <Table2 className="size-3.5" /> Table
                </Button>
              </div>
            </div>
          </div>

          <div className="frb-filter-dates">
            <div className="frb-date-presets" role="group" aria-label="Date range presets">
              <span className="frb-filter-label">
                <CalendarRange className="size-3.5" aria-hidden /> Dates
              </span>
              {DATE_FILTER_PRESETS.filter((p) => p.id !== 'custom').map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`frb-preset-chip ${
                    !filters.dateFrom && !filters.dateTo && filters.datePreset === preset.id ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      datePreset: preset.id,
                      dateFrom: '',
                      dateTo: '',
                    }))
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="frb-date-range-inputs">
              <NamedSelect
                value={filters.dateField}
                onChange={(dateField) => setFilters((prev) => ({ ...prev, dateField }))}
                className="min-h-11 w-full sm:w-44"
                options={[
                  { value: 'created', label: 'Submitted date' },
                  { value: 'calendar', label: 'Event / schedule date' },
                ]}
              />
              <label className="frb-date-field">
                <span>From</span>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      datePreset: 'custom',
                      dateFrom: e.target.value,
                    }))
                  }
                  aria-label="Filter from date"
                />
              </label>
              <label className="frb-date-field">
                <span>To</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      datePreset: 'custom',
                      dateTo: e.target.value,
                    }))
                  }
                  aria-label="Filter to date"
                />
              </label>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  <Filter className="size-3.5" /> Reset filters
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Results Canvas: Board or Table */}
        {loading ? (
          <div className="frb-board-cols">
            {SUBMISSION_STATUSES.map((col) => (
              <section key={col.value} className="frb-board-col">
                <div className="frb-col-head">
                  <h2>{col.label}</h2>
                </div>
                <span className="planner-skel h-28" />
                <span className="planner-skel h-28" />
              </section>
            ))}
          </div>
        ) : !filteredItems.length ? (
          <div className="frb-empty-state">
            <ClipboardList className="size-8 text-primary" aria-hidden />
            <h3>No stored responses match this view</h3>
            <p>
              {hasActiveFilters
                ? 'Try clearing your search, branch filter, or date range to see all permanently saved submissions.'
                : 'Completed answers submitted from public /f/ links, event pages, or staff forms appear here automatically.'}
            </p>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : viewMode === 'board' ? (
          <div className="frb-board-cols">
            {boardColumns.map((col) => (
              <section key={col.id} className="frb-board-col" data-status={col.id}>
                <header className="frb-col-head">
                  <h2>{col.label}</h2>
                  <span className="frb-col-count tabular-nums">{col.items.length}</span>
                </header>
                <div className="frb-col-cards">
                  {col.items.map((item) => {
                    const previewRows = buildSubmissionAnswerRows(item).slice(0, 3)
                    return (
                      <button
                        key={`${item.recordType}-${item.id}`}
                        type="button"
                        className="frb-card planner-ticket"
                        data-status={item.status}
                        onClick={() => openDetail(item)}
                      >
                        <div className="frb-card-top">
                          <span className="frb-card-kind">{item.formName}</span>
                          <span className="frb-card-source">{item.source}</span>
                        </div>
                        <strong className="frb-card-title">{item.respondentLabel}</strong>
                        {item.contactHint ? <span className="frb-card-contact">{item.contactHint}</span> : null}
                        <div className="frb-card-badges">
                          <Badge variant="outline" className="text-[10px]">
                            {item.formKindLabel}
                          </Badge>
                          {item.branchLabel ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.branchLabel}
                            </Badge>
                          ) : null}
                          {item.eventTitle ? (
                            <Badge variant="secondary" className="max-w-full truncate text-[10px]">
                              {item.eventTitle}
                            </Badge>
                          ) : null}
                        </div>
                        {previewRows.length > 0 ? (
                          <dl className="frb-card-preview">
                            {previewRows.map((row) => (
                              <div key={row.key} className="frb-card-preview-row">
                                <dt>{row.label}</dt>
                                <dd>{row.displayValue}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        <footer className="frb-card-foot">
                          <span>
                            <Calendar className="size-3" aria-hidden />
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="frb-card-open">View full form →</span>
                        </footer>
                      </button>
                    )
                  })}
                  {!col.items.length ? (
                    <p className="frb-col-empty">No {col.label.toLowerCase()} answers</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="planner-v2-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Respondent</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Answers summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={`${item.recordType}-${item.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(item)}
                  >
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                      {item.calendarAt ? (
                        <div className="text-muted-foreground">
                          Event {new Date(item.calendarAt).toLocaleDateString()}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.formName}</div>
                      <div className="text-xs text-muted-foreground">{item.formKindLabel}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.respondentLabel}</div>
                      {item.contactHint ? <div className="text-xs text-muted-foreground">{item.contactHint}</div> : null}
                    </TableCell>
                    <TableCell>
                      {item.branchLabel ? (
                        <Badge variant="outline" className="text-xs">{item.branchLabel}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {buildSubmissionAnswerRows(item)
                        .map((r) => `${r.label}: ${r.displayValue}`)
                        .join(' · ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Tabs>

      {/* Card Click Modal -> Shows the WHOLE Form + Owner-only Edit & Delete */}
      <Dialog
        open={Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveItem(null)
            setEditing(false)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {activeItem ? (
            <>
              <DialogHeader className="frb-modal-hero">
                <div className="frb-modal-brand">
                  <span className="frb-modal-logo-wrap">
                    <img
                      src={activeItem.settings?.logo_url || DEFAULT_FORM_LOGO}
                      alt="Hakum Auto Care"
                      width={88}
                      height={26}
                      className="object-contain"
                    />
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{activeItem.formKindLabel}</Badge>
                    <Badge variant={statusBadgeVariant(activeItem.status)}>{statusLabel(activeItem.status)}</Badge>
                    <Badge variant="outline" className="capitalize">{activeItem.source}</Badge>
                    {activeItem.branchLabel ? <Badge variant="outline">{activeItem.branchLabel}</Badge> : null}
                  </div>
                </div>
                <DialogTitle className="mt-2 text-xl">{activeItem.formName}</DialogTitle>
                <DialogDescription>
                  {activeItem.formDescription || `Completed submission by ${activeItem.respondentLabel}.`}
                </DialogDescription>
                <div className="frb-modal-meta-strip">
                  <span>
                    Submitted: <strong>{new Date(activeItem.createdAt).toLocaleString()}</strong>
                  </span>
                  {activeItem.calendarAt ? (
                    <span>
                      Schedule / Event date: <strong>{new Date(activeItem.calendarAt).toLocaleString()}</strong>
                    </span>
                  ) : null}
                  {activeItem.eventTitle ? (
                    <span>
                      Event: <strong>{activeItem.eventTitle}</strong>
                    </span>
                  ) : null}
                </div>
              </DialogHeader>

              {!isOwner ? (
                <div className="frb-readonly-banner" role="note">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  <span>Read-only inspection. Only Owner (BossMich) can edit or permanently delete submitted responses.</span>
                </div>
              ) : (
                <div className="frb-owner-bar">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeItem.recordType === 'submission' ? (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="frb-status-select" className="text-xs font-semibold uppercase tracking-wide">
                          Lane
                        </Label>
                        <NamedSelect
                          id="frb-status-select"
                          disabled={saving}
                          value={activeItem.status}
                          onChange={(nextStatus) => handleStatusUpdate(activeItem, nextStatus)}
                          className="h-9 w-36 xl:h-9"
                          options={SUBMISSION_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                        />
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={editing ? 'secondary' : 'outline'}
                      disabled={saving}
                      onClick={() => setEditing((v) => !v)}
                    >
                      <Pencil className="size-3.5" />
                      {editing ? 'Cancel editing' : 'Edit full form answers'}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={saving}
                    onClick={() => handleDeleteItem(activeItem)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete permanently
                  </Button>
                </div>
              )}

              {editing && isOwner ? (
                <form onSubmit={handleSaveEdit} className="grid gap-4">
                  {activeItem.recordType === 'submission' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="frb-edit-respondent">Respondent label</Label>
                        <Input
                          id="frb-edit-respondent"
                          value={editDraft.respondentLabel}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, respondentLabel: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="frb-edit-calendar">Schedule / event date</Label>
                        <Input
                          id="frb-edit-calendar"
                          type="datetime-local"
                          value={editDraft.calendarAt}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, calendarAt: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {buildSubmissionAnswerRows(activeItem).map((row) => {
                      const val = editDraft.payload?.[row.key]
                      const enrichedField = withLiveBranchOptions(
                        [{ key: row.key, label: row.label, type: row.type, options: row.options }],
                        availableBranchSlugs,
                      )[0]
                      return (
                        <div
                          key={row.key}
                          className={`flex flex-col gap-1.5 ${row.type === 'textarea' ? 'sm:col-span-2' : ''}`}
                        >
                          <Label htmlFor={`frb-edit-${row.key}`}>{row.label}</Label>
                          {row.type === 'checkbox' ? (
                            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                              <input
                                id={`frb-edit-${row.key}`}
                                type="checkbox"
                                checked={Boolean(val)}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    payload: { ...prev.payload, [row.key]: e.target.checked },
                                  }))
                                }
                              />
                              <span>Checked</span>
                            </label>
                          ) : row.type === 'textarea' ? (
                            <Textarea
                              id={`frb-edit-${row.key}`}
                              value={val ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  payload: { ...prev.payload, [row.key]: e.target.value },
                                }))
                              }
                            />
                          ) : row.type === 'select' && enrichedField?.options?.length ? (
                            <Select
                              value={String(val || '')}
                              onValueChange={(nextVal) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  payload: { ...prev.payload, [row.key]: nextVal },
                                }))
                              }
                            >
                              <SelectTrigger id={`frb-edit-${row.key}`}>
                                <SelectValue placeholder="Choose option" />
                              </SelectTrigger>
                              <SelectContent>
                                {enrichedField.options.map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={`frb-edit-${row.key}`}
                              type={row.type === 'number' ? 'number' : row.type === 'date' ? 'date' : 'text'}
                              value={val ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({
                                  ...prev,
                                  payload: { ...prev.payload, [row.key]: e.target.value },
                                }))
                              }
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <FullFormAnswerView
                  item={activeItem}
                  copiedKey={copiedKey}
                  onCopyLink={() => copyPermanentUrl(activeItem.permanentResultsPath, 'modal')}
                />
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </OpsPageShell>
  )
}

function FullFormAnswerView({ item, copiedKey, onCopyLink }) {
  const rows = buildSubmissionAnswerRows(item)
  const settings = normalizeFormSettings(item.settings, item.formKind)
  const hasSteps = settings.layout === 'wizard' && settings.steps?.length > 0

  const stepGroups = hasSteps
    ? [
        ...settings.steps.map((step) => ({
          id: step.id,
          title: step.title,
          hint: step.hint,
          rows: rows.filter((r) => r.step === step.id),
        })),
        {
          id: '__other',
          title: 'Additional details',
          hint: '',
          rows: rows.filter((r) => !settings.steps.some((s) => s.id === r.step)),
        },
      ].filter((g) => g.rows.length > 0)
    : [{ id: 'all', title: 'Complete form responses', hint: '', rows }]

  return (
    <div className="frb-full-form">
      {stepGroups.map((group) => (
        <section key={group.id} className="frb-form-section">
          {stepGroups.length > 1 || group.title !== 'Complete form responses' ? (
            <header className="frb-form-section-head">
              <h3>{group.title}</h3>
              {group.hint ? <p>{group.hint}</p> : null}
            </header>
          ) : null}
          <dl className="frb-answer-grid">
            {group.rows.map((row) => (
              <div
                key={row.key}
                className={`frb-answer-cell ${
                  row.type === 'textarea' || row.displayValue.length > 72 ? 'is-wide' : ''
                }`}
              >
                <dt>
                  <span>{row.label}</span>
                  {row.required ? <em className="frb-req-tag">Required</em> : null}
                </dt>
                <dd>{row.displayValue}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <footer className="frb-modal-foot">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Submission ID: <code>{item.id}</code></span>
          {item.planCardId ? (
            <Link to={`/operations/planning?tab=board&card=${item.planCardId}`} className="text-primary underline">
              Open linked Planner task →
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCopyLink}>
            {copiedKey === 'modal' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Permanent form results link
          </Button>
          {item.shareUrl ? (
            <Button type="button" size="sm" variant="ghost" asChild>
              <a href={item.shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Public /f/{item.formSlug}
              </a>
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
