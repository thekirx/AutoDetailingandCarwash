/**
 * Canonical Operations Navigation & Destination Registry (pure JS — client + server).
 *
 * Single source of truth for:
 * - Route pathname -> RBAC routeKey mapping (used by authRedirect)
 * - Active sidebar item + child accordion + breadcrumb matching (used by OperationsLayout)
 * - Deep-link destination builders shared by Smart Search UI & API (eliminating stale URLs)
 */

/** Longest-first ordered prefix table: `/operations/<prefix>` -> allowRoute key. */
export const OPS_ROUTE_PREFIX_TO_KEY = Object.freeze([
  ['/operations/queue/new', 'queue-new'],
  ['/operations/queue/', 'queue'],
  ['/operations/queue', 'queue'],
  ['/operations/dashboard', 'dashboard'],
  ['/operations/console', 'console'],
  ['/operations/people', 'people'],
  ['/operations/employees', 'employees'],
  ['/operations/branches', 'branches'],
  ['/operations/cars', 'cars'],
  ['/operations/vehicle-transfer', 'vehicle-transfer'],
  ['/operations/audit', 'audit'],
  ['/operations/data-center', 'data-center'],
  ['/operations/system', 'system'],
  ['/operations/inquiries', 'inquiries'],
  ['/operations/crew', 'crew'],
  ['/operations/kpi', 'kpi'],
  ['/operations/my-tasks', 'my-tasks'],
  ['/operations/my-advances', 'my-advances'],
  ['/operations/payslips', 'payslips'],
  ['/operations/approvals', 'approvals'],
  ['/operations/monthly-payroll', 'monthly-payroll'],
  ['/operations/pos', 'pos'],
  ['/operations/merch-shop', 'merch-shop'],
  ['/operations/inventory', 'inventory'],
  ['/operations/finance', 'finance'],
  ['/operations/crm', 'crm'],
  ['/operations/bookings', 'bookings'],
  ['/operations/planning', 'planning'],
  ['/operations/forms', 'planning'],
  ['/operations/settings', 'settings'],
  ['/operations/reports', 'reports'],
  ['/operations/memberships', 'memberships'],
  ['/operations/vouchers', 'vouchers'],
  ['/operations/rewards', 'rewards'],
  ['/operations/reviews', 'reviews'],
  ['/operations/content', 'content'],
  ['/operations/notifications', 'notifications'],
  ['/operations/broadcast', 'notifications'],
  ['/operations/history', 'history'],
  ['/operations/attendance', 'attendance'],
  ['/operations/services', 'inventory'],
  ['/operations/products', 'inventory'],
])

const QUERY_TAB_EXCLUDED_ON_BARE_PARENT = Object.freeze({
  '/operations/inventory': new Set(['cars', 'merch', 'restock', 'recon']),
  '/operations/finance': new Set(['salaries', 'approvals', 'reports']),
  '/operations/employees': new Set(['attendance', 'register', 'employees', 'access', 'settings']),
  '/operations/crm': new Set(['transfer', 'inquiries', 'sms']),
  '/operations/rewards': new Set(['vouchers', 'points-shop', 'referrals']),
  '/operations/planning': new Set(['calendar']),
})

/** Map ops pathname -> allowRoute key (longest match wins). */
export function resolveOpsRouteKeyFromPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return null
  const clean = pathname.split('?')[0].split('#')[0]
  if (!clean.startsWith('/operations') || clean === '/operations' || clean === '/operations/') {
    return null
  }
  for (const [prefix, key] of OPS_ROUTE_PREFIX_TO_KEY) {
    if (clean.startsWith(prefix)) return key
  }
  return null
}

/** Normalize legacy query params so active sidebar highlighting tracks consolidated hubs cleanly. */
export function normalizeOpsNavSearch(pathname, search = '') {
  const params = new URLSearchParams(search || '')
  if (pathname === '/operations/inventory') {
    const tab = params.get('tab')
    if (tab === 'bay' || tab === 'detailing') {
      params.set('tab', 'services')
      if (!params.get('scope')) params.set('scope', tab)
    }
  }
  return params
}

