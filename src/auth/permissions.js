/** Single source of truth for Hakum RBAC. BossMich = Super Admin; assistant_super_admin = lesser elevated. */

export const ROLES = {
  SUPER_ADMIN: 'BossMich',
  ASSISTANT_SUPER_ADMIN: 'assistant_super_admin',
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  STAFF: 'staff',
  MARKETING: 'marketing',
}

/** @deprecated enum values may still exist in DB; do not assign in app */
export const DEPRECATED_ROLES = {
  CASHIER: 'cashier',
  SALES: 'sales',
}

/** Defaults when assistant has empty permission_grants. BossMich can override per user. */
export const DEFAULT_ASSISTANT_GRANTS = {
  pos: true,
  finance_view: true,
  finance_write: false,
  reports: true,
  planning_edit: false,
  people: true,
  branches: true,
  branches_all: true,
  services_merch: true,
  queue_all: true,
  kpi_all: true,
  audit: true,
  memberships: true,
  rbac_edit: false,
}

export const ASSISTANT_GRANT_KEYS = Object.keys(DEFAULT_ASSISTANT_GRANTS)

/** Human labels for People / RBAC editor */
export const ASSISTANT_GRANT_LABELS = {
  pos: 'POS checkout',
  finance_view: 'Finance view',
  finance_write: 'Finance write',
  reports: 'Reports',
  planning_edit: 'Planning edit',
  people: 'People CRUD',
  branches: 'Branches CRUD',
  branches_all: 'All branches (data scope)',
  services_merch: 'Services & merch',
  queue_all: 'Queue edit (all sites)',
  kpi_all: 'KPI all sites',
  audit: 'Audit log',
  memberships: 'Memberships',
  rbac_edit: 'Edit other ASA grants',
}

export const SUPER_ADMIN_ROLES = [ROLES.SUPER_ADMIN]
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN, ROLES.ADMIN]
export const QUEUE_EDITOR_ROLES = [ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN]
export const QUEUE_VIEWER_ROLES = [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN]
export const OPS_LOGIN_ROLES = [
  ROLES.STAFF,
  ROLES.TEAM_LEAD,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
  ROLES.ASSISTANT_SUPER_ADMIN,
  ROLES.MARKETING,
]

const has = (profile, roles) => roles.includes(profile?.role)

export function isSuperAdmin(profile) {
  return has(profile, SUPER_ADMIN_ROLES)
}

export function isAssistantSuperAdmin(profile) {
  return profile?.role === ROLES.ASSISTANT_SUPER_ADMIN
}

/** Console-tier: owner, assistant, or branch admin */
export function isAdmin(profile) {
  return has(profile, ADMIN_ROLES)
}

export function resolveAssistantGrants(profile) {
  if (!isAssistantSuperAdmin(profile)) return null
  return { ...DEFAULT_ASSISTANT_GRANTS, ...(profile?.permission_grants || {}) }
}

export function hasGrant(profile, key) {
  if (isSuperAdmin(profile)) return true
  const grants = resolveAssistantGrants(profile)
  if (!grants) return false
  return Boolean(grants[key])
}

/** All branches (null) vs slug list. Scope uses branches_all — not queue/kpi grants. */
export function getBranchScopeList(profile) {
  if (!profile) return []
  if (isSuperAdmin(profile)) return null
  if (isAssistantSuperAdmin(profile) && hasGrant(profile, 'branches_all')) return null
  const multi = Array.isArray(profile.branch_slugs) ? profile.branch_slugs.filter(Boolean) : []
  if (multi.length) return multi
  if (profile.branch_slug) return [profile.branch_slug]
  return []
}

export function canSeeAllBranches(profile) {
  return getBranchScopeList(profile) === null
}

/** KPI board: ASA uses kpi_all (independent of general branches_all). */
export function canSeeAllKpiBranches(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'kpi_all')
  return canSeeAllBranches(profile)
}

export function canAccessPos(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'pos')
  return profile?.role === ROLES.ADMIN
}

export function canAccessFinance(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_view')
  return profile?.role === ROLES.ADMIN
}

export function canWriteFinance(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_write')
  return profile?.role === ROLES.ADMIN
}

export function canAccessReports(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'reports')
}

export function canManageServices(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'services_merch') || hasGrant(profile, 'pos')
  return profile?.role === ROLES.ADMIN
}

export function canManageCrew(profile) {
  return isAdmin(profile) || has(profile, [ROLES.TEAM_LEAD])
}

