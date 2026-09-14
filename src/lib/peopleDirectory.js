/** People directory tabs — crew vs TL vs branch admins vs HQ/office. */

export const PEOPLE_DIRECTORY_TABS = Object.freeze([
  { id: 'crew', label: 'Crew', roles: ['staff', 'detailer'] },
  { id: 'tl', label: 'Team Leads', roles: ['team_lead'] },
  { id: 'admins', label: 'Admins', roles: ['admin'] },
  { id: 'office', label: 'Office', roles: ['operations_lead', 'assistant_super_admin', 'marketing', 'sales', 'video_editor', 'investor', 'BossMich'] },
])

export function personDirectoryTab(role) {
  const key = String(role || '')
  for (const tab of PEOPLE_DIRECTORY_TABS) {
    if (tab.roles.includes(key)) return tab.id
  }
  return 'office'
}

export function filterDirectoryPeople(people = [], { tab = 'crew', q = '', branch = '', status = 'all' } = {}) {
  const query = String(q || '').trim().toLowerCase()
  const branchKey = String(branch || '').trim()
  return (people || []).filter((row) => {
    if (tab && personDirectoryTab(row.role) !== tab) return false
    if (status === 'active' && !row.is_active) return false
    if (status === 'inactive' && row.is_active) return false
    if (branchKey) {
      const slugs = row.branch_slugs?.length ? row.branch_slugs : row.branch_slug ? [row.branch_slug] : []
      if (!slugs.includes(branchKey)) return false
    }
    if (!query) return true
    const hay = `${row.full_name || ''} ${row.phone || ''} ${row.role || ''} ${(row.branch_slugs || []).join(' ')} ${row.branch_slug || ''}`.toLowerCase()
    return hay.includes(query)
  })
}

export function supervisorCandidates(people = []) {
  return (people || []).filter(
    (row) =>
      row.is_active &&
      (row.is_supervisor ||
        row.role === 'operations_lead' ||
        row.role === 'admin' ||
        row.role === 'BossMich' ||
        row.role === 'assistant_super_admin'),
  )
}
