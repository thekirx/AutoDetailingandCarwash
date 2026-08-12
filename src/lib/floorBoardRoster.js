/** Admin roster groups for Floor Board hover tiles. */

export const ADMIN_ROSTER_GROUPS = Object.freeze([
  { role: 'marketing', label: 'Marketing' },
  { role: 'video_editor', label: 'Video editor' },
  { role: 'admin', label: 'Branch Admin' },
  { role: 'assistant_super_admin', label: 'ASA' },
  { role: 'team_lead', label: 'Team Lead' },
])

/**
 * Build admin roster tiles from staff profile rows.
 * @param {Array<{ role?: string, full_name?: string, is_active?: boolean }>} staff
 */
export function buildAdminRoster(staff = []) {
  const active = (staff || []).filter((row) => row?.is_active !== false)
  return ADMIN_ROSTER_GROUPS.map(({ role, label }) => {
    const members = active.filter((row) => String(row.role || '') === role)
    return {
      role,
      label,
      count: members.length,
      names: members.map((row) => row.full_name || 'Unnamed').filter(Boolean),
    }
  })
}