export function canManageBranches(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'branches')
  return profile?.role === ROLES.ADMIN
}

/** Open new company sites — Super Admin / ASA with branches grant (not branch Admin). */
export function canCreateBranches(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'branches')
  return false
}

export function canManagePeople(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'people')
  return profile?.role === ROLES.ADMIN
}

export function canCreateAdminAccounts(profile) {
  return isSuperAdmin(profile)
}

export function canEditAssistantGrants(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'rbac_edit')
}

export function canAccessAudit(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'audit')
  return profile?.role === ROLES.ADMIN
}

/** Super Admin only — master make/model catalog for TL picker */
export function canManageVehicleCatalog(profile) {
  return isSuperAdmin(profile)
}

export function canOverrideAttendance(profile) {
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile) || profile?.role === ROLES.ADMIN
}

/** Branch geofence + shift settings (Admin / BossMich / ASA with people or branches). */
export function canEditAttendanceSettings(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'branches') || hasGrant(profile, 'people')
  return profile?.role === ROLES.ADMIN
}

/** Which employee roles appear on the attendance register — Super Admin only. */
export function canEditAttendanceRoles(profile) {
  return isSuperAdmin(profile)
}

export function canAccessConsole(profile) {
  return isAdmin(profile)
}

export function canEditBookings(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.TEAM_LEAD])
}

export function canCreateBookings(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.TEAM_LEAD])
}

export function canAccessCrm(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING])
}

/** @deprecated SMS lives under CRM; kept for redirects */
export function canAccessMarketing(profile) {
  return canAccessCrm(profile)
}

export function canAccessBookingBoard(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.TEAM_LEAD])
}

export function canViewPlanning(profile) {
  return isAdmin(profile)
}

export function canEditPlanning(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'planning_edit')
}

export function canUseOperations(profile) {
  return has(profile, OPS_LOGIN_ROLES)
}

export function canEditQueueOperations(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  return profile?.role === ROLES.TEAM_LEAD
}

export function canViewQueueOperations(profile) {
  return has(profile, QUEUE_VIEWER_ROLES)
}

/** Redo QC lane — Super Admin + Assistant Super Admin only (not customers, TL, or branch admin). */
export function canViewRedoLane(profile) {
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
}

export function canViewAssignedTasks(profile) {
  return has(profile, [ROLES.STAFF, ROLES.TEAM_LEAD, ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN])
}

export function canAccessMemberships(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'memberships')
  return profile?.role === ROLES.ADMIN
}

export function canAccessDataCenter(profile) {
  return isSuperAdmin(profile)
}

/** Branch Admin day-of ops — POS + floor watch + queue view only. */
export function isBranchAdmin(profile) {
  return profile?.role === ROLES.ADMIN
}

