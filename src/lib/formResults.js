import {
  DETAILING_BOARD_STATUSES,
  SALES_BOARD_STATUSES,
  detailingBoardStatusLabel,
} from './detailingBoardStatuses.js'
import {
  FORM_KINDS,
  SUBMISSION_STATUSES,
  extractSubmissionBranch,
  formKindLabel,
  formatBranchSlugLabel,
  normalizeFields,
  normalizeFormSettings,
  shareFormUrl,
} from './opsForms.js'

export const FORM_RESULT_KIND_TABS = Object.freeze([
  { id: 'all', label: 'All forms' },
  ...FORM_KINDS.map((k) => ({ id: k.value, label: k.label })),
])

export const DATE_FILTER_PRESETS = Object.freeze([
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Date range' },
])

export const VALID_DETAILING_BOARD_STATUSES = Object.freeze([
  ...new Set([...SALES_BOARD_STATUSES, 'no_show', 'for_releasing']),
])

export const DETAILING_RESULT_COLUMNS = Object.freeze([
  ...DETAILING_BOARD_STATUSES.map((s) => ({ id: s.id, label: s.label })),
  { id: 'cancelled', label: 'Cancelled' },
])

export function bookingStatusToSubmissionStatus(bookingStatus) {
  const s = String(bookingStatus || 'pending').trim()
  if (s === 'completed') return 'resolved'
  if (s === 'cancelled' || s === 'no_show') return 'archived'
  if (s === 'pending' || !s) return 'new'
  return 'in_review'
}

export function submissionStatusToDetailingDefault(subStatus) {
  const s = String(subStatus || 'new').trim()
  if (s === 'resolved') return 'completed'
  if (s === 'archived') return 'cancelled'
  if (s === 'in_review') return 'confirmed'
  return 'pending'
}

export function formResultStatusLabel(status, formKind = '') {
  const key = String(status || '')
  if (formKind === 'detailing' || VALID_DETAILING_BOARD_STATUSES.includes(key)) {
    if (key === 'cancelled') return 'Cancelled'
    if (key === 'redo') return 'Redo'
    if (key === 'no_show') return 'No show'
    const detailingLabel = detailingBoardStatusLabel(key, { detailing: true })
    if (detailingLabel) return detailingLabel
  }
  return SUBMISSION_STATUSES.find((s) => s.value === key)?.label || 'New'
}

export function permanentFormResultsPath(formSlugOrKey = '') {
  const clean = String(formSlugOrKey || '').trim()
  return clean ? `/operations/forms/results/${encodeURIComponent(clean)}` : '/operations/forms/results'
}

function localDayStartMs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime()
}

function localDayEndMs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).getTime()
}

/** True when `isoTimestamp` falls inside the chosen preset or custom local-day range. */
export function matchesDateRange(isoTimestamp, { datePreset = 'all', dateFrom = '', dateTo = '' } = {}, now = new Date()) {
  const effectiveFrom = String(dateFrom || '').trim()
  const effectiveTo = String(dateTo || '').trim()
  const hasManualRange = Boolean(effectiveFrom || effectiveTo)
  if (!hasManualRange && (!datePreset || datePreset === 'all')) return true
  if (!isoTimestamp) return false

  const ts = new Date(isoTimestamp).getTime()
  if (Number.isNaN(ts)) return false

  let minMs = null
  let maxMs = null

  if (hasManualRange) {
    minMs = effectiveFrom ? localDayStartMs(effectiveFrom) : null
    maxMs = effectiveTo ? localDayEndMs(effectiveTo) : null
    if (minMs != null && maxMs != null && minMs > maxMs) {
      minMs = localDayStartMs(effectiveTo)
      maxMs = localDayEndMs(effectiveFrom)
    }
  } else {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
    if (datePreset === 'today') {
      minMs = startOfToday
      maxMs = endOfToday
    } else if (datePreset === '7d') {
      minMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime()
      maxMs = endOfToday
    } else if (datePreset === '30d') {
      minMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0).getTime()
      maxMs = endOfToday
    } else if (datePreset === 'month') {
      minMs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
      maxMs = endOfToday
    }
  }

  if (minMs != null && ts < minMs) return false
  if (maxMs != null && ts > maxMs) return false
  return true
}

