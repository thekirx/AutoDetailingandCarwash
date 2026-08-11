/** Single source of truth for Hakum RBAC. BossMich = Super Admin; assistant_super_admin = lesser elevated. */

export const ROLES = {
  SUPER_ADMIN: 'BossMich',
  ASSISTANT_SUPER_ADMIN: 'assistant_super_admin',
  ADMIN: 'admin',
  TEAM_LEAD: 'team_lead',
  SALES: 'sales',
  STAFF: 'staff',
  MARKETING: 'marketing',
}

/** @deprecated enum values may still exist in DB; do not assign in app */
export const DEPRECATED_ROLES = {
  CASHIER: 'cashier',
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
  ROLES.SALES,
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
  // Sales is assigned to all branches — sees every booking, can assign to any branch.
  if (profile?.role === ROLES.SALES) return null
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

/** Catalog CRUD (services + merch stock). Branch Admin is checkout-only — no manage tabs. */
export function canManageServices(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'services_merch') || hasGrant(profile, 'pos')
  return false
}

/** Inventory Management area (services + merch) — same gate as catalog CRUD. */
export function canAccessInventory(profile) {
  return canManageServices(profile)
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

/** SA / ASA: blogs + event rich content on landing and customer app. */
export function canManageSiteContent(profile) {
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
}

/** Settings hub (branches / people / audit / permissions). Notifications live on their own nav item. */
export function canAccessSettings(profile) {
  return (
    canManageBranches(profile) ||
    canManagePeople(profile) ||
    canAccessAudit(profile) ||
    canAccessConsole(profile) ||
    canManageSiteContent(profile)
  )
}

/** Super Admin / ASA — configure automated reminders and broadcast pushes. */
export function canManageNotifications(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile)
}

/** Super Admin / ASA / Marketing — send broadcast marketing pushes. */
export function canSendBroadcast(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return true
  return profile?.role === ROLES.MARKETING
}

/** Dedicated Notifications page — reminders (SA/ASA) and/or broadcast (SA/ASA/Marketing). */
export function canAccessNotifications(profile) {
  return canManageNotifications(profile) || canSendBroadcast(profile)
}

/** Customer visit History — plate / phone ledger for ops roles. */
export function canAccessHistory(profile) {
  if (!profile) return false
  if (isSuperAdmin(profile) || isAssistantSuperAdmin(profile)) return true
  return [ROLES.SALES, ROLES.TEAM_LEAD, ROLES.MARKETING, ROLES.ADMIN].includes(profile.role)
}

/** Super Admin only — master make/model catalog for TL picker */
export function canManageVehicleCatalog(profile) {
  return isSuperAdmin(profile)
}

export function canOverrideAttendance(profile) {
  // SA / ASA / Branch Admin may correct register rows. TL clocks in but does not override.
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile) || profile?.role === ROLES.ADMIN
}

/**
 * Geofence + shift hours — Super Admin (and ASA with branches grant).
 * Values apply network-wide (same for every branch).
 */
export function canEditAttendanceSettings(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'branches')
  return false
}

/** Which employee roles appear on the attendance register — Super Admin only. */
export function canEditAttendanceRoles(profile) {
  return isSuperAdmin(profile)
}

/** Dedicated Attendance page: clock (BA/Crew/TL) and/or register/settings (SA/BA). */
export function canAccessAttendance(profile) {
  if (!profile) return false
  if (isSuperAdmin(profile) || isAssistantSuperAdmin(profile)) return true
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF].includes(profile.role)
}

/** Personal geofenced time in / time out — Branch Admin, Crew, Team Lead only. */
export function canUseAttendanceClock(profile) {
  if (!profile) return false
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF].includes(profile.role)
}

export function canAccessConsole(profile) {
  return isAdmin(profile)
}

export function canEditBookings(profile) {
  // Bookings service/price edits: Sales + Super Admin only (client rule).
  return isSuperAdmin(profile) || profile?.role === ROLES.SALES
}

export function canCreateBookings(profile) {
  return isSuperAdmin(profile) || profile?.role === ROLES.SALES
}

export function canAccessCrm(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.MARKETING])
}

/** @deprecated SMS lives under CRM; kept for redirects */
export function canAccessMarketing(profile) {
  return canAccessCrm(profile)
}

/** Bookings view: Sales, Super Admin/ASA, Marketing (readonly). TL/Admin use Queue status board. */
export function canAccessBookingBoard(profile) {
  if (profile?.role === ROLES.MARKETING) return true
  if (isSuperAdmin(profile) || isAssistantSuperAdmin(profile)) return true
  return profile?.role === ROLES.SALES
}

/** Advance detailing board status without editing services (TL / Branch Admin / SA). */
export function canAdvanceBookingStatus(profile) {
  return has(profile, [...ADMIN_ROLES, ROLES.TEAM_LEAD, ROLES.SALES])
}

/** Form-appointments editors: Sales (details only) and TL (can check-in to waiting). */
export function isSalesRole(profile) {
  return profile?.role === ROLES.SALES
}

