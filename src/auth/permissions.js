/** Single source of truth for Hakum RBAC. BossMich = Super Admin; assistant_super_admin = lesser elevated. */

export const ROLES = {
  SUPER_ADMIN: 'BossMich',
  ASSISTANT_SUPER_ADMIN: 'assistant_super_admin',
  ADMIN: 'admin',
  /** Network-wide ops: TL∪BA surface, all branches, planner, roadmap; no attendance clock. */
  OPERATIONS_LEAD: 'operations_lead',
  TEAM_LEAD: 'team_lead',
  SALES: 'sales',
  STAFF: 'staff',
  MARKETING: 'marketing',
  DETAILER: 'detailer',
  VIDEO_EDITOR: 'video_editor',
  INVESTOR: 'investor',
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
  inquiries: true,
  rbac_edit: false,
  crm: true,
  content: true,
  console: true,
  reviews: true,
  notifications: true,
  history: true,
  bookings: true,
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
  inquiries: 'Inquiries inbox',
  rbac_edit: 'Edit other ASA grants',
  crm: 'CRM',
  content: 'Site content',
  console: 'Console',
  reviews: 'Reviews inbox',
  notifications: 'Notifications',
  history: 'Customer history',
  bookings: 'Bookings board',
}

/** People editor groups — keeps long grant lists scannable. */
export const ASSISTANT_GRANT_GROUPS = [
  {
    id: 'floor',
    label: 'Floor & checkout',
    keys: ['pos', 'queue_all', 'bookings', 'history', 'reviews'],
  },
  {
    id: 'money',
    label: 'Money & reports',
    keys: ['finance_view', 'finance_write', 'reports', 'kpi_all', 'memberships'],
  },
  {
    id: 'ops',
    label: 'Ops setup',
    keys: ['people', 'branches', 'branches_all', 'services_merch', 'planning_edit'],
  },
  {
    id: 'comms',
    label: 'CRM & content',
    keys: ['crm', 'content', 'inquiries', 'notifications', 'console'],
  },
  {
    id: 'admin',
    label: 'Admin',
    keys: ['audit', 'rbac_edit'],
  },
]

/** Merge defaults + patch; unknown keys dropped. */
export function normalizeAssistantGrants(input = {}) {
  const out = { ...DEFAULT_ASSISTANT_GRANTS }
  for (const key of ASSISTANT_GRANT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = Boolean(input[key])
    }
  }
  return out
}

export function countEnabledAssistantGrants(grants = {}) {
  return ASSISTANT_GRANT_KEYS.filter((key) => Boolean(grants[key])).length
}

/** Toggle every grant on, or restore product defaults. */
export function setAssistantGrantsPreset(mode) {
  if (mode === 'all') {
    return Object.fromEntries(ASSISTANT_GRANT_KEYS.map((key) => [key, true]))
  }
  if (mode === 'safe') {
    return normalizeAssistantGrants({
      ...DEFAULT_ASSISTANT_GRANTS,
      finance_write: false,
      planning_edit: false,
      rbac_edit: false,
    })
  }
  return { ...DEFAULT_ASSISTANT_GRANTS }
}

export const SUPER_ADMIN_ROLES = [ROLES.SUPER_ADMIN]
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN, ROLES.ADMIN]
export const QUEUE_EDITOR_ROLES = [
  ROLES.TEAM_LEAD,
  ROLES.OPERATIONS_LEAD,
  ROLES.SUPER_ADMIN,
  ROLES.ASSISTANT_SUPER_ADMIN,
]
export const QUEUE_VIEWER_ROLES = [
  ROLES.ADMIN,
  ROLES.OPERATIONS_LEAD,
  ROLES.TEAM_LEAD,
  ROLES.SUPER_ADMIN,
  ROLES.ASSISTANT_SUPER_ADMIN,
  ROLES.DETAILER,
]
export const OPS_LOGIN_ROLES = [
  ROLES.STAFF,
  ROLES.TEAM_LEAD,
  ROLES.OPERATIONS_LEAD,
  ROLES.SALES,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
  ROLES.ASSISTANT_SUPER_ADMIN,
  ROLES.MARKETING,
  ROLES.DETAILER,
  ROLES.VIDEO_EDITOR,
  ROLES.INVESTOR,
]