export function normalizeSubmissionItem(row, { formsById, eventsById, eventsByFormId, bookingsById, branches = [] } = {}) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  const form = formsById?.get(row.form_id) || row.ops_forms || null
  const formKind = form?.kind || 'custom'
  const isDetailing = formKind === 'detailing'
  const formSlug = form?.slug || row.form_id || ''
  const linkedEvent =
    (form?.event_id && eventsById?.get(form.event_id)) ||
    eventsByFormId?.get(row.form_id) ||
    null
  const bookingId = row.booking_id || payload.booking_id || null
  const linkedBooking = row.linked_booking || (bookingId ? bookingsById?.get?.(bookingId) : null) || null
  const settings = normalizeFormSettings(form?.settings, formKind)
  const fields = normalizeFields(form?.fields || [])
  const branch = extractSubmissionBranch(row)
  const respondentLabel =
    String(
      row.respondent_label ||
        payload.customer_name ||
        payload.name ||
        payload.full_name ||
        payload.employee_name ||
        '',
    ).trim() || 'Guest respondent'
  const contactHint = String(
    payload.phone || payload.mobile || payload.email || payload.plate || payload.car_model || '',
  ).trim()

  const baseSubStatus = SUBMISSION_STATUSES.some((s) => s.value === row.status) ? row.status : 'new'
  const liveBookingStatus = [linkedBooking?.status, row.booking_status, payload.booking_status].find((candidate) =>
    VALID_DETAILING_BOARD_STATUSES.includes(String(candidate || '')),
  )
  const status = isDetailing
    ? liveBookingStatus || submissionStatusToDetailingDefault(baseSubStatus)
    : baseSubStatus
  const submissionStatus = isDetailing ? bookingStatusToSubmissionStatus(status) : baseSubStatus

  return {
    id: row.id,
    recordType: 'submission',
    formId: row.form_id || form?.id || null,
    formKey: formSlug,
    formSlug: form?.slug || '',
    formName: form?.name || 'Form',
    formDescription: form?.description || '',
    formKind,
    formKindLabel: formKindLabel(formKind),
    isDetailing,
    bookingId: linkedBooking?.id || bookingId || null,
    linkedBooking,
    eventId: linkedEvent?.id || form?.event_id || null,
    eventTitle: linkedEvent?.title || '',
    eventSlug: linkedEvent?.slug || '',
    status,
    submissionStatus,
    source: row.source === 'public' ? 'public' : 'staff',
    branch: linkedBooking?.branch || branch,
    branchLabel: (linkedBooking?.branch || branch) ? formatBranchSlugLabel(linkedBooking?.branch || branch, branches) : '',
    respondentLabel,
    contactHint,
    payload,
    fields,
    settings,
    shareUrl: form?.slug ? shareFormUrl(form.slug) : '',
    permanentResultsPath: permanentFormResultsPath(formSlug),
    createdAt: row.created_at,
    calendarAt: linkedBooking?.scheduled_start || row.calendar_at || null,
    dueAt: row.due_at || null,
    planCardId: row.plan_card_id || null,
  }
}

/** Resolve `:formSlug` URL param into form target so `/operations/forms/results/:formSlug` stays permanent. */
export function resolveFormResultTarget(formSlugParam, { forms = [], events = [] } = {}) {
  const param = String(formSlugParam || '').trim()
  if (!param) {
    return { formKey: 'all', kindTab: 'all', label: 'All forms', form: null, event: null }
  }
  const matchedForm = (forms || []).find((f) => f.slug === param || f.id === param)
  if (matchedForm) {
    return {
      formKey: matchedForm.slug || matchedForm.id,
      kindTab: matchedForm.kind || 'custom',
      label: matchedForm.name,
      form: matchedForm,
      event: (events || []).find((e) => e.id === matchedForm.event_id || e.form_id === matchedForm.id) || null,
    }
  }
  return { formKey: param, kindTab: 'all', label: param, form: null, event: null }
}