export function isFormBookingsOnlyRole(profile) {
  return profile?.role === ROLES.SALES
}

/** Sales may advance the full detailing board; Marketing is read-only. */
export function canCheckInFormBooking(profile) {
  if (!profile) return false
  if (profile.role === ROLES.MARKETING) return false
  if (profile.role === ROLES.SALES || isSuperAdmin(profile)) return true
  return canAdvanceBookingStatus(profile)
}

/** Service / price changes: Sales + Super Admin only (TL/Admin status-only). */
export function canModifyBookingServicePrice(profile) {
  return canEditBookings(profile)
}

export function canViewPlanning(profile) {
  // SA / ASA / Branch Admin manage boards; crew + TL open Forms for staff fill.
  return isAdmin(profile) || has(profile, [ROLES.STAFF, ROLES.TEAM_LEAD])
}

export function canEditPlanning(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'planning_edit')
}

/**
 * Who may submit an ops form kind (staff fill). SA edits templates but does not fill cash advance.
 * Equipment repairs: crew (staff) only. Cash advance: all employees except Super Admin.
 * Complaint / Events RSVP: any planning viewer (plus public share links).
 */
export function canSubmitOpsFormKind(profile, kind) {
  if (!profile?.role) return false
  if (kind === 'equipment_repair') return profile.role === ROLES.STAFF
  if (kind === 'cash_advance') {
    if (isSuperAdmin(profile)) return false
    return has(profile, [
      ROLES.STAFF,
      ROLES.TEAM_LEAD,
      ROLES.ADMIN,
      ROLES.ASSISTANT_SUPER_ADMIN,
    ])
  }
  if (kind === 'complaint' || kind === 'event') return canViewPlanning(profile)
  return false
}

