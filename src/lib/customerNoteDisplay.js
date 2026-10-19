/** Format guest-note metadata for queue / CRM (Michi C14). */

export function formatNoteAuthorDate({ authorName, createdAt, fallback = 'Staff' } = {}) {
  const who = String(authorName || '').trim() || fallback
  if (!createdAt) return who
  const when = new Date(createdAt)
  if (Number.isNaN(when.getTime())) return who
  const date = when.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${who} · ${date}`
}

/** Attach staff_display_names results onto note rows that have created_by. */
export function attachNoteAuthors(notes = [], nameRows = []) {
  const names = new Map((nameRows || []).map((p) => [p.id, p.full_name]))
  return (notes || []).map((n) => ({
    ...n,
    author_name: n.created_by ? names.get(n.created_by) || null : null,
  }))
}