const has = (profile, roles) => roles.includes(profile?.role)

export function isSuperAdmin(profile) {
  return has(profile, SUPER_ADMIN_ROLES)
}

export function isAssistantSuperAdmin(profile) {
  return profile?.role === ROLES.ASSISTANT_SUPER_ADMIN
}

export function isOperationsLead(profile) {
  return profile?.role === ROLES.OPERATIONS_LEAD
}

/** Console-tier: owner, assistant, or branch admin */
export function isAdmin(profile) {
  return has(profile, ADMIN_ROLES)
}

export function resolveAssistantGrants(profile) {
  if (!isAssistantSuperAdmin(profile)) return null
  return normalizeAssistantGrants(profile?.permission_grants)
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
  // Sales + Operations Lead — network-wide scope.
  if (profile?.role === ROLES.SALES || isOperationsLead(profile)) return null
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

/** Inquiries inbox (partnership / contact / complaints). Super Admin + ASA only. */
export function canAccessInquiries(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'inquiries')
  return false
}

export function canAccessPos(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'pos')
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.ADMIN
}

export function canAccessFinance(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_view')
  if (profile?.role === ROLES.INVESTOR) return true
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.ADMIN
}

/** Books hub entry: finance_view or the legacy reports grant (Finance → Reports tab). */
export function canOpenFinanceHub(profile) {
  return canAccessFinance(profile) || canAccessReports(profile)
}

export function canWriteFinance(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_write')
  if (profile?.role === ROLES.INVESTOR) return false
  return profile?.role === ROLES.ADMIN
}

/** SA + ASA with finance_view: open the payroll register. Branch Admin runs Finance, not payroll. */
export function canAccessPayroll(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'finance_view')
}

/** SA + ASA with finance_write: confirm a payroll run. */
export function canRunPayroll(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'finance_write')
}

/** Approve / decline cash advances on Payroll (not POS). Same gate as run payroll. */
export function canApproveCashAdvance(profile) {
  return canRunPayroll(profile)
}

/** Employees see their own payouts. Super Admin uses Payroll instead. */
export function canViewOwnPay(profile) {
  if (!profile?.role) return false
  if (isSuperAdmin(profile)) return false
  if (profile.role === ROLES.INVESTOR) return false
  return true
}

export function canAccessReports(profile) {
  if (isSuperAdmin(profile)) return true
  if (profile?.role === ROLES.INVESTOR) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'reports')
}

/** Catalog CRUD (services + merch stock). Branch Admin is checkout-only — no manage tabs. */
export function canManageServices(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'services_merch') || hasGrant(profile, 'pos')
  return false
}

/** BA restock + Sunday recon (scoped). SA/ASA with catalog access also. */
export function canRestockInventory(profile) {
  if (canManageServices(profile)) return true
  return profile?.role === ROLES.ADMIN
}

/** Inventory area: full catalog (SA/ASA) or BA restock/recon only. */
export function canAccessInventory(profile) {
  return canManageServices(profile) || canRestockInventory(profile)
}

export function canManageCrew(profile) {
  return isAdmin(profile) || has(profile, [ROLES.TEAM_LEAD, ROLES.OPERATIONS_LEAD])
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
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.ADMIN
}

/** SA / ASA: blogs + event rich content on landing and customer app. */
export function canManageSiteContent(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'content')
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
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'notifications')
}

/** Super Admin / ASA / Marketing — send broadcast marketing pushes. */
export function canSendBroadcast(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'notifications')
  return profile?.role === ROLES.MARKETING
}

/** Dedicated Notifications page — reminders (SA/ASA) and/or broadcast (SA/ASA/Marketing). */
export function canAccessNotifications(profile) {
  return canManageNotifications(profile) || canSendBroadcast(profile)
}

/** Customer visit History — plate / phone ledger for ops roles. */
export function canAccessHistory(profile) {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'history')
  return [ROLES.SALES, ROLES.TEAM_LEAD, ROLES.OPERATIONS_LEAD, ROLES.MARKETING, ROLES.ADMIN].includes(
    profile.role,
  )
}

/** Super Admin only — master make/model catalog for TL picker */
export function canManageVehicleCatalog(profile) {
  return isSuperAdmin(profile)
}

