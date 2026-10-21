/**
 * Single source of truth for Hakum RBAC.
 * Named-account sheet (19 Oct 2026): docs/OPS/RBAC-MATRIX.md — do not drift.
 * BossMich = Owner + Super Admin (identical full access). assistant_super_admin = General Admin (no Floor Board).
 */

import { canTransferVehicle } from '../lib/vehicleTransfer.js'

export const ROLES = {
  SUPER_ADMIN: 'BossMich',
  ASSISTANT_SUPER_ADMIN: 'assistant_super_admin',
  ADMIN: 'admin',
  /** Network-wide ops: TL∪BA surface, all branches, planner; no attendance clock. */
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
    keys: ['crm', 'content', 'inquiries', 'notifications'],
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
  ROLES.STAFF,
  ROLES.ADMIN,
  ROLES.OPERATIONS_LEAD,
  ROLES.TEAM_LEAD,
  ROLES.SUPER_ADMIN,
  ROLES.ASSISTANT_SUPER_ADMIN,
  // ponytail: detailer works Bookings only — wash Queue deep-links stay denied
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

/** Read-only, branch-scoped: Floor Board, POS (view), Finance + Reports. */
export function isInvestor(profile) {
  return profile?.role === ROLES.INVESTOR
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
  // Sales, Marketing, Operations Lead — network-wide scope (19 Oct matrix: All Branches).
  if (profile?.role === ROLES.SALES || profile?.role === ROLES.MARKETING || isOperationsLead(profile)) return null
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

/** Branch Admin rings up at list price — only SA / ASA may reprice a sale. */
export function canDiscountPosSale(profile) {
  return canAccessPos(profile) && !isBranchAdmin(profile)
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

/** POS counter writes: expenses and detailing salary drafts. Branch Admin is included. */
export function canWriteFinance(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_write')
  if (profile?.role === ROLES.INVESTOR) return false
  return profile?.role === ROLES.ADMIN
}

/** Finance books (categories, bills, vendors). Not the counter, and not shift-close accept. */
export function canEditFinanceBooks(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_write')
  return false
}

/** Matches ops_pos_settings + shift_close_field_config write RLS (SA / ASA finance_write). */
export function canWritePosSettings(profile) {
  if (isSuperAdmin(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'finance_write')
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
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF, ROLES.DETAILER, ROLES.VIDEO_EDITOR].includes(
    profile.role,
  )
}

/** Personal geofenced time in / time out — not Operations Lead (salary without attendance). Marketing has no HR. */
export function canUseAttendanceClock(profile) {
  if (!profile) return false
  if (isOperationsLead(profile)) return false
  if (profile.attendance_enabled === false) return false
  return [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.STAFF, ROLES.DETAILER, ROLES.VIDEO_EDITOR].includes(
    profile.role,
  )
}

/** Compatibility guard for stale links and stored permission payloads. */
export function canAccessConsole() {
  return false
}

export function canEditBookings(profile) {
  // Service/price edits: Super Admin only. Customer Rep (sales) is detailing read-only (RBAC matrix).
  return isSuperAdmin(profile)
}

export function canCreateBookings(profile) {
  return isSuperAdmin(profile) || profile?.role === ROLES.TEAM_LEAD
}

/** Team Lead sets the final date. Branch Admin and Customer Rep are detailing read-only. */
export function canConfirmBookingSchedule(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'bookings')
  return profile?.role === ROLES.TEAM_LEAD
}

/** CRM view. Matrix: TL + Marketing read; BA + Customer Rep (sales) create/modify; Investor none. */
export function canAccessCrm(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'crm')
  return has(profile, [ROLES.MARKETING, ROLES.SALES, ROLES.OPERATIONS_LEAD, ROLES.TEAM_LEAD, ROLES.ADMIN])
}

/** CRM writes: BA + Customer Rep (sales) + Marketing is read-only. Ops Lead and Team Lead are read-only. */
export function canEditCrm(profile) {
  return canAccessCrm(profile) && !has(profile, [ROLES.MARKETING, ROLES.OPERATIONS_LEAD, ROLES.TEAM_LEAD])
}

/** @deprecated CRM-edit alias. Campaign SMS uses canSendCustomerSms. */
export function canAccessMarketing(profile) {
  return canEditCrm(profile)
}

/** Manual SMS campaigns. Customer Rep edits the customer file and does not send blasts. */
export function canSendCustomerSms(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'crm')
  return isBranchAdmin(profile)
}

