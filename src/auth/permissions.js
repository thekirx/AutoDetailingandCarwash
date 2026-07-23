/** Single source of truth for Hakum RBAC (owner plan §16). BossMich = Super Admin. */

export const ROLES = {
  SUPER_ADMIN: 'BossMich',
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  STAFF: 'staff',
  CASHIER: 'cashier',
  MARKETING: 'marketing',
  SALES: 'sales',
}

export const SUPER_ADMIN_ROLES = [ROLES.SUPER_ADMIN]
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN]
export const QUEUE_EDITOR_ROLES = [ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN]
export const QUEUE_VIEWER_ROLES = [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.SUPER_ADMIN]
export const OPS_LOGIN_ROLES = [
  ROLES.STAFF,
  ROLES.TEAM_LEAD,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
  ROLES.CASHIER,
  ROLES.MARKETING,
  ROLES.SALES,
]

const has = (profile, roles) => roles.includes(profile?.role)

export function isSuperAdmin(profile) {
  return has(profile, SUPER_ADMIN_ROLES)
}

export function isAdmin(profile) {
  return has(profile, ADMIN_ROLES)
}

export function canAccessPos(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.SALES, ROLES.CASHIER])
}

export function canAccessFinance(profile) {
  return isAdmin(profile)
}

export function canAccessReports(profile) {
  return isAdmin(profile)
}

export function canManageServices(profile) {
  return isAdmin(profile)
}

export function canManageCrew(profile) {
  return isAdmin(profile) || has(profile, [ROLES.TEAM_LEAD])
}

export function canManageBranches(profile) {
  return isAdmin(profile)
}

export function canManagePeople(profile) {
  return isAdmin(profile)
}

/** Only Super Admin may create lesser Admin accounts. */
export function canCreateAdminAccounts(profile) {
  return isSuperAdmin(profile)
}

export function canEditBookings(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING, ROLES.SALES, ROLES.TEAM_LEAD])
}

export function canCreateBookings(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING, ROLES.SALES, ROLES.TEAM_LEAD])
}

export function canAccessCrm(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING, ROLES.SALES])
}

export function canAccessMarketing(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING])
}

export function canAccessBookingBoard(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING, ROLES.SALES, ROLES.TEAM_LEAD])
}

export function canUseOperations(profile) {
  return has(profile, [
    ROLES.STAFF,
    ROLES.TEAM_LEAD,
    ROLES.ADMIN,
    ROLES.SUPER_ADMIN,
    ROLES.SALES,
    ROLES.CASHIER,
    ROLES.MARKETING,
  ])
}

export function canEditQueueOperations(profile) {
  return has(profile, QUEUE_EDITOR_ROLES)
}

export function canViewQueueOperations(profile) {
  return has(profile, QUEUE_VIEWER_ROLES)
}

export function canViewAssignedTasks(profile) {
  return has(profile, [ROLES.STAFF, ROLES.TEAM_LEAD, ROLES.ADMIN, ROLES.SUPER_ADMIN])
}

/** Nav items for the shared ops shell — filtered by role. */
export function getOperationsNav(profile) {
  const items = []

  if (isAdmin(profile)) {
    items.push(
      { label: 'Console', to: '/operations/console', icon: 'LayoutDashboard' },
      { label: 'People', to: '/operations/people', icon: 'UserPlus' },
      { label: 'Branches', to: '/operations/branches', icon: 'Building2' },
      { label: 'Audit', to: '/operations/audit', icon: 'ScrollText' },
    )
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
  if (canManageServices(profile)) {
    items.push(
      { label: 'Services', to: '/operations/services', icon: 'Sparkles' },
      { label: 'Merch', to: '/operations/products', icon: 'Package' },
    )
  }
  if (canAccessMarketing(profile)) {
    items.push({ label: 'SMS', to: '/operations/sms', icon: 'MessageSquare' })
  }
  if (canAccessBookingBoard(profile)) {
    items.push({ label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' })
  }
  if (canAccessReports(profile)) {
    items.push({ label: 'Reports', to: '/operations/reports', icon: 'LineChart' })
  }
  if (isAdmin(profile)) {
    items.push({ label: 'Memberships', to: '/operations/memberships', icon: 'Crown' })
  }
  return items
}

export function redirectForRole(role) {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) return '/operations/console'
  if (role === ROLES.STAFF) return '/operations/my-tasks'
  if (role === ROLES.TEAM_LEAD) return '/operations/dashboard'
  if (role === ROLES.CASHIER || role === ROLES.SALES) return '/operations/pos'
  if (role === ROLES.MARKETING) return '/operations/bookings'
  return '/operations/dashboard'
}