function searchHaystack(item) {
  const fieldLabels = (item.fields || []).map((f) => f.label).join(' ')
  const payloadParts = Object.entries(item.payload || {})
    .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : String(v ?? '')}`)
    .join(' ')
  return [
    item.id,
    item.respondentLabel,
    item.contactHint,
    item.formName,
    item.formSlug,
    item.formKindLabel,
    item.eventTitle,
    item.branchLabel,
    item.status,
    item.source,
    fieldLabels,
    payloadParts,
  ]
    .join(' ')
    .toLowerCase()
}

export function filterFormResultItems(
  items = [],
  {
    kindTab = 'all',
    formKey = 'all',
    status = 'all',
    source = 'all',
    branch = 'all',
    dateField = 'created',
    datePreset = 'all',
    dateFrom = '',
    dateTo = '',
    query = '',
  } = {},
  now = new Date(),
) {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  return (items || []).filter((item) => {
    if (kindTab && kindTab !== 'all' && item.formKind !== kindTab) return false
    if (formKey && formKey !== 'all' && item.formKey !== formKey && item.formId !== formKey) return false
    if (status && status !== 'all' && item.status !== status && item.submissionStatus !== status) return false
    if (source && source !== 'all' && item.source !== source) return false
    if (branch && branch !== 'all' && item.branch !== branch) return false
    const dateValue = dateField === 'calendar' ? item.calendarAt : item.createdAt
    if (!matchesDateRange(dateValue, { datePreset, dateFrom, dateTo }, now)) return false
    if (terms.length) {
      const hay = searchHaystack(item)
      if (!terms.every((term) => hay.includes(term))) return false
    }
    return true
  })
}

const DETAILING_COLUMN_ALIAS = {
  redo: 'in_progress',
  for_releasing: 'final_checking',
  no_show: 'cancelled',
}

export function groupResultsByStatus(items = [], { mode = 'standard' } = {}) {
  if (mode === 'detailing') {
    const columns = DETAILING_RESULT_COLUMNS.map((c) => ({
      id: c.id,
      label: c.label,
      items: [],
    }))
    const byId = new Map(columns.map((c) => [c.id, c]))
    for (const item of items) {
      const resolvedKey = DETAILING_COLUMN_ALIAS[item.status] || item.status
      const bucket = byId.get(resolvedKey) || byId.get('pending')
      bucket.items.push(item)
    }
    return columns
  }

  const columns = SUBMISSION_STATUSES.map((s) => ({
    id: s.value,
    label: s.label,
    items: [],
  }))
  const byId = new Map(columns.map((c) => [c.id, c]))
  for (const item of items) {
    const bucket = byId.get(item.submissionStatus || item.status) || byId.get('new')
    bucket.items.push(item)
  }
  return columns
}

/** Pair the complete form definition with submitted answers (preserving steps + extra metadata keys). */
export function buildSubmissionAnswerRows(item) {
  if (!item) return []
  const payload = item.payload || {}
  const fields = normalizeFields(item.fields || [])
  const seen = new Set()
  const rows = fields.map((field) => {
    seen.add(field.key)
    const raw = payload[field.key]
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || [],
      step: field.step || null,
      rawValue: raw,
      displayValue: formatAnswerDisplay(raw, field.type),
    }
  })

  for (const [key, raw] of Object.entries(payload)) {
    if (seen.has(key)) continue
    if (raw == null || String(raw).trim() === '') continue
    rows.push({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type: typeof raw === 'boolean' ? 'checkbox' : 'text',
      required: false,
      options: [],
      step: null,
      rawValue: raw,
      displayValue: formatAnswerDisplay(raw, typeof raw === 'boolean' ? 'checkbox' : 'text'),
    })
  }
  return rows
}

function formatAnswerDisplay(raw, type) {
  if (type === 'checkbox' || typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (raw == null) return '—'
  if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '—'
  const text = String(raw).trim()
  return text || '—'
}