/** Bookings view: Sales, Super Admin/ASA, Marketing (readonly), Detailer, TL (ticket), Branch Admin (readonly). */
export function canAccessBookingBoard(profile) {
  if (profile?.role === ROLES.MARKETING) return true
  if (profile?.role === ROLES.DETAILER) return true
  if (profile?.role === ROLES.TEAM_LEAD) return true
  if (isBranchAdmin(profile)) return true
  if (isSuperAdmin(profile)) return true
  if (isInvestor(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'bookings')
  return profile?.role === ROLES.SALES
}

/** Advance detailing board status without editing services (TL / SA / Sales / OL / Detailer). Branch Admin is view-only. */
export function canAdvanceBookingStatus(profile) {
  if (isBranchAdmin(profile)) return false
  return has(profile, [
    ...ADMIN_ROLES,
    ROLES.TEAM_LEAD,
    ROLES.OPERATIONS_LEAD,
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

/** Marketing and Customer Rep (sales) are detailing read-only. */
export function canCheckInFormBooking(profile) {
  if (!profile) return false
  if (profile.role === ROLES.MARKETING || profile.role === ROLES.SALES) return false
  if (isSuperAdmin(profile)) return true
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
    has(profile, [ROLES.STAFF, ROLES.TEAM_LEAD, ROLES.MARKETING, ROLES.SALES, ROLES.VIDEO_EDITOR])
  )
}

export function canEditPlanning(profile) {
  if (isSuperAdmin(profile)) return true
  if (isBranchAdmin(profile) || isOperationsLead(profile)) return true
  return isAssistantSuperAdmin(profile) && hasGrant(profile, 'planning_edit')
}

/**
 * Who may submit an ops form kind (staff fill). SA edits templates but does not fill cash advance.
 * Equipment repairs: crew (staff) only. Cash advance: all employees except Super Admin.
 * Complaint / Events RSVP / detailing / custom: any planning viewer (plus public share links).
 */
/** Super Admin, or any Assistant Super Admin. Branch Admin types the code; they do not mint it. */
export function canApproveCashAdvance(profile) {
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
}

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
  if (kind === 'complaint' || kind === 'event' || kind === 'detailing' || kind === 'custom') return canViewPlanning(profile)
  return false
}

/** Own cash-advance submissions list (drawer cash, not P&L). */
export function canAccessMyAdvances(profile) {
  return canSubmitOpsFormKind(profile, 'cash_advance')
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

/** The Queue itself (board, tickets, add service): SA, ASA (queue_all), branch TL, Operations Lead only. */
export function canAccessQueuePage(profile) {
  return canEditQueueOperations(profile)
}

/** Queue board view: editors, plus read-only BA, Marketing, Customer Rep, Investor (19 Oct matrix). */
export function canViewQueueBoard(profile) {
  if (canAccessQueuePage(profile)) return true
  return has(profile, [ROLES.SALES, ROLES.ADMIN, ROLES.MARKETING, ROLES.INVESTOR])
}

/** Who may open a ticket from the Queue board. Read-only roles never edit. */
export function canEditQueueTicket(profile) {
  return canEditQueueOperations(profile)
}

/** Adding a service line to a queue ticket follows the same four roles. */
export function canAddQueueService(profile) {
  return canAccessQueuePage(profile)
}

export function canViewQueueOperations(profile) {
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  return has(profile, QUEUE_VIEWER_ROLES)
}

/**
 * Floor Board: Owner + Super Admin (BossMich) and crew watch.
 * General Admin, Branch Admin, Team Lead, Marketing, Customer Rep, and Investor have no Floor Board (docs/OPS/RBAC-MATRIX.md).
 */
export function canAccessFloorBoard(profile) {
  if (isSuperAdmin(profile)) return true
  return profile?.role === ROLES.STAFF
}

/**
 * Month KPI (/operations/kpi): Operations Lead (no Floor Board) + Super Admin.
 * Live wait / service / failed QA stay on Floor Board for everyone else.
 */
export function canAccessKpi(profile) {
  if (isSuperAdmin(profile)) return true
  return isOperationsLead(profile)
}

const TEAM_LEAD_BOOKING_VIEWS = Object.freeze(['board', 'calendar'])

/** Bookings view tabs a role may switch between. */
export function allowedBookingViews(profile, views) {
  if (profile?.role !== ROLES.TEAM_LEAD) return views
  return views.filter((view) => TEAM_LEAD_BOOKING_VIEWS.includes(view.id))
}

/** Failed-QA visibility follows the Floor Board observer scope; correction actions remain separately gated. */
export function canViewRedoLane(profile) {
  if (has(profile, [ROLES.TEAM_LEAD, ROLES.STAFF])) return true
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

/** Only the Team Lead moves a ticket out of Final Checking; Admin / SA then collect it at POS. */
export function canPushFinalCheckToPayment(profile) {
  return profile?.role === ROLES.TEAM_LEAD
}

/** Legacy TL port: Team Lead never sees the For Payment lane; console tier does. */
export function canSeeForPaymentLane(profile) {
  return isAdmin(profile) || isOperationsLead(profile) || isInvestor(profile)
}

/** Super Admin / ASA(queue_all) / Operations Lead may pull tickets back. Branch Admin is view-only. */
export function canOverrideQueueStatus(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'queue_all')
  return isOperationsLead(profile)
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

/** Promo voucher board writes — Owner / Super Admin / General Admin. */
export function canManageVouchers(profile) {
  return isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
}

/** Voucher board: managers, plus Investor read-only (19 Oct matrix). */
export function canViewVouchers(profile) {
  return canManageVouchers(profile) || isInvestor(profile)
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

/** Command sidebar order. Sir Michi, 18 Oct 2026. */
export const COMMAND_NAV_GROUP_ORDER = Object.freeze([
  'insight',
  'hr',
  'customers',
  'config',
  'ops-insight',
])

export const COMMAND_NAV_GROUP_LABELS = Object.freeze({
  insight: 'Floor Insight',
  hr: 'Human Resource',
  customers: 'Customers',
  config: 'Configuration',
  'ops-insight': 'Operations Insight',
})

function nav(label, to, icon, group) {
  return { label, to, icon, group }
}

/** Group the nav in list order. Callers put Floor Insight items first. */
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
  if (isInvestor(profile)) {
    return [
      nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'),
      nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'),
      nav('Point of Sales', '/operations/pos', 'ShoppingCart', 'insight'),
      nav('Vouchers', '/operations/vouchers', 'TicketPercent', 'insight'),
      nav('Financials', '/operations/finance', 'Wallet', 'insight'),
    ]
  }

  if (profile?.role === ROLES.VIDEO_EDITOR) {
    return [
      nav('Calendar', '/operations/planning?tab=calendar', 'Columns3', 'work'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'work'),
    ]
  }

  if (profile?.role === ROLES.DETAILER) {
    return [
      nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'),
      nav('Attendance', '/operations/attendance', 'Clock', 'hr'),
      nav('My advances', '/operations/my-advances', 'Wallet', 'hr'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'hr'),
    ]
  }

  if (profile?.role === ROLES.MARKETING) {
    return [
      nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'),
      nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'),
      nav('Team Planner', '/operations/planning', 'Columns3', 'insight'),
      nav('Customers', '/operations/crm', 'Contact', 'customers'),
      nav('Notifications', '/operations/notifications', 'Bell', 'ops-insight'),
      nav('History', '/operations/history', 'History', 'ops-insight'),
    ]
  }

  if (profile?.role === ROLES.SALES) {
    return [
      nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'),
      nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'),
      nav('Team Planner', '/operations/planning', 'Columns3', 'insight'),
      nav('Customers', '/operations/crm', 'Contact', 'customers'),
      nav('History', '/operations/history', 'History', 'ops-insight'),
    ]
  }

  // Branch Admin: no Floor Board. Queue + detailing are read-only. POS + finance + HR are full.
  if (isBranchAdmin(profile)) {
    return [
      nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'),
      nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'),
      nav('Team Planner', '/operations/planning', 'Columns3', 'insight'),
      nav('Point of Sales', '/operations/pos', 'ShoppingCart', 'insight'),
      nav('Financials', '/operations/finance', 'Wallet', 'insight'),
      nav('Inventory', '/operations/inventory', 'Package', 'insight'),
      nav('Attendance', '/operations/attendance', 'Clock', 'hr'),
      nav('Customers', '/operations/crm', 'Contact', 'customers'),
      nav('My advances', '/operations/my-advances', 'Wallet', 'hr'),
      nav('History', '/operations/history', 'History', 'ops-insight'),
      nav('Audit', '/operations/audit', 'ScrollText', 'ops-insight'),
      nav('Transfer car', '/operations/vehicle-transfer', 'ArrowLeftRight', 'config'),
    ]
  }

  // Operations Lead: network-wide BA∪TL ops, no personal clock.
  if (isOperationsLead(profile)) {
    return [
      nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'),
      nav('Team Planner', '/operations/planning', 'Columns3', 'insight'),
      nav('Point of Sales', '/operations/pos', 'ShoppingCart', 'insight'),
      nav('Financials', '/operations/finance', 'Wallet', 'insight'),
      nav('Customers', '/operations/crm', 'Contact', 'customers'),
      nav('My advances', '/operations/my-advances', 'Wallet', 'hr'),
      nav('Month KPI', '/operations/kpi', 'Gauge', 'ops-insight'),
      nav('History', '/operations/history', 'History', 'ops-insight'),
      nav('Audit', '/operations/audit', 'ScrollText', 'ops-insight'),
    ]
  }

  // Crew can observe their branch floor without gaining queue editing rights.
  if (profile?.role === ROLES.STAFF) {
    return [
      nav('Attendance', '/operations/attendance', 'Clock', 'hr'),
      nav('My advances', '/operations/my-advances', 'Wallet', 'hr'),
      nav('Floor Board', '/operations/dashboard', 'Gauge', 'insight'),
      nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'hr'),
      nav('Team Planner', '/operations/planning', 'Columns3', 'insight'),
    ]
  }

  const items = []
  const floorBoardLabel =
    isSuperAdmin(profile) || isAssistantSuperAdmin(profile)
      ? 'Floor Board'
      : isAdmin(profile)
        ? 'Queue View'
        : 'Dashboard'

  if (canAccessFloorBoard(profile)) {
    items.push(nav(floorBoardLabel, '/operations/dashboard', 'Gauge', 'insight'))
  }
  if (canAccessQueuePage(profile)) {
    items.push(nav('Carwash Queue', '/operations/queue', 'ClipboardList', 'insight'))
  }
  if (canAccessBookingBoard(profile)) {
    items.push(nav('Detailing Schedule', '/operations/bookings', 'Kanban', 'insight'))
  }
  if (canViewPlanning(profile)) {
    items.push(nav('Team Planner', '/operations/planning', 'Columns3', 'insight'))
  }
  if (canAccessPos(profile)) {
    items.push(nav('Point of Sales', '/operations/pos', 'ShoppingCart', 'insight'))
  }
  if (canManageVouchers(profile)) {
    items.push(nav('Vouchers', '/operations/vouchers', 'TicketPercent', 'insight'))
  }
  if (canAccessInventory(profile)) {
    items.push(nav('Inventory', '/operations/inventory', 'Package', 'insight'))
  }
  if (canAccessFinance(profile)) {
    items.push(nav('Financials', '/operations/finance', 'Wallet', 'insight'))
  } else if (canAccessReports(profile)) {
    items.push(nav('Financials', '/operations/finance?tab=reports', 'Wallet', 'insight'))
  }
  if (canEditFinanceBooks(profile)) {
    items.push(nav('Monthly salaries', '/operations/monthly-payroll', 'Banknote', 'insight'))
  }

  if (canViewQueueOperations(profile) || (canAccessAttendance(profile) && profile?.role !== ROLES.STAFF)) {
    items.push(nav('Attendance', '/operations/attendance', 'Clock', 'hr'))
  }
  if (canAccessMyAdvances(profile) && profile?.role !== ROLES.STAFF) {
    items.push(nav('My advances', '/operations/my-advances', 'Wallet', 'hr'))
  }
  if (canViewAssignedTasks(profile) && profile?.role !== ROLES.STAFF && !isSuperAdmin(profile)) {
    items.push(nav('My Tasks', '/operations/my-tasks', 'ListChecks', 'hr'))
  }

  if (canAccessCrm(profile)) {
    items.push(nav('Customers', '/operations/crm', 'Contact', 'customers'))
  }
  if (canAccessMemberships(profile)) {
    items.push(nav('Memberships', '/operations/memberships', 'Crown', 'customers'))
  }
  if (canAccessInquiries(profile)) {
    items.push(nav('Inquiries', '/operations/inquiries', 'Inbox', 'customers'))
  }

  if (canManageBranches(profile)) {
    items.push(nav('Branches', '/operations/branches', 'Building2', 'config'))
  }
  if (canManageServices(profile)) {
    items.push(
      nav('Services and Packages', '/operations/inventory?tab=bay', 'Car', 'config'),
      nav('Detailing Packages', '/operations/inventory?tab=detailing', 'Sparkles', 'config'),
    )
  }
  if (canManageVehicleCatalog(profile)) {
    items.push(nav('Vehicle List', '/operations/cars', 'CarFront', 'config'))
  }
  if (canManagePeople(profile)) {
    items.push(nav('RBAC Delegation', '/operations/people', 'UserPlus', 'config'))
  }
  if (canTransferVehicle(profile)) {
    items.push(nav('Transfer car', '/operations/vehicle-transfer', 'ArrowLeftRight', 'config'))
  }
  if (canManageSiteContent(profile)) {
    items.push(nav('Content', '/operations/content', 'Newspaper', 'config'))
  }
  if (canAccessSettings(profile)) {
    items.push(nav('Settings', '/operations/settings', 'Settings', 'config'))
  }

  if (canAccessHistory(profile)) {
    items.push(nav('History', '/operations/history', 'History', 'ops-insight'))
  }
  if (canAccessNotifications(profile)) {
    items.push(nav('Notifications', '/operations/notifications', 'Bell', 'ops-insight'))
  }
  if (canAccessAudit(profile)) {
    items.push(nav('Audit', '/operations/audit', 'ScrollText', 'ops-insight'))
  }
  if (canAccessDataCenter(profile)) {
    items.push(nav('Data Center', '/operations/data-center', 'Database', 'ops-insight'))
  }
  return items
}

/** Team Lead floor dock — same allowRoute matrix, fixed thumb order + New ticket when editable. */
export function getTeamLeadDock(profile) {
  const canQueue = canViewQueueOperations(profile)
  const canEdit = canEditQueueOperations(profile)
  const dock = []
  if (canAccessQueuePage(profile)) dock.push({ label: 'Carwash Board', to: '/operations/queue', icon: 'ClipboardList', end: true })
  if (canEdit) dock.push({ label: 'New', to: '/operations/queue/new', icon: 'Plus', primary: true })
  if (canAccessFloorBoard(profile)) dock.push({ label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' })
  if (canQueue) dock.push({ label: 'Attendance', to: '/operations/attendance', icon: 'Clock' })
  if (canAccessBookingBoard(profile)) dock.push({ label: 'Detailing Board', to: '/operations/bookings', icon: 'Kanban' })
  return dock.slice(0, 5)
}

export function getTeamLeadMore(profile) {
  const more = []
  if (canAccessHistory(profile)) more.push({ label: 'History', to: '/operations/history', icon: 'History' })
  if (canViewAssignedTasks(profile)) more.push({ label: 'My Tasks', to: '/operations/my-tasks', icon: 'ListChecks' })
  if (canViewPlanning(profile)) more.push({ label: 'Planner Board', to: '/operations/planning', icon: 'Columns3' })
  if (canAccessMyAdvances(profile)) more.push({ label: 'My advances', to: '/operations/my-advances', icon: 'Wallet' })
  if (canAccessCrm(profile)) more.push({ label: 'Customers', to: '/operations/crm', icon: 'Contact' })
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
    more.push({ label: 'Planner Board', to: '/operations/planning', icon: 'Columns3' })
  }
  return more
}

/** Sales thumb dock — Bookings home, Queue + CRM views (Hakum floor shell). */
export function getSalesDock(profile) {
  if (!isSalesRole(profile)) return []
  return [
    { label: 'Detailing Board', to: '/operations/bookings', icon: 'Kanban', primary: true, end: true },
    { label: 'Carwash Board', to: '/operations/queue', icon: 'ClipboardList', end: true },
    { label: 'CRM', to: '/operations/crm', icon: 'Contact' },
    { label: 'Planner', to: '/operations/planning', icon: 'Columns3' },
    { label: 'History', to: '/operations/history', icon: 'History' },
  ]
}

export function getSalesMore() {
  return []
}

/** Crew thumb dock — attendance primary. */
export function getStaffDock(profile) {
  if (profile?.role !== ROLES.STAFF) return []
  return [
    { label: 'Attendance', to: '/operations/attendance', icon: 'Clock', primary: true, end: true },
    { label: 'Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
    { label: 'Forms', to: '/operations/planning?tab=forms', icon: 'Columns3' },
    { label: 'Advances', to: '/operations/my-advances', icon: 'Wallet' },
  ]
}

export function getStaffMore(profile) {
  if (profile?.role !== ROLES.STAFF) return []
  return [
    { label: 'Floor', to: '/operations/dashboard', icon: 'Gauge' },
  ]
}

/** Marketing FloorApp dock. */
export function getMarketingDock(profile) {
  if (profile?.role !== ROLES.MARKETING) return []
  return [
    { label: 'CRM', to: '/operations/crm', icon: 'Contact', primary: true, end: true },
    { label: 'Detailing Board', to: '/operations/bookings', icon: 'Kanban' },
    { label: 'Planner Board', to: '/operations/planning', icon: 'Columns3' },
    { label: 'Alerts', to: '/operations/notifications', icon: 'Bell' },
  ]
}

export function getMarketingMore(profile) {
  if (profile?.role !== ROLES.MARKETING) return []
  const more = []
  if (canAccessHistory(profile)) more.push({ label: 'History', to: '/operations/history', icon: 'History' })
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

export function getVideoEditorMore() {
  return []
}

/** Detailer — detailing pipeline on Bookings + attendance. */
export function getDetailerDock(profile) {
  if (profile?.role !== ROLES.DETAILER) return []
  return [
    { label: 'Detailing Board', to: '/operations/bookings', icon: 'Kanban', primary: true },
    { label: 'Attendance', to: '/operations/attendance', icon: 'Clock' },
    { label: 'Tasks', to: '/operations/my-tasks', icon: 'ListChecks' },
    { label: 'Advances', to: '/operations/my-advances', icon: 'Wallet' },
  ]
}

export function getDetailerMore() {
  return []
}

export function redirectForRole(role) {
  if (role === ROLES.SUPER_ADMIN) return '/operations/dashboard'
  if (role === ROLES.ASSISTANT_SUPER_ADMIN) return '/operations/queue'
  if (role === ROLES.ADMIN) return '/operations/pos'
  if (role === ROLES.STAFF) return '/operations/attendance'
  if (role === ROLES.TEAM_LEAD || role === ROLES.OPERATIONS_LEAD) return '/operations/queue'
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
  'queue',
  'vehicle-transfer',
  'bookings',
  'attendance',
  'my-advances',
  'pos',
  'finance',
  'crm',
  'inventory',
  'reviews',
  'planning',
  'history',
  'audit',
])

/** Investor chrome: read-only queue, detailing, POS, vouchers, finance. No Floor Board. */
export const INVESTOR_ROUTE_KEYS = Object.freeze(['queue', 'bookings', 'pos', 'vouchers', 'finance', 'reports'])

/** Route allow helpers for App.jsx */
export function allowRoute(profile, key) {
  if (isBranchAdmin(profile)) return BRANCH_ADMIN_ROUTE_KEYS.includes(key)
  if (isInvestor(profile)) return INVESTOR_ROUTE_KEYS.includes(key)
  const map = {
    planning: canViewPlanning,
    people: canManagePeople,
    branches: canManageBranches,
    cars: canManageVehicleCatalog,
    'vehicle-transfer': canTransferVehicle,
    audit: canAccessAudit,
    'data-center': canAccessDataCenter,
    inquiries: canAccessInquiries,
    dashboard: canAccessFloorBoard,
    queue: canViewQueueBoard,
    'queue-new': canEditQueueOperations,
    crew: () => false,
    attendance: canAccessAttendance,
    'my-advances': canAccessMyAdvances,
    kpi: canAccessKpi,
    'my-tasks': canViewAssignedTasks,
    pos: canAccessPos,
    inventory: canAccessInventory,
    finance: canOpenFinanceHub,
    'monthly-payroll': canEditFinanceBooks,
    crm: canAccessCrm,
    bookings: canAccessBookingBoard,
    reviews: canAccessReviews,
    reports: canAccessReports,
    memberships: canAccessMemberships,
    vouchers: canViewVouchers,
    settings: canAccessSettings,
    content: canManageSiteContent,
    notifications: canAccessNotifications,
    history: canAccessHistory,
  }
  const fn = map[key]
  return fn ? fn(profile) : false
}
