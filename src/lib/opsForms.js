/** Smart ops form helpers — field templates, slug, validation, calendar extract */

export const FORM_KINDS = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'event', label: 'Event / RSVP' },
  { value: 'booking', label: 'Booking request' },
  { value: 'survey', label: 'Survey' },
  { value: 'custom', label: 'Custom' },
]

export const FORM_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

export const SUBMISSION_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
]

export const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
]

export function slugifyFormName(name, id = '') {
  const base = String(name || 'form')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'form'
  const suffix = String(id || '').replace(/-/g, '').slice(0, 8)
  return suffix ? `${base}-${suffix}` : base
}

export function fieldKeyFromLabel(label, used = new Set()) {
  let key = String(label || 'field')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'field'
  let n = key
  let i = 2
  while (used.has(n)) {
    n = `${key}_${i}`
    i += 1
  }
  used.add(n)
  return n
}

export function normalizeFields(fields) {
  const used = new Set()
  return (Array.isArray(fields) ? fields : []).map((f, index) => {
    const label = String(f.label || `Field ${index + 1}`).trim() || `Field ${index + 1}`
    const key = f.key ? String(f.key) : fieldKeyFromLabel(label, used)
    if (f.key) used.add(key)
    const type = FIELD_TYPES.some((t) => t.value === f.type) ? f.type : 'text'
    const options = Array.isArray(f.options)
      ? f.options.map(String).map((s) => s.trim()).filter(Boolean)
      : String(f.optionsCsv || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
    return {
      key,
      label,
      type,
      required: Boolean(f.required),
      options: type === 'select' ? options : [],
    }
  })
}

export function templateFields(kind) {
  if (kind === 'complaint') {
    return normalizeFields([
      { key: 'customer_name', label: 'Customer name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: false },
      { key: 'branch', label: 'Branch', type: 'select', required: true, options: ['bacoor', 'batangas'] },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Service quality', 'Wait time', 'Damage', 'Staff', 'Other'] },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
    ])
  }
  if (kind === 'event') {
    return normalizeFields([
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
      { key: 'email', label: 'Email', type: 'email', required: false },
      { key: 'guests', label: 'Guests', type: 'number', required: false },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false },
    ])
  }
  if (kind === 'booking') {
    return normalizeFields([
      { key: 'customer_name', label: 'Customer name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'phone', required: true },
      { key: 'preferred_at', label: 'Preferred date & time', type: 'datetime', required: true },
      { key: 'vehicle_plate', label: 'Plate', type: 'text', required: false },
      { key: 'service', label: 'Service', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false },
    ])
  }
  if (kind === 'survey') {
    return normalizeFields([
      { key: 'name', label: 'Name', type: 'text', required: false },
      { key: 'rating', label: 'Rating (1-5)', type: 'number', required: true },
      { key: 'feedback', label: 'Feedback', type: 'textarea', required: true },
    ])
  }
  return normalizeFields([
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false },
  ])
}

export function validatePayload(fields, payload = {}) {
  const errors = []
  for (const field of normalizeFields(fields)) {
    const raw = payload[field.key]
    const empty = raw == null || String(raw).trim() === '' || raw === false
    if (field.required && empty && field.type !== 'checkbox') {
      errors.push(`${field.label} is required`)
    }
    if (field.type === 'email' && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) {
      errors.push(`${field.label} must be a valid email`)
    }
  }
  return errors
}

export function extractCalendarAt(fields, payload = {}) {
  for (const field of normalizeFields(fields)) {
    if ((field.type === 'date' || field.type === 'datetime') && payload[field.key]) {
      const d = new Date(payload[field.key])
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
  }
  if (payload.due_at) {
    const d = new Date(payload.due_at)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

export function formatFormPayloadDescription(payload = {}) {
  return Object.entries(payload)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n')
}

export function shareFormUrl(slug, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!slug) return ''
  return `${String(origin).replace(/\/$/, '')}/f/${slug}`
}

export function submissionTitle(form, payload = {}) {
  const name = payload.customer_name || payload.name || payload.full_name || ''
  if (form?.kind === 'complaint') return `Complaint: ${name || 'Customer'}`
  if (form?.kind === 'booking') return `Booking request: ${name || payload.service || 'Customer'}`
  if (form?.kind === 'event') return `RSVP: ${name || 'Guest'}`
  return `${form?.name || 'Form'}: ${name || 'Submission'}`
}

// Back-compat exports used by older planningPart6 imports
export function complaintFields() {
  return templateFields('complaint')
}

export function parseCustomFieldsCsv(csv) {
  return String(csv || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({
      key: fieldKeyFromLabel(label),
      label,
      type: 'text',
      required: false,
      options: [],
    }))
}
