/** Fixed ops form templates — field helpers, slug, validation, share/QR */

export const FORM_KINDS = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'event', label: 'Events RSVP' },
  { value: 'equipment_repair', label: 'Equipment repairs' },
  { value: 'cash_advance', label: 'Cash advance' },
]

/** Stable public slugs for the four templates (edit-only; never free-create). */
export const FIXED_FORM_TEMPLATES = [
  {
    kind: 'complaint',
    slug: 'customer-complaints',
    name: 'Customer Complaints',
    description: 'Tell us what went wrong so we can make it right.',
    public_enabled: true,
    status: 'published',
  },
  {
    kind: 'event',
    slug: 'events-rsvp',
    name: 'Events RSVP',
    description: 'Confirm your spot for the next Hakum event.',
    public_enabled: true,
    status: 'published',
  },
  {
    kind: 'equipment_repair',
    slug: 'equipment-repairs',
    name: 'Equipment Repairs',
    description: 'Crew reports equipment issues for ops follow-up.',
    public_enabled: false,
    status: 'published',
  },
  {
    kind: 'cash_advance',
    slug: 'cash-advance',
    name: 'Employee Cash Advance',
    description: 'Request a cash advance. Super Admin / ASA review on Payroll.',
    public_enabled: false,
    status: 'published',
  },
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

export const DEFAULT_FORM_LOGO = '/branding/hakum-lw-ow.png'

export function isFixedFormKind(kind) {
  return FORM_KINDS.some((k) => k.value === kind)
}

export function formKindLabel(kind) {
  return FORM_KINDS.find((k) => k.value === kind)?.label || String(kind || 'form').replace(/_/g, ' ')
}

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
  if (kind === 'equipment_repair') {
    return normalizeFields([
      { key: 'reporter', label: 'Reported by', type: 'text', required: true },
      { key: 'branch', label: 'Branch', type: 'select', required: true, options: ['bacoor', 'batangas'] },
      { key: 'equipment', label: 'Equipment', type: 'text', required: true },
      { key: 'urgency', label: 'Urgency', type: 'select', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'description', label: 'Issue description', type: 'textarea', required: true },
    ])
  }
  if (kind === 'cash_advance') {
    return normalizeFields([
      { key: 'employee_name', label: 'Employee name', type: 'text', required: true },
      { key: 'branch', label: 'Branch', type: 'select', required: true, options: ['bacoor', 'batangas'] },
      { key: 'amount', label: 'Amount (₱)', type: 'number', required: true },
      { key: 'needed_by', label: 'Needed by', type: 'date', required: true },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
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
  // Fixed kinds only — unknown kind falls back to complaint shape
  return templateFields('complaint')
}

export function defaultFormSettings(kind = 'complaint') {
  return {
    push_to_planning: true,
    show_on_calendar: kind === 'event',
    show_logo: true,
    logo_url: DEFAULT_FORM_LOGO,
    header_title: '',
  }
}

export function normalizeFormSettings(settings = {}, kind = 'complaint') {
  const base = defaultFormSettings(kind)
  const raw = settings && typeof settings === 'object' ? settings : {}
  return {
    ...base,
    ...raw,
    show_logo: raw.show_logo !== false,
    logo_url: String(raw.logo_url || base.logo_url).trim() || DEFAULT_FORM_LOGO,
    header_title: String(raw.header_title || '').trim(),
  }
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

/** QR image URL for a share link (no npm dep — CSP allows https: img-src). */
export function formQrImageUrl(url, size = 200) {
  if (!url) return ''
  const n = Math.min(512, Math.max(120, Number(size) || 200))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${n}x${n}&data=${encodeURIComponent(url)}`
}

export function submissionTitle(form, payload = {}) {
  const name = payload.customer_name || payload.name || payload.full_name || payload.employee_name || ''
  if (form?.kind === 'complaint') return `Complaint: ${name || 'Customer'}`
  if (form?.kind === 'event') return `RSVP: ${name || 'Guest'}`
  if (form?.kind === 'equipment_repair') return `Equipment: ${payload.equipment || name || 'Report'}`
  if (form?.kind === 'cash_advance') return `Cash advance: ${name || 'Employee'}`
  return `${form?.name || 'Form'}: ${name || 'Submission'}`
}

export function extractComplaintBranch(payload = {}) {
  const raw = String(payload.branch || payload.branch_slug || '').trim().toLowerCase()
  return raw || null
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
