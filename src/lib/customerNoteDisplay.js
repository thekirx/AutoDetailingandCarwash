/** Format guest-note metadata for queue / CRM (Michi C14, Multi-branch ready). */

const ROLE_LABELS = {
  team_lead: 'Team Lead',
  admin: 'Admin',
  BossMich: 'Super Admin',
  super_admin: 'Super Admin',
  operations_lead: 'Assistant Super Admin',
  assistant_super_admin: 'Assistant Super Admin',
  sales: 'Sales',
  marketing: 'Marketing',
  detailer: 'Detailer',
  staff: 'Staff',
}

export function formatRoleLabel(role) {
  if (!role) return ''
  return ROLE_LABELS[role] || String(role).replace(/_/g, ' ')
}

export function formatNoteAuthorDate({
  authorName,
  authorRole,
  authorBranch,
  branch,
  createdAt,
  fallback = 'Staff',
} = {}) {
  const who = String(authorName || '').trim() || fallback
  const role = formatRoleLabel(authorRole)
  const loc = String(branch || authorBranch || '').trim()
  const tagParts = [role, loc].filter(Boolean)
  const authorPart = tagParts.length ? `${who} (${tagParts.join(' · ')})` : who
  if (!createdAt) return authorPart
  const when = new Date(createdAt)
  if (Number.isNaN(when.getTime())) return authorPart
  const date = when.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${authorPart} · ${date}`
}

/** Attach staff_display_names results onto note rows that have created_by. */
export function attachNoteAuthors(notes = [], nameRows = []) {
  const map = new Map(
    (nameRows || []).map((p) => [
      p?.id,
      typeof p === 'object' && p !== null ? p : { full_name: p },
    ]),
  )
  return (notes || []).map((n) => {
    const author = n?.created_by ? map.get(n.created_by) : null
    const name = author?.full_name || (typeof author === 'string' ? author : null)
    return {
      ...n,
      author_name: name || null,
      author_role: author?.role || null,
      author_branch: n?.branch_slug || author?.branch_slug || null,
    }
  })
}
