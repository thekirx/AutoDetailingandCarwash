import {
  ROLES,
  allowRoute,
  canAccessInquiries,
  canAccessMemberships,
  canAccessRewardsHub,
  canAccessNotifications,
  canAccessPos,
  canAccessReviews,
  canEditPlanning,
  canManageMerchShop,
  canManageServices,
  canManageVehicleCatalog,
  canOpenFinanceHub,
  canSendCustomerSms,
  canViewAssignedTasks,
  canViewPlanning,
  getDetailerDock,
  getDetailerMore,
  getMarketingDock,
  getMarketingMore,
  getOperationsNav,
  getSalesDock,
  getSalesMore,
  getStaffDock,
  getStaffMore,
  getTeamLeadDock,
  getTeamLeadMore,
  getVideoEditorDock,
  getVideoEditorMore,
  isSuperAdmin,
  canAccessCrm,
  canAccessHistory,
  canAccessBookingBoard,
  canViewQueueBoard,
  canAccessFloorBoard,
  canAccessInventory,
  canEditQueueOperations,
  isSalesRole,
  canManagePeople,
  canOverrideAttendance,
  canViewVouchers,
  canManageBranches,
  canEditFinanceBooks,
  canAccessApprovals,
  canAccessAudit,
  canAccessDataCenter,
} from '../auth/permissions.js'
import { canTransferVehicle } from '../lib/vehicleTransfer.js'

function roleFloorItems(profile) {
  const role = profile?.role
  if (role === ROLES.TEAM_LEAD) return [...getTeamLeadDock(profile), ...getTeamLeadMore(profile)]
  if (isSalesRole(profile)) return [...getSalesDock(profile), ...getSalesMore(profile)]
  if (role === ROLES.STAFF) return [...getStaffDock(profile), ...getStaffMore(profile)]
  if (role === ROLES.MARKETING) return [...getMarketingDock(profile), ...getMarketingMore(profile)]
  if (role === ROLES.VIDEO_EDITOR) return [...getVideoEditorDock(profile), ...getVideoEditorMore(profile)]
  if (role === ROLES.DETAILER) return [...getDetailerDock(profile), ...getDetailerMore(profile)]
  return []
}