/** Determine whether a nav item (or child sub-link) matches the active URL cleanly. */
export function opsNavIsActive(pathname, search, to) {
  const [path, query] = String(to || '').split('?')
  if (!path) return false
  const have = normalizeOpsNavSearch(pathname, search)
  if (query) {
    const want = new URLSearchParams(query)
    for (const [key, value] of want) {
      if (have.get(key) !== value) return false
    }
    return pathname === path
  }
  const excludedTabs = QUERY_TAB_EXCLUDED_ON_BARE_PARENT[path]
  if (excludedTabs && excludedTabs.has(have.get('tab') || '')) {
    return false
  }
  if (path.endsWith('/console') || path.endsWith('/dashboard')) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

const FALLBACK_BREADCRUMBS = Object.freeze({
  '/operations/inventory': {
    label: 'Catalog & Inventory',
    tabs: {
      services: 'Services & Packages',
      merch: 'Merch & Sellables',
      cars: 'Vehicle List',
      restock: 'Restock Merch',
      recon: 'Sunday Recon',
    },
  },
  '/operations/employees': {
    label: 'Employees',
    tabs: {
      clock: 'Time clock',
      attendance: 'Attendance',
      register: 'Register',
      employees: 'Employee list',
      access: 'RBAC & roles',
      settings: 'Settings',
    },
  },
  '/operations/crm': {
    label: 'Customers',
    tabs: {
      transfer: 'Transfer car',
      inquiries: 'Inquiries',
      sms: 'SMS',
    },
  },
  '/operations/rewards': {
    label: 'Rewards',
    tabs: {
      memberships: 'Memberships',
      vouchers: 'Vouchers',
      'points-shop': 'Points shop',
      referrals: 'Referrals',
    },
  },
  '/operations/branches': { label: 'Branches' },
  '/operations/content': { label: 'Content' },
  '/operations/settings': { label: 'Settings' },
  '/operations/history': { label: 'History' },
  '/operations/notifications': { label: 'Notifications' },
  '/operations/system': { label: 'System & Data' },
  '/operations/payslips': { label: 'Payslips' },
  '/operations/attendance': { label: 'Attendance' },
  '/operations/my-tasks': { label: 'My Tasks' },
  '/operations/my-advances': { label: 'My advances' },
  '/operations/kpi': { label: 'Month KPI' },
})

/** Resolve topbar breadcrumb (`Parent / Child` or `Page`) from active navigation items. */
export function resolveOpsBreadcrumb(navigation = [], pathname = '', search = '', fallback = 'Ops') {
  for (const item of navigation) {
    if (Array.isArray(item.children)) {
      const childMatch = item.children.find((child) => opsNavIsActive(pathname, search, child.to))
      if (childMatch) return `${item.label} / ${childMatch.label}`
    }
    if (opsNavIsActive(pathname, search, item.to)) return item.label
  }
  const clean = String(pathname || '').split('?')[0]
  const fb = FALLBACK_BREADCRUMBS[clean]
  if (fb) {
    const params = normalizeOpsNavSearch(clean, search)
    const tab = params.get('tab')
    if (tab && fb.tabs?.[tab]) return `${fb.label} / ${fb.tabs[tab]}`
    return fb.label
  }
  return fallback
}

/** Append optional `?q=` search filter to a destination URL without clobbering existing query params. */
export function withSearchQuery(baseUrl, q = '') {
  const clean = String(q || '').trim()
  if (!clean || !baseUrl) return baseUrl
  const [path, query = ''] = String(baseUrl).split('?')
  const params = new URLSearchParams(query)
  params.set('q', clean)
  return `${path}?${params.toString()}`
}

/** Canonical Smart Search destination for a service catalog match. */
export function opsServiceSearchUrl(service, { canInventory, canManageCatalog, canPos, canQueueNew, canBookings } = {}) {
  const isDetailing = String(service?.pay_category || '').toLowerCase() === 'detailing'
  const q = service?.name || service?.slug || ''
  if (canInventory && canManageCatalog) {
    const scope = isDetailing ? 'detailing' : 'bay'
    return withSearchQuery(`/operations/inventory?tab=services&scope=${scope}`, q)
  }
  if (canPos) return '/operations/pos'
  if (canQueueNew && !isDetailing) return '/operations/queue/new'
  if (canBookings) return '/operations/bookings'
  if (canInventory) return '/operations/inventory?tab=restock'
  return null
}

/** Canonical Smart Search destination for a merch/inventory product match. */
export function opsProductSearchUrl(product, { canInventory, canManageCatalog, canPos } = {}) {
  const q = product?.name || product?.sku || ''
  if (canInventory) {
    const tab = canManageCatalog ? 'merch' : 'restock'
    return withSearchQuery(`/operations/inventory?tab=${tab}`, q)
  }
  if (canPos) return '/operations/pos'
  return null
}

/** Canonical Smart Search destination for a staff directory match. */
export function opsStaffSearchUrl(staffName, { canPeople, isCommandShell } = {}) {
  if (canPeople) return withSearchQuery('/operations/employees?tab=employees', staffName)
  if (isCommandShell) return withSearchQuery('/operations/employees?tab=attendance', staffName)
  return '/operations/attendance'
}

/** Canonical Smart Search destination for a voucher match. */
export function opsVoucherSearchUrl(code) {
  return withSearchQuery('/operations/rewards?tab=vouchers', code)
}

/** Canonical Smart Search destination for a customer match. */
export function opsCustomerSearchUrl(query, allowCrm) {
  return withSearchQuery(allowCrm ? '/operations/crm' : '/operations/history', query)
}

/** Canonical Smart Search destination for a vehicle / plate match. */
export function opsVehicleSearchUrl(plate, allowHistory) {
  return withSearchQuery(allowHistory ? '/operations/history' : '/operations/crm', plate)
}
