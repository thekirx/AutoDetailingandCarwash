import {
  ROLES,
  allowRoute,
  canAccessInquiries,
  canAccessMemberships,
  canAccessNotifications,
  canAccessPos,
  canAccessReviews,
  canEditPlanning,
  canManageMerchShop,
  canManageServices,
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
    label: 'Customers · Memberships & Loyalty Tiers',
    to: '/operations/crm?tab=memberships',
    group: 'Customers & Messaging',
    keywords: 'memberships tiers loyalty stamps points milestone rewards',
    allow: (p) => canAccessMemberships(p),
  },
  {
    routeKey: 'merch-shop',
    label: 'Customers · Merch Shop & Points Redemptions',
    to: '/operations/crm?tab=merch',
    group: 'Customers & Messaging',
    keywords: 'merch shop points pickup gift redeem stock',
    allow: (p) => canManageMerchShop(p),
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
    label: 'Inventory · Services & Wash Packages',
    to: '/operations/inventory?tab=bay',
    group: 'Catalog & Stock',
    keywords: 'wash wax price small medium large xl',
    allow: (p) => canManageServices(p),
  },
  {
    routeKey: 'inventory',
    label: 'Inventory · Detailing Packages',
    to: '/operations/inventory?tab=detailing',
    group: 'Catalog & Stock',
    keywords: 'ceramic coating ppf tint paint maintenance',
    allow: (p) => canManageServices(p),
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
      group: GROUP_LABELS[item.group] || 'Pages',
      keywords: `${item.label} ${item.to}`,
    })
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