const SUB_DESTINATIONS = [
  {
    routeKey: 'notifications',
    label: 'Notifications · System & BusyBee SMS Copy',
    to: '/operations/notifications?tab=templates',
    group: 'Notifications & Alerts',
    keywords: 'sms text template busybee push copy trigger route character limit',
    allow: (p) => canAccessNotifications(p),
  },
  {
    routeKey: 'notifications',
    label: 'Notifications · Broadcast & Team Push',
    to: '/operations/notifications?tab=broadcast',
    group: 'Notifications & Alerts',
    keywords: 'announcement marketing custom push employees customers audience',
    allow: (p) => canAccessNotifications(p),
  },
  {
    routeKey: 'crm',
    label: 'CRM · BusyBee SMS Campaigns & Log',
    to: '/operations/crm?tab=sms',
    group: 'Customers & Messaging',
    keywords: 'sms template campaign busybee send message',
    allow: (p) => canSendCustomerSms(p),
  },
  {
    routeKey: 'planning',
    label: 'Form Results Board (Detailing, Complaints, Cash Advance)',
    to: '/operations/forms/results',
    group: 'Forms & Planning',
    keywords: 'submissions form results detailing inquiry cash advance feedback complaint',
    allow: (p) => canViewPlanning(p),
  },
  {
    routeKey: 'planning',
    label: 'Planner · Forms & Share Links',
    to: '/operations/planning?tab=forms',
    group: 'Forms & Planning',
    keywords: 'public link detailing form cash advance equipment repairs order preview',
    allow: (p) => canEditPlanning(p) || canViewPlanning(p),
  },
  {
    routeKey: 'planning',
    label: 'Planner · Content & Task Calendar',
    to: '/operations/planning?tab=calendar',
    group: 'Forms & Planning',
    keywords: 'schedule video shoot deadline calendar due dates',
    allow: (p) => canViewPlanning(p),
  },
  {
    routeKey: 'pos',
    label: 'POS · Daily Sheet & Expenses',
    to: '/operations/pos?tab=sheet',
    group: 'Money & Shift',
    keywords: 'cash drawer gcash card expense shift close release pay',
    allow: (p) => canAccessPos(p),
  },
  {
    routeKey: 'finance',
    label: 'Finance · Daily Sheets Approval',
    to: '/operations/finance?tab=sheets',
    group: 'Money & Shift',
    keywords: 'approve sheet payout profit over short',
    allow: (p) => canOpenFinanceHub(p),
  },
  {
    routeKey: 'finance',
    label: 'Finance · Sales & P&L Reports',
    to: '/operations/finance?tab=reports',
    group: 'Money & Shift',
    keywords: 'revenue summary profit loss monthly export',
    allow: (p) => canOpenFinanceHub(p),
  },
  {
    routeKey: 'reviews',
    label: 'Customer Reviews & Feedback',
    to: '/operations/forms/results',
    group: 'Customers & Messaging',
    keywords: 'ratings thumbs up review complaint',
    allow: (p) => canAccessReviews(p),
  },
  {
    routeKey: 'vehicle-transfer',
    label: 'Customers · Transfer Car Ownership',
    to: '/operations/crm?tab=transfer',
    group: 'Customers & Messaging',
    keywords: 'transfer car vehicle plate move owner buyer seller',
    allow: (p) => canTransferVehicle(p),
  },
  {
    routeKey: 'memberships',
    label: 'Rewards · Memberships & Loyalty Tiers',
    to: '/operations/rewards?tab=memberships',
    group: 'Rewards & Loyalty',
    keywords: 'memberships tiers loyalty stamps points milestone rewards',
    allow: (p) => canAccessMemberships(p),
  },
  {
    routeKey: 'vouchers',
    label: 'Rewards · Vouchers & Promo Codes',
    to: '/operations/rewards?tab=vouchers',
    group: 'Rewards & Loyalty',
    keywords: 'vouchers promo codes discount coupon uses limit rewards',
    allow: (p) => canViewVouchers(p),
  },
  {
    routeKey: 'merch-shop',
    label: 'Rewards · Sellables for Points',
    to: '/operations/rewards?tab=points-shop',
    group: 'Rewards & Loyalty',
    keywords: 'sellables merch shop points pickup gift redeem stock rewards',
    allow: (p) => canManageMerchShop(p),
  },
  {
    routeKey: 'rewards',
    label: 'Rewards · Referrals & Bonuses',
    to: '/operations/rewards?tab=referrals',
    group: 'Rewards & Loyalty',
    keywords: 'referral bonus reward points invite friend code settings',
    allow: (p) => canAccessRewardsHub(p) && (isSuperAdmin(p) || canManageServices(p)),
  },
  {
    routeKey: 'employees',
    label: 'Employees · Live Attendance & Crew Floor',
    to: '/operations/employees?tab=attendance',
    group: 'People & Time',
    keywords: 'attendance clock in crew floor assignable blocked wash pool share',
    allow: (p) => allowRoute(p, 'employees') && canOverrideAttendance(p),
  },
  {
    routeKey: 'employees',
    label: 'Employees · Attendance Register & Heatmap',
    to: '/operations/employees?tab=register',
    group: 'People & Time',
    keywords: 'register heatmap export csv override absent late present log',
    allow: (p) => allowRoute(p, 'employees') && canOverrideAttendance(p),
  },
  {
    routeKey: 'people',
    label: 'Employees · Employee List & Provisioning',
    to: '/operations/employees?tab=employees',
    group: 'People & Time',
    keywords: 'employee staff user list create edit deactivate archive supervisor',
    allow: (p) => allowRoute(p, 'people'),
  },
  {
    routeKey: 'people',
    label: 'Employees · RBAC & Roles Delegation',
    to: '/operations/employees?tab=access',
    group: 'People & Time',
    keywords: 'rbac delegation grants assistant admin permissions temp team lead custom roles',
    allow: (p) => allowRoute(p, 'people'),
  },
  {
    routeKey: 'employees',
    label: 'Employees · Geofence, Roles & Late Pay Settings',
    to: '/operations/employees?tab=settings',
    group: 'People & Time',
    keywords: 'geofence radius shift hours attendance roles late arrival pay policy',
    allow: (p) => allowRoute(p, 'employees') && isSuperAdmin(p),
  },
  {
    routeKey: 'inquiries',
    label: 'Customers · Inquiries, Collabs & Complaints',
    to: '/operations/crm?tab=inquiries',
    group: 'Customers & Messaging',
    keywords: 'partnership franchise inquiry leads complaints contact form results',
    allow: (p) => canAccessInquiries(p),
  },
  {
    routeKey: 'settings',
    label: 'Settings · Notifications & SMS Copy',
    to: '/operations/notifications?tab=templates',
    group: 'Configuration',
    keywords: 'edit push sms copy limits templates',
    allow: (p) => canAccessNotifications(p),
  },
  {
    routeKey: 'settings',
    label: 'Settings · Tint Finder Rules & Film Specs',
    to: '/operations/settings/tint-finder',
    group: 'Configuration',
    keywords: 'tint film vlt recommendation pricing',
    allow: (p) => isSuperAdmin(p),
  },
  {
    routeKey: 'settings',
    label: 'Settings · POS Payment Methods & Labels',
    to: '/operations/settings/pos',
    group: 'Configuration',
    keywords: 'pos payment gcash expense categories',
    allow: (p) => canAccessPos(p),
  },
  {
    routeKey: 'settings',
    label: 'Settings · Daily Sheet Splits & Pool Rules',
    to: '/operations/settings/daily-sheet',
    group: 'Configuration',
    keywords: 'payroll split pool commission weight rate',
    allow: (p) => canOpenFinanceHub(p) || isSuperAdmin(p),
  },
  {
    routeKey: 'inventory',
    label: 'Catalog & Inventory · Services & Wash Packages',
    to: '/operations/inventory?tab=services&scope=bay',
    group: 'Catalog & Stock',
    keywords: 'wash wax price small medium large xl services packages',
    allow: (p) => canManageServices(p),
  },
  {
    routeKey: 'inventory',
    label: 'Catalog & Inventory · Detailing Packages',
    to: '/operations/inventory?tab=services&scope=detailing',
    group: 'Catalog & Stock',
    keywords: 'ceramic coating ppf tint paint maintenance detailing',
    allow: (p) => canManageServices(p),
  },
  {
    routeKey: 'inventory',
    label: 'Catalog & Inventory · Merch & Sellables Stock',
    to: '/operations/inventory?tab=merch',
    group: 'Catalog & Stock',
    keywords: 'merch sellables stock on hand restock accessories',
    allow: (p) => canManageServices(p) || canAccessInventory(p),
  },
  {
    routeKey: 'cars',
    label: 'Catalog & Inventory · Vehicle Make / Model List',
    to: '/operations/inventory?tab=cars',
    group: 'Catalog & Stock',
    keywords: 'cars make model size small medium large xl picker catalog',
    allow: (p) => canManageVehicleCatalog(p),
  },
  {
    routeKey: 'monthly-payroll',
    label: 'Financials · Monthly Salaries & Office Payroll',
    to: '/operations/finance?tab=salaries',
    group: 'Money & Shift',
    keywords: 'monthly salaries payroll office staff payslip base salary',
    allow: (p) => canEditFinanceBooks(p),
  },
  {
    routeKey: 'approvals',
    label: 'Financials · Restock & Expense Approvals',
    to: '/operations/finance?tab=approvals',
    group: 'Money & Shift',
    keywords: 'approvals pending restock branch request review',
    allow: (p) => canAccessApprovals(p) && canOpenFinanceHub(p),
  },
  {
    routeKey: 'approvals',
    label: 'Approvals · Restock & Pending Queue',
    to: '/operations/approvals',
    group: 'Money & Shift',
    keywords: 'approvals pending restock branch request review',
    allow: (p) => canAccessApprovals(p) && !canOpenFinanceHub(p),
  },
  {
    routeKey: 'audit',
    label: 'System & Data · Audit Log',
    to: '/operations/system?tab=audit',
    group: 'Reports & Controls',
    keywords: 'audit trail admin action log history',
    allow: (p) => canAccessAudit(p),
  },
  {
    routeKey: 'data-center',
    label: 'System & Data · Data Center Export & Purge',
    to: '/operations/system?tab=data-center',
    group: 'Reports & Controls',
    keywords: 'data center export import json pitr backup purge',
    allow: (p) => canAccessDataCenter(p),
  },
]

