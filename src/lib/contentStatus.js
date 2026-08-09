export const CONTENT_STATUSES = Object.freeze(['draft', 'published', 'archived'])

export function normalizeContentStatus(value) {
  return CONTENT_STATUSES.includes(value) ? value : 'draft'
}

export function isPublishedContent(row) {
  if (!row) return false
  if (row.status) return row.status === 'published'
  return row.is_published === true
}
