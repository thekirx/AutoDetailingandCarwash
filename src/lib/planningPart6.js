/** Part 6 helpers — label/checklist/forms/events */

export function slugifyEventTitle(title, id = '') {
  const base = String(title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'event'
  const suffix = String(id || '').replace(/-/g, '').slice(0, 8)
  return suffix ? `${base}-${suffix}` : base
}

export function formatFormPayloadDescription(payload = {}) {
  return Object.entries(payload)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

export function complaintFields() {
  return [
    { key: 'customer_name', label: 'Customer name', type: 'text', required: true },
    { key: 'branch', label: 'Branch', type: 'text', required: true },
    { key: 'category', label: 'Category', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
  ]
}

export function parseCustomFieldsCsv(csv) {
  // ponytail: "Label|Label2" → text fields; upgrade to full field editor when needed
  return String(csv || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field',
      label,
      type: 'text',
      required: false,
    }))
}