const GROUP_LABELS = {
  floor: 'Floor & Queue',
  money: 'Money & Shift',
  hr: 'People & Time',
  customers: 'Customers & Messaging',
  config: 'Configuration',
  'ops-insight': 'Reports & Controls',
}

/**
 * Build deduplicated, RBAC-strict list of all pages & sub-tabs visible to `profile`.
 */
export function buildSmartSearchDestinations(profile) {
  if (!profile?.role) return []
  const out = []
  const byTo = new Map()

  const add = (item) => {
    if (!item?.to) return
    const existing = byTo.get(item.to)
    if (existing) {
      existing.keywords = `${existing.keywords || ''} ${item.keywords || ''} ${item.label || ''}`.trim()
      return
    }
    const copy = { ...item }
    byTo.set(item.to, copy)
    out.push(copy)
  }

  for (const item of getOperationsNav(profile)) {
    add({
      label: item.label,
      to: item.to,
      group: GROUP_LABELS[item.group] || 'Pages',
      keywords: `${item.label} ${item.to}`,
    })
    for (const child of item.children || []) {
      add({
        label: `${item.label} · ${child.label}`,
        to: child.to,
        group: GROUP_LABELS[item.group] || 'Pages',
        keywords: `${item.label} ${child.label} ${child.to}`,
      })
    }
  }

  for (const item of roleFloorItems(profile)) {
    add({
      label: item.label,
      to: item.to,
      group: 'Quick Navigation',
      keywords: `${item.label} ${item.to}`,
    })
  }

  for (const sub of SUB_DESTINATIONS) {
    if (!allowRoute(profile, sub.routeKey)) continue
    if (typeof sub.allow === 'function' && !sub.allow(profile)) continue
    add({
      label: sub.label,
      to: sub.to,
      group: sub.group,
      keywords: `${sub.label} ${sub.keywords} ${sub.to}`,
    })
  }

  return out
}