export function canOverrideAttendance(profile) {
  // SA / ASA / Branch Admin / Operations Lead may correct register rows. TL clocks in but does not override.
  return (
    isSuperAdmin(profile) ||
    isAssistantSuperAdmin(profile) ||
    isOperationsLead(profile) ||
    profile?.role === ROLES.ADMIN
  )
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

/** Dedicated Attendance page: clock (BA/Crew/TL) and/or register/settings (SA/BA/OL). OL has no personal clock. */
export function canAccessAttendance(profile) {
  if (!profile) return false
  if (isSuperAdmin(profile) || isAssistantSuperAdmin(profile) || isOperationsLead(profile)) return true
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF, ROLES.DETAILER, ROLES.MARKETING, ROLES.VIDEO_EDITOR].includes(
    profile.role,
  )
}

/** Personal geofenced time in / time out — not Operations Lead (salary without attendance). */
export function canUseAttendanceClock(profile) {
  if (!profile) return false
  if (isOperationsLead(profile)) return false
  if (profile.attendance_enabled === false) return false
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF, ROLES.DETAILER, ROLES.MARKETING, ROLES.VIDEO_EDITOR].includes(
    profile.role,
  )
}

export function canAccessConsole(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'console')
  return profile?.role === ROLES.ADMIN
}

export function canEditBookings(profile) {
  // Bookings service/price edits: Sales + Super Admin only (client rule).
  return isSuperAdmin(profile) || profile?.role === ROLES.SALES
}

export function canCreateBookings(profile) {
  return isSuperAdmin(profile) || profile?.role === ROLES.SALES
}

export function canAccessCrm(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'crm')
  return profile?.role === ROLES.MARKETING
}

/** @deprecated SMS lives under CRM; kept for redirects */
export function canAccessMarketing(profile) {
  return canAccessCrm(profile)
}

/** Bookings view: Sales, Super Admin/ASA, Marketing (readonly), Detailer (pipeline). TL/Admin use Queue for wash. */
export function canAccessBookingBoard(profile) {
  if (profile?.role === ROLES.MARKETING) return true
  if (profile?.role === ROLES.DETAILER) return true
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'bookings')
  return profile?.role === ROLES.SALES
}

/** Advance detailing board status without editing services (TL / Branch Admin / SA). */
export function canAdvanceBookingStatus(profile) {
  return has(profile, [
    ...ADMIN_ROLES,
    ROLES.TEAM_LEAD,
    ROLES.OPERATIONS_LEAD,
    ROLES.SALES,
    ROLES.DETAILER,
  ])
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
  // SA / ASA / Branch Admin / Operations Lead manage boards; crew + TL + marketing + video open planner.
  return (
    isAdmin(profile) ||
    isOperationsLead(profile) ||
    has(profile, [ROLES.STAFF, ROLES.TEAM_LEAD, ROLES.MARKETING, ROLES.VIDEO_EDITOR])
  )
}

export function canEditPlanning(profile) {
  if (isSuperAdmin(profile)) return true
  if (isBranchAdmin(profile) || isOperationsLead(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'planning_edit')
}

/** Ops Lab — plans / roadmaps / solutions board (SA · ASA · BA · Operations Lead). */
export function canAccessOpsRoadmap(profile) {
  if (!profile?.role) return false
  return (
    isSuperAdmin(profile) ||
    isAssistantSuperAdmin(profile) ||
    isBranchAdmin(profile) ||
    isOperationsLead(profile)
  )
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
      ROLES.DETAILER,
      ROLES.TEAM_LEAD,
      ROLES.OPERATIONS_LEAD,
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
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.TEAM_LEAD
}

/** Re-export day override resolver for clock/queue callers. */
export { resolveEffectiveRole } from '../lib/ownerRevisionsPhase7.js'

export function canViewQueueOperations(profile) {
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  return has(profile, QUEUE_VIEWER_ROLES)
}

/** Redo QC lane — Super Admin + Assistant Super Admin only (not customers, TL, or branch admin). */
export function canViewRedoLane(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'queue_all')
}

/** Failed QA: TL + SA + ASA may send wash/package tickets back from final_checking. */
export function canMarkFailedQa(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.TEAM_LEAD
}

/** Legacy TL port: Team Lead never sees the For Payment lane; console tier does. */
export function canSeeForPaymentLane(profile) {
  return isAdmin(profile) || isOperationsLead(profile)
}