/** SA / ASA with planning_edit can open every template for edit + results. */
export function canManageOpsFormTemplates(profile) {
  return canEditPlanning(profile)
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

/** Legacy TL port: Team Lead never sees the For Payment lane; console tier does. */
export function canSeeForPaymentLane(profile) {
  return isAdmin(profile)
}

/** Branch Admin / Super Admin / ASA(queue_all) may pull tickets back to earlier lanes. */
export function canOverrideQueueStatus(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  return profile?.role === ROLES.ADMIN
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
    return [
      { label: 'CRM', to: '/operations/crm', icon: 'Contact' },
      { label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' },
      { label: 'History', to: '/operations/history', icon: 'History' },
      { label: 'Notifications', to: '/operations/notifications', icon: 'Bell' },
    ]
  }

  if (profile?.role === ROLES.SALES) {
    return [
      { label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' },
      { label: 'History', to: '/operations/history', icon: 'History' },
    ]
  }

  // Branch Admin: tablet dock surface — keep sidebar/nav identical if shell falls back.
  if (isBranchAdmin(profile)) {
    return [
      { label: 'POS', to: '/operations/pos', icon: 'ShoppingCart' },
      { label: 'Queue View', to: '/operations/dashboard', icon: 'Gauge' },
      { label: 'Queue', to: '/operations/queue', icon: 'ClipboardList' },
      { label: 'Attendance', to: '/operations/attendance', icon: 'Clock' },
      { label: 'History', to: '/operations/history', icon: 'History' },
    ]
  }

  // Crew (staff): clock + assigned work only.
  if (profile?.role === ROLES.STAFF) {
    return [
      { label: 'Attendance', to: '/operations/attendance', icon: 'Clock' },
      { label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
      { label: 'Planner', to: '/operations/planning?tab=forms', icon: 'Columns3' },
    ]
  }

  const items = []

  if (canAccessConsole(profile)) {
    items.push({ label: 'Console', to: '/operations/console', icon: 'LayoutDashboard' })
  }
  if (canAccessHistory(profile)) {
    items.push({ label: 'History', to: '/operations/history', icon: 'History' })
  }
  if (canAccessNotifications(profile)) {
    items.push({ label: 'Notifications', to: '/operations/notifications', icon: 'Bell' })
  }
  if (canAccessSettings(profile)) {
    items.push({ label: 'Settings', to: '/operations/settings', icon: 'Settings' })
  }
  if (canManageSiteContent(profile)) {
    items.push({ label: 'Content', to: '/operations/content', icon: 'Newspaper' })
  }
  if (canViewPlanning(profile)) {
    items.push({ label: 'Planner', to: '/operations/planning', icon: 'Columns3' })
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
      {
        label: isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
          ? 'Floor Board'
          : isAdmin(profile)
            ? 'Queue View'
            : profile?.role === ROLES.TEAM_LEAD
              ? 'Floor'
              : 'Dashboard',
        to: '/operations/dashboard',
        icon: 'Gauge',
      },
      { label: 'Car Wash Queue', to: '/operations/queue', icon: 'ClipboardList' },
      { label: 'Detailing Queue', to: '/operations/queue?family=detailing', icon: 'Layers' },
      { label: 'Attendance', to: '/operations/attendance', icon: 'Clock' },
      { label: 'Crew', to: '/operations/crew', icon: 'Users' },
      { label: 'KPI', to: '/operations/kpi', icon: 'BarChart3' },
    )
  }
  if (canAccessAttendance(profile) && !canViewQueueOperations(profile) && profile?.role !== ROLES.STAFF) {
    items.push({ label: 'Attendance', to: '/operations/attendance', icon: 'Clock' })
  }
  if (canViewAssignedTasks(profile) && profile?.role !== ROLES.STAFF) {
    items.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  }
  if (canAccessPos(profile)) {
    items.push({ label: 'POS', to: '/operations/pos', icon: 'ShoppingCart' })
  }
  if (canAccessInventory(profile)) {
    items.push({ label: 'Inventory', to: '/operations/inventory', icon: 'Package' })
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
  const dock = []
  if (canQueue) dock.push({ label: 'Wash', to: '/operations/queue', icon: 'ClipboardList', end: true })
  if (canQueue) dock.push({ label: 'Detail', to: '/operations/queue?family=detailing', icon: 'Layers' })
  if (canEdit) dock.push({ label: 'New', to: '/operations/queue/new', icon: 'Plus', primary: true })
  if (canQueue) dock.push({ label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' })
  if (canQueue) dock.push({ label: 'Attendance', to: '/operations/attendance', icon: 'Clock' })
  if (canQueue) dock.push({ label: 'Crew', to: '/operations/crew', icon: 'Users' })
  return dock.slice(0, 5)
}

export function getTeamLeadMore(profile) {
  const more = []
  if (canAccessHistory(profile)) more.push({ label: 'History', to: '/operations/history', icon: 'History' })
  if (canViewQueueOperations(profile)) more.push({ label: 'KPI', to: '/operations/kpi', icon: 'BarChart3' })
  if (canViewQueueOperations(profile)) more.push({ label: 'Crew', to: '/operations/crew', icon: 'Users' })
  if (canViewAssignedTasks(profile)) more.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  if (canViewPlanning(profile)) more.push({ label: 'Planner', to: '/operations/planning?tab=forms', icon: 'Columns3' })
  return more
}

/** Branch Admin thumb dock — POS primary (checkout), Floor + Queue + Attendance. */
export function getBranchAdminDock(profile) {
  if (!isBranchAdmin(profile)) return []
  const dock = []
  if (canViewQueueOperations(profile)) dock.push({ label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' })
  if (canViewQueueOperations(profile)) dock.push({ label: 'Wash', to: '/operations/queue', icon: 'ClipboardList', end: true })
  if (canAccessAttendance(profile)) dock.push({ label: 'Attendance', to: '/operations/attendance', icon: 'Clock' })
  if (canAccessPos(profile)) dock.push({ label: 'POS', to: '/operations/pos', icon: 'ShoppingCart', primary: true })
  return dock
}

/** Optional overflow for Branch Admin (public kiosk links live on the queue page). */
export function getBranchAdminMore(profile) {
  if (!isBranchAdmin(profile)) return []
  const more = []
  if (canViewQueueOperations(profile)) {
    more.push({ label: 'Detail', to: '/operations/queue?family=detailing', icon: 'Layers' })
  }
  if (canAccessHistory(profile)) {
    more.push({ label: 'History', to: '/operations/history', icon: 'History' })
  }
  return more
}

/** Sales thumb dock — form bookings only (Hakum floor shell). */
export function getSalesDock(profile) {
  if (!isSalesRole(profile)) return []
  return [
    { label: 'Bookings', to: '/operations/bookings', icon: 'Kanban', primary: true, end: true },
    { label: 'History', to: '/operations/history', icon: 'History' },
  ]
}

export function getSalesMore(profile) {
  if (!isSalesRole(profile)) return []
  return []
}

export function redirectForRole(role) {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ASSISTANT_SUPER_ADMIN) {
    return '/operations/console'
  }
  if (role === ROLES.ADMIN) return '/operations/pos'
  if (role === ROLES.STAFF) return '/operations/attendance'
  if (role === ROLES.TEAM_LEAD) return '/operations/queue'
  if (role === ROLES.SALES) return '/operations/bookings'
  if (role === ROLES.MARKETING) return '/operations/crm'
  // legacy cashier still lands on POS
  if (role === DEPRECATED_ROLES.CASHIER) return '/operations/pos'
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
    attendance: canAccessAttendance,
    kpi: canViewQueueOperations,
    'my-tasks': canViewAssignedTasks,
    pos: canAccessPos,
    inventory: canAccessInventory,
    finance: canAccessFinance,
    crm: canAccessCrm,
    bookings: canAccessBookingBoard,
    reports: canAccessReports,
    memberships: canAccessMemberships,
    settings: canAccessSettings,
    content: canManageSiteContent,
    notifications: canAccessNotifications,
    history: canAccessHistory,
  }
  const fn = map[key]
  return fn ? fn(profile) : false
}