/**
 * Curated Quick Jump destinations for empty Command Menu state: top-level primary
 * workspaces without dumping every tab/setting row in an overwhelming initial scroll.
 */
export function buildQuickJumpDestinations(profile, limit = 8) {
  if (!profile?.role) return []
  const out = []
  const seen = new Set()
  const add = (item) => {
    if (!item?.to || seen.has(item.to)) return
    seen.add(item.to)
    out.push(item)
  }
  for (const item of getOperationsNav(profile)) {
    add({
      label: item.label,
      to: item.to,
      group: 'Quick Jump',
      keywords: item.label,
    })
    if (out.length >= limit) return out
  }
  for (const item of roleFloorItems(profile)) {
    add({
      label: item.label,
      to: item.to,
      group: 'Quick Jump',
      keywords: item.label,
    })
    if (out.length >= limit) return out
  }
  return out
}

export function filterSmartSearchDestinations(destinations = [], query = '') {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!terms.length) return destinations
  return destinations.filter((item) => {
    const hay = `${item.label || ''} ${item.group || ''} ${item.keywords || ''} ${item.to || ''}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

export function describeSearchCapabilities(profile) {
  if (!profile?.role) return []
  const scopes = ['Pages']
  if (canAccessBookingBoard(profile) || canViewQueueBoard(profile) || canAccessFloorBoard(profile)) {
    scopes.push('Bookings & Queue')
  }
  if (canAccessCrm(profile)) scopes.push('Customers')
  if (canAccessCrm(profile) || canAccessHistory(profile)) scopes.push('Vehicles / Plates')
  if (canViewPlanning(profile) || canViewAssignedTasks(profile)) scopes.push('Tasks & Forms')
  if (
    canManageServices(profile) ||
    canAccessInventory(profile) ||
    canAccessPos(profile) ||
    canEditQueueOperations(profile) ||
    isSalesRole(profile)
  ) {
    scopes.push('Services & Stock')
  }
  if (canManagePeople(profile) || canOverrideAttendance(profile)) scopes.push('Staff')
  if (canViewVouchers(profile)) scopes.push('Vouchers')
  if (canManageBranches(profile)) scopes.push('Branches')
  return scopes
}