/** Nav items for the shared ops shell — filtered by role + grants. */
export function getOperationsNav(profile) {
  if (profile?.role === ROLES.MARKETING) {
    return [{ label: 'CRM', to: '/operations/crm', icon: 'Contact' }]
  }

  // Branch Admin: tablet dock surface — keep sidebar/nav identical if shell falls back.
  if (isBranchAdmin(profile)) {
    return [
      { label: 'POS', to: '/operations/pos', icon: 'ShoppingCart' },
      { label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' },
      { label: 'Queue', to: '/operations/queue', icon: 'ClipboardList' },
    ]
  }

  const items = []

  if (canAccessConsole(profile)) {
    items.push({ label: 'Console', to: '/operations/console', icon: 'LayoutDashboard' })
  }
  if (canViewPlanning(profile)) {
    items.push({ label: 'Planning', to: '/operations/planning', icon: 'Columns3' })
  }
  if (canManagePeople(profile)) {
    items.push({ label: 'People', to: '/operations/people', icon: 'UserPlus' })
  }
  if (canManageBranches(profile)) {
    items.push({ label: 'Branches', to: '/operations/branches', icon: 'Building2' })
  }
  if (canManageVehicleCatalog(profile)) {
    items.push({ label: 'Cars', to: '/operations/cars', icon: 'CarFront' })
  }
  if (canAccessAudit(profile)) {
    items.push({ label: 'Audit', to: '/operations/audit', icon: 'ScrollText' })
  }
  if (canAccessDataCenter(profile)) {
    items.push({ label: 'Data Center', to: '/operations/data-center', icon: 'Database' })
  }

  if (canViewQueueOperations(profile)) {
    items.push(
      { label: isAdmin(profile) ? 'Floor board' : 'Dashboard', to: '/operations/dashboard', icon: 'Gauge' },
      { label: 'Queue', to: '/operations/queue', icon: 'ClipboardList' },
      { label: 'Crew', to: '/operations/crew', icon: 'Users' },
      { label: 'KPI', to: '/operations/kpi', icon: 'BarChart3' },
    )
  }
  if (canViewAssignedTasks(profile)) {
    items.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  }
  if (canAccessPos(profile)) {
    items.push({ label: 'POS', to: '/operations/pos', icon: 'ShoppingCart' })
  }
  if (canAccessFinance(profile)) {
    items.push({ label: 'Finance', to: '/operations/finance', icon: 'Wallet' })
  }
  if (canAccessCrm(profile)) {
    items.push({ label: 'CRM', to: '/operations/crm', icon: 'Contact' })
  }
  // Services / Merch / SMS — folded into POS / CRM (redirects in App.jsx)
  if (canAccessBookingBoard(profile)) {
    items.push({ label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' })
  }
  if (canAccessReports(profile)) {
    items.push({ label: 'Reports', to: '/operations/reports', icon: 'LineChart' })
  }
  if (canAccessMemberships(profile)) {
    items.push({ label: 'Memberships', to: '/operations/memberships', icon: 'Crown' })
  }
  return items
}

/** Team Lead floor dock — same allowRoute matrix, fixed thumb order + New ticket when editable. */
export function getTeamLeadDock(profile) {
  const canQueue = canViewQueueOperations(profile)
  const canEdit = canEditQueueOperations(profile)
  const canBook = canAccessBookingBoard(profile)
  const dock = []
  if (canQueue) dock.push({ label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' })
  if (canQueue) dock.push({ label: 'Queue', to: '/operations/queue', icon: 'ClipboardList', end: true })
  if (canEdit) dock.push({ label: 'New', to: '/operations/queue/new', icon: 'Plus', primary: true })
  if (canQueue) dock.push({ label: 'Crew', to: '/operations/crew', icon: 'Users' })
  if (canBook) dock.push({ label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' })
  return dock.slice(0, 5)
}

export function getTeamLeadMore(profile) {
  const more = []
  if (canViewQueueOperations(profile)) more.push({ label: 'KPI', to: '/operations/kpi', icon: 'BarChart3' })
  if (canViewAssignedTasks(profile)) more.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  return more
}

/** Branch Admin thumb dock — POS primary (checkout), Floor + Queue for oversight. */
export function getBranchAdminDock(profile) {
  if (!isBranchAdmin(profile)) return []
  const dock = []
  if (canViewQueueOperations(profile)) dock.push({ label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' })
  if (canViewQueueOperations(profile)) dock.push({ label: 'Queue', to: '/operations/queue', icon: 'ClipboardList', end: true })
  if (canAccessPos(profile)) dock.push({ label: 'POS', to: '/operations/pos', icon: 'ShoppingCart', primary: true })
  return dock
}

/** Optional overflow for Branch Admin (public kiosk links live on the queue page). */
export function getBranchAdminMore() {
  return []
}

export function redirectForRole(role) {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ASSISTANT_SUPER_ADMIN) {
    return '/operations/console'
  }
  if (role === ROLES.ADMIN) return '/operations/pos'
  if (role === ROLES.STAFF) return '/operations/my-tasks'
  if (role === ROLES.TEAM_LEAD) return '/operations/dashboard'
  if (role === ROLES.MARKETING) return '/operations/crm'
  // legacy
  if (role === DEPRECATED_ROLES.CASHIER || role === DEPRECATED_ROLES.SALES) return '/operations/pos'
  return '/operations/dashboard'
}

/** Route allow helpers for App.jsx */
export function allowRoute(profile, key) {
  const map = {
    console: canAccessConsole,
    planning: canViewPlanning,
    people: canManagePeople,
    branches: canManageBranches,
    cars: canManageVehicleCatalog,
    audit: canAccessAudit,
    'data-center': canAccessDataCenter,
    dashboard: canViewQueueOperations,
    queue: canViewQueueOperations,
    'queue-new': canEditQueueOperations,
    crew: canViewQueueOperations,
    kpi: canViewQueueOperations,
    'my-tasks': canViewAssignedTasks,
    pos: canAccessPos,
    finance: canAccessFinance,
    crm: canAccessCrm,
    bookings: canAccessBookingBoard,
    reports: canAccessReports,
    memberships: canAccessMemberships,
  }
  const fn = map[key]
  return fn ? fn(profile) : false
}
