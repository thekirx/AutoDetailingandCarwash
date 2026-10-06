/** Branches admin list: status chips + free-text search (name, slug, code, address). */
export const BRANCH_LIST_FILTERS = [
  { id: 'current', label: 'Current' },
  { id: 'active', label: 'Active' },
  { id: 'coming_soon', label: 'Coming soon' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
]

export function branchListStatus(row) {
  if (row?.is_archived) return 'archived'
  if (row?.coming_soon) return 'coming_soon'
  if (row?.is_active) return 'active'
  return 'inactive'
}

function matchesStatus(row, status) {
  if (status === 'all') return true
  const s = branchListStatus(row)
  return status === 'current' ? s !== 'archived' : s === status
}

export function filterBranchRows(rows = [], { q = '', status = 'current' } = {}) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((row) => {
    if (!matchesStatus(row, status)) return false
    if (!terms.length) return true
    const hay = [row.name, row.slug, row.code, row.address].join(' ').toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

export function countBranchRows(rows = []) {
  return Object.fromEntries(BRANCH_LIST_FILTERS.map(({ id }) => [id, rows.filter((r) => matchesStatus(r, id)).length]))
}