/** Branch Admin / Super Admin / ASA(queue_all) may pull tickets back to earlier lanes. */
export function canOverrideQueueStatus(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.ADMIN
}

export function canViewAssignedTasks(profile) {
  return has(profile, [
    ROLES.STAFF,
    ROLES.DETAILER,
    ROLES.TEAM_LEAD,
    ROLES.OPERATIONS_LEAD,
    ROLES.ADMIN,
    ROLES.SUPER_ADMIN,
    ROLES.ASSISTANT_SUPER_ADMIN,
    ROLES.VIDEO_EDITOR,
  ])
}

export function canAccessReviews(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'reviews')
  if (isOperationsLead(profile)) return true
  return profile?.role === ROLES.ADMIN
}

export function canAccessMemberships(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'memberships')
  return false
}

export function canAccessDataCenter(profile) {
  return isSuperAdmin(profile)
}

/** Branch Admin day-of ops — POS + floor watch + queue view only. */
export function isBranchAdmin(profile) {
  return profile?.role === ROLES.ADMIN
}

/** Web-first Command shell: SA, ASA, Branch Admin, Operations Lead, Investor. */
export function usesCommandShell(profile) {
  return (
    isSuperAdmin(profile) ||
    isAssistantSuperAdmin(profile) ||
    isBranchAdmin(profile) ||
    isOperationsLead(profile) ||
    profile?.role === ROLES.INVESTOR
  )
}

/** Mobile-app Floor shell: TL, crew, sales, marketing, video, detailer. */
export function usesFloorAppShell(profile) {
  return (
    profile?.role === ROLES.TEAM_LEAD ||
    profile?.role === ROLES.STAFF ||
    profile?.role === ROLES.SALES ||
    profile?.role === ROLES.MARKETING ||
    profile?.role === ROLES.VIDEO_EDITOR ||
    profile?.role === ROLES.DETAILER
  )
}

/** Shop-day order for the Command sidebar. Flatten order follows this. */
export const COMMAND_NAV_GROUP_ORDER = Object.freeze([
  'floor',
  'counter',
  'customers',
  'books',
  'work',
  'company',
])

export const COMMAND_NAV_GROUP_LABELS = Object.freeze({
  floor: 'Floor',
  counter: 'Counter',
  customers: 'Customers',
  books: 'Books',
  work: 'Work',
  company: 'Company',
})

function nav(label, to, icon, group) {
  return { label, to, icon, group }
}

/** Cluster nav items into labeled Command groups without reshuffling within a group. */
export function groupOperationsNav(items = []) {
  const groups = []
  for (const item of items) {
    const id = COMMAND_NAV_GROUP_ORDER.includes(item.group) ? item.group : 'more'
    const last = groups[groups.length - 1]
    if (last && last.id === id) {
      last.items.push(item)
      continue
    }
    groups.push({
      id,
      label: COMMAND_NAV_GROUP_LABELS[id] || 'More',
      items: [item],
    })
  }
  return groups
}

