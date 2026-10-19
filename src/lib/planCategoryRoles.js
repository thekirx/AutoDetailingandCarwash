/** Planner category visibility by role (Michi C13). Empty visible_roles = everyone. */

export const PLAN_CATEGORY_ROLE_OPTIONS = Object.freeze([
  { id: 'staff', label: 'Crew' },
  { id: 'detailer', label: 'Detailer' },
  { id: 'team_lead', label: 'Team Lead' },
  { id: 'admin', label: 'Branch Admin' },
  { id: 'operations_lead', label: 'Operations Lead' },
  { id: 'assistant_super_admin', label: 'ASA' },
  { id: 'BossMich', label: 'Super Admin' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'video_editor', label: 'Video editor' },
  { id: 'sales', label: 'Sales' },
])

export function categoryVisibleToRole(category, role) {
  const roles = category?.visible_roles
  if (!Array.isArray(roles) || roles.length === 0) return true
  if (!role) return false
  return roles.includes(role)
}

export function filterCategoriesForRole(categories = [], role) {
  return (categories || []).filter((c) => categoryVisibleToRole(c, role))
}

export function normalizeVisibleRoles(raw) {
  const allowed = new Set(PLAN_CATEGORY_ROLE_OPTIONS.map((r) => r.id))
  return [...new Set((raw || []).map((x) => String(x || '').trim()).filter((id) => allowed.has(id)))]
}