/** Nav items for the shared ops shell — filtered by role + grants. */
export function getOperationsNav(profile) {
  if (profile?.role === ROLES.INVESTOR) {
    return [
      nav('Finance', '/operations/finance', 'Wallet', 'books'),
    ]
  }

  if (profile?.role === ROLES.VIDEO_EDITOR) {
    return [
      nav('Calendar', '/operations/planning?tab=calendar', 'Columns3', 'work'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
    ]
  }

  if (profile?.role === ROLES.DETAILER) {
    return [
      nav('Bookings', '/operations/bookings', 'Kanban', 'floor'),
      nav('Attendance', '/operations/attendance', 'Clock', 'floor'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
    ]
  }

  if (profile?.role === ROLES.MARKETING) {
    return [
      nav('CRM', '/operations/crm', 'Contact', 'customers'),
      nav('Bookings', '/operations/bookings', 'Kanban', 'floor'),
      nav('Planner', '/operations/planning', 'Columns3', 'work'),
      nav('Notifications', '/operations/notifications', 'Bell', 'work'),
      nav('History', '/operations/history', 'History', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
    ]
  }

  if (profile?.role === ROLES.SALES) {
    return [
      nav('Bookings', '/operations/bookings', 'Kanban', 'floor'),
      nav('History', '/operations/history', 'History', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
    ]
  }

  // Branch Admin: live floor → counter → customers → work → company.
  if (isBranchAdmin(profile)) {
    return [
      nav('Floor', '/operations/dashboard', 'Gauge', 'floor'),
      nav('Queue', '/operations/queue', 'ClipboardList', 'floor'),
      nav('Attendance', '/operations/attendance', 'Clock', 'floor'),
      nav('POS', '/operations/pos', 'ShoppingCart', 'counter'),
      nav('Inventory', '/operations/inventory', 'Package', 'counter'),
      nav('Reviews', '/operations/reviews', 'Star', 'customers'),
      nav('Planner', '/operations/planning', 'Columns3', 'work'),
      nav('Ops Lab', '/operations/roadmap', 'Map', 'work'),
      nav('History', '/operations/history', 'History', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
      nav('Audit', '/operations/audit', 'ScrollText', 'company'),
    ]
  }

  // Operations Lead: network-wide BA∪TL ops, no personal clock; roadmap owner.
  if (isOperationsLead(profile)) {
    return [
      nav('Floor', '/operations/dashboard', 'Gauge', 'floor'),
      nav('Queue', '/operations/queue', 'ClipboardList', 'floor'),
      nav('Crew', '/operations/crew', 'Users', 'floor'),
      nav('KPI', '/operations/kpi', 'BarChart3', 'floor'),
      nav('POS', '/operations/pos', 'ShoppingCart', 'counter'),
      nav('Reviews', '/operations/reviews', 'Star', 'customers'),
      nav('Planner', '/operations/planning', 'Columns3', 'work'),
      nav('Ops Lab', '/operations/roadmap', 'Map', 'work'),
      nav('History', '/operations/history', 'History', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
      nav('Finance', '/operations/finance', 'Wallet', 'books'),
      nav('Audit', '/operations/audit', 'ScrollText', 'company'),
    ]
  }

  // Crew (staff): clock + assigned work only.
  if (profile?.role === ROLES.STAFF) {
    return [
      nav('Attendance', '/operations/attendance', 'Clock', 'floor'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'work'),
      nav('Planner', '/operations/planning', 'Columns3', 'work'),
      nav('My pay', '/operations/my-pay', 'Banknote', 'books'),
    ]
  }

  const items = []
  const floorBoardLabel =
    isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
      ? 'Floor Board'
      : isAdmin(profile)
        ? 'Queue View'
        : profile?.role === ROLES.TEAM_LEAD
          ? 'Floor'
          : 'Dashboard'

  if (canAccessConsole(profile)) {
    items.push(nav('Console', '/operations/console', 'LayoutDashboard', 'floor'))
  }
  if (canViewQueueOperations(profile)) {
    items.push(
      nav(floorBoardLabel, '/operations/dashboard', 'Gauge', 'floor'),
      nav('Queue', '/operations/queue', 'ClipboardList', 'floor'),
    )
  }
  if (canAccessBookingBoard(profile)) {
    items.push(nav('Bookings', '/operations/bookings', 'Kanban', 'floor'))
  }
  if (canViewQueueOperations(profile)) {
    items.push(
      nav('Attendance', '/operations/attendance', 'Clock', 'floor'),
      nav('Crew', '/operations/crew', 'Users', 'floor'),
      nav('KPI', '/operations/kpi', 'BarChart3', 'floor'),
    )
  } else if (canAccessAttendance(profile) && profile?.role !== ROLES.STAFF) {
    items.push(nav('Attendance', '/operations/attendance', 'Clock', 'floor'))
  }

  if (canAccessPos(profile)) {
    items.push(nav('POS', '/operations/pos', 'ShoppingCart', 'counter'))
  }
  if (canAccessInventory(profile)) {
    items.push(nav('Inventory', '/operations/inventory', 'Package', 'counter'))
  }

  if (canAccessCrm(profile)) {
    items.push(nav('CRM', '/operations/crm', 'Contact', 'customers'))
  }
  if (canAccessReviews(profile)) {
    items.push(nav('Reviews', '/operations/reviews', 'Star', 'customers'))
  }
  if (canAccessMemberships(profile)) {
    items.push(nav('Memberships', '/operations/memberships', 'Crown', 'customers'))
  }

  if (canAccessFinance(profile)) {
    items.push(nav('Finance', '/operations/finance', 'Wallet', 'books'))
  } else if (canAccessReports(profile)) {
    items.push(nav('Finance', '/operations/finance?tab=reports', 'Wallet', 'books'))
  }
  if (canAccessPayroll(profile)) {
    items.push(nav('Payroll', '/operations/payroll', 'Banknote', 'books'))
  }
  if (canViewOwnPay(profile)) {
    items.push(nav('My pay', '/operations/my-pay', 'Banknote', 'books'))
  }

  if (canViewPlanning(profile)) {
    items.push(nav('Planner', '/operations/planning', 'Columns3', 'work'))
  }
  if (canAccessOpsRoadmap(profile)) {
    items.push(nav('Ops Lab', '/operations/roadmap', 'Map', 'work'))
  }
  if (canViewAssignedTasks(profile) && profile?.role !== ROLES.STAFF && !isSuperAdmin(profile)) {
    items.push(nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'work'))
  }
  if (canAccessHistory(profile)) {
    items.push(nav('History', '/operations/history', 'History', 'work'))
  }
  if (canAccessNotifications(profile)) {
    items.push(nav('Notifications', '/operations/notifications', 'Bell', 'work'))
  }

  if (canManagePeople(profile)) {
    items.push(nav('People', '/operations/people', 'UserPlus', 'company'))
  }
  if (canManageBranches(profile)) {
    items.push(nav('Branches', '/operations/branches', 'Building2', 'company'))
  }
  if (canManageVehicleCatalog(profile)) {
    items.push(nav('Cars', '/operations/cars', 'CarFront', 'company'))
  }
  if (canManageSiteContent(profile)) {
    items.push(nav('Content', '/operations/content', 'Newspaper', 'company'))
  }
  if (canAccessAudit(profile)) {
    items.push(nav('Audit', '/operations/audit', 'ScrollText', 'company'))
  }
  if (canAccessDataCenter(profile)) {
    items.push(nav('Data Center', '/operations/data-center', 'Database', 'company'))
  }
  if (canAccessInquiries(profile)) {
    items.push(nav('Inquiries', '/operations/inquiries', 'Inbox', 'company'))
  }
  if (canAccessSettings(profile)) {
    items.push(nav('Settings', '/operations/settings', 'Settings', 'company'))
  }
  return items
}

/** Team Lead floor dock — same allowRoute matrix, fixed thumb order + New ticket when editable. */
export function getTeamLeadDock(profile) {
  const canQueue = canViewQueueOperations(profile)
  const canEdit = canEditQueueOperations(profile)
  const dock = []
  if (canQueue) dock.push({ label: 'Queue', to: '/operations/queue', icon: 'ClipboardList', end: true })
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
  if (canViewAssignedTasks(profile)) more.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  if (canViewPlanning(profile)) more.push({ label: 'Planner', to: '/operations/planning', icon: 'Columns3' })
  if (canViewOwnPay(profile)) more.push({ label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' })
  return more
}

/** Optional overflow for Branch Admin (public kiosk links live on the queue page). */
export function getBranchAdminMore(profile) {
  if (!isBranchAdmin(profile)) return []
  const more = []
  if (canAccessHistory(profile)) {
    more.push({ label: 'History', to: '/operations/history', icon: 'History' })
  }
  if (canViewPlanning(profile)) {
    more.push({ label: 'Planner', to: '/operations/planning', icon: 'Columns3' })
  }
  if (canAccessOpsRoadmap(profile)) {
    more.push({ label: 'Ops Lab', to: '/operations/roadmap', icon: 'Map' })
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
  if (!canViewOwnPay(profile)) return []
  return [{ label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' }]
}

/** Crew thumb dock — attendance primary. */
export function getStaffDock(profile) {
  if (profile?.role !== ROLES.STAFF) return []
  return [
    { label: 'Attendance', to: '/operations/attendance', icon: 'Clock', primary: true, end: true },
    { label: 'Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
    { label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' },
    { label: 'Forms', to: '/operations/planning?tab=forms', icon: 'Columns3' },
  ]
}

export function getStaffMore(profile) {
  if (profile?.role !== ROLES.STAFF) return []
  return []
}

/** Marketing FloorApp dock. */
export function getMarketingDock(profile) {
  if (profile?.role !== ROLES.MARKETING) return []
  return [
    { label: 'CRM', to: '/operations/crm', icon: 'Contact', primary: true, end: true },
    { label: 'Bookings', to: '/operations/bookings', icon: 'Kanban' },
    { label: 'Planner', to: '/operations/planning', icon: 'Columns3' },
    { label: 'Alerts', to: '/operations/notifications', icon: 'Bell' },
  ]
}

export function getMarketingMore(profile) {
  if (profile?.role !== ROLES.MARKETING) return []
  const more = []
  if (canAccessHistory(profile)) more.push({ label: 'History', to: '/operations/history', icon: 'History' })
  if (canViewOwnPay(profile)) more.push({ label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' })
  return more
}

/** Video editor — calendar + tasks only. */
export function getVideoEditorDock(profile) {
  if (profile?.role !== ROLES.VIDEO_EDITOR) return []
  return [
    { label: 'Calendar', to: '/operations/planning?tab=calendar', icon: 'Columns3', primary: true },
    { label: 'Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
  ]
}

export function getVideoEditorMore(profile) {
  if (profile?.role !== ROLES.VIDEO_EDITOR) return []
  if (!canViewOwnPay(profile)) return []
  return [{ label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' }]
}

/** Detailer — detailing pipeline on Bookings + attendance. */
export function getDetailerDock(profile) {
  if (profile?.role !== ROLES.DETAILER) return []
  return [
    { label: 'Bookings', to: '/operations/bookings', icon: 'Kanban', primary: true },
    { label: 'Attendance', to: '/operations/attendance', icon: 'Clock' },
    { label: 'Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
  ]
}

export function getDetailerMore(profile) {
  if (profile?.role !== ROLES.DETAILER) return []
  if (!canViewOwnPay(profile)) return []
  return [{ label: 'Pay', to: '/operations/my-pay', icon: 'Banknote' }]
}

export function redirectForRole(role) {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ASSISTANT_SUPER_ADMIN) {
    return '/operations/console'
  }
  if (role === ROLES.ADMIN) return '/operations/pos'
  if (role === ROLES.OPERATIONS_LEAD) return '/operations/roadmap'
  if (role === ROLES.STAFF) return '/operations/attendance'
  if (role === ROLES.TEAM_LEAD) return '/operations/queue'
  if (role === ROLES.SALES) return '/operations/bookings'
  if (role === ROLES.MARKETING) return '/operations/crm'
  if (role === ROLES.VIDEO_EDITOR) return '/operations/planning?tab=calendar'
  if (role === ROLES.DETAILER) return '/operations/bookings'
  if (role === ROLES.INVESTOR) return '/operations/finance'
  // legacy cashier still lands on POS
  if (role === DEPRECATED_ROLES.CASHIER) return '/operations/pos'
  return '/operations/dashboard'
}

/** Branch Admin Command chrome — gate URLs to the same list. */
export const BRANCH_ADMIN_ROUTE_KEYS = Object.freeze([
  'dashboard',
  'queue',
  'attendance',
  'pos',
  'inventory',
  'reviews',
  'planning',
  'roadmap',
  'history',
  'my-pay',
  'audit',
])

/** Route allow helpers for App.jsx */
export function allowRoute(profile, key) {
  if (isBranchAdmin(profile)) return BRANCH_ADMIN_ROUTE_KEYS.includes(key)
  const map = {
    console: canAccessConsole,
    planning: canViewPlanning,
    roadmap: canAccessOpsRoadmap,
    people: canManagePeople,
    branches: canManageBranches,
    cars: canManageVehicleCatalog,
    audit: canAccessAudit,
    'data-center': canAccessDataCenter,
    inquiries: canAccessInquiries,
    dashboard: canViewQueueOperations,
    queue: canViewQueueOperations,
    'queue-new': canEditQueueOperations,
    crew: canViewQueueOperations,
    attendance: canAccessAttendance,
    kpi: canViewQueueOperations,
    'my-tasks': canViewAssignedTasks,
    pos: canAccessPos,
    inventory: canAccessInventory,
    finance: canOpenFinanceHub,
    payroll: canAccessPayroll,
    'my-pay': canViewOwnPay,
    crm: canAccessCrm,
    bookings: canAccessBookingBoard,
    reviews: canAccessReviews,
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
