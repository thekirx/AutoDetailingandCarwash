import { bearer, json, setCors } from './httpUtil.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'
import { filterSubmissionsByBranchScope } from '../src/lib/opsForms.js'
import {
  opsCustomerSearchUrl,
  opsProductSearchUrl,
  opsServiceSearchUrl,
  opsStaffSearchUrl,
  opsVehicleSearchUrl,
  opsVoucherSearchUrl,
} from '../src/lib/opsNavigationRegistry.js'
import {
  ROLES,
  allowRoute,
  canAccessBookingBoard,
  canAccessCrm,
  canAccessFloorBoard,
  canAccessHistory,
  canAccessInventory,
  canAccessPos,
  canEditQueueOperations,
  canManageBranches,
  canManagePeople,
  canManageServices,
  canOverrideAttendance,
  canSeeAllBranches,
  canViewAssignedTasks,
  canViewPlanning,
  canViewQueueBoard,
  canViewVouchers,
  isAssistantSuperAdmin,
  isBranchAdmin,
  isInvestor,
  isOperationsLead,
  isSalesRole,
  isSuperAdmin,
  usesCommandShell,
} from '../src/auth/permissions.js'

const STAFF_SELECT = 'id, full_name, role, branch_slug, permission_grants, is_active'

/** Strip PostgREST .or() syntax delimiters so user input cannot alter query predicates. */
export function sanitizeSearchTerm(raw) {
  return String(raw || '')
    .trim()
    .replace(/[%_(),*'"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)
}

/**
 * Resolve exact server search permissions & branch scope for an authenticated staff member.
 * Fail-closed: branch-scoped roles with zero assigned branches receive `branchSlugs: []`.
 */
export function resolveSearchScope(profile, extraBranchSlugs = []) {
  if (!profile || profile.is_active === false || profile.is_archived === true || !profile.role) {
    return null
  }
  const hydrated = {
    ...profile,
    branch_slugs: [...new Set([profile.branch_slug, ...(extraBranchSlugs || [])].filter(Boolean))],
  }
  const allBranches = canSeeAllBranches(hydrated)
  const branchSlugs = allBranches ? null : hydrated.branch_slugs

  return {
    profile: hydrated,
    allBranches,
    branchSlugs,
    canBookings:
      canAccessBookingBoard(hydrated) ||
      canViewQueueBoard(hydrated) ||
      canAccessFloorBoard(hydrated),
    detailingOnlyBookings: hydrated.role === ROLES.DETAILER,
    includeBookingPhone: canAccessCrm(hydrated) || canAccessHistory(hydrated),
    canCustomers: canAccessCrm(hydrated),
    canVehicles: canAccessCrm(hydrated) || canAccessHistory(hydrated),
    canAllPlanning: canViewPlanning(hydrated),
    canAssignedTasksOnly: !canViewPlanning(hydrated) && canViewAssignedTasks(hydrated),
    canFormResults:
      canViewPlanning(hydrated) &&
      (isSuperAdmin(hydrated) ||
        isAssistantSuperAdmin(hydrated) ||
        isOperationsLead(hydrated) ||
        isBranchAdmin(hydrated) ||
        hydrated.role === ROLES.TEAM_LEAD),
    canCatalog:
      canManageServices(hydrated) ||
      canAccessInventory(hydrated) ||
      canAccessPos(hydrated) ||
      canEditQueueOperations(hydrated) ||
      isSalesRole(hydrated),
    canStaff: canManagePeople(hydrated) || canOverrideAttendance(hydrated),
    canVouchers: canViewVouchers(hydrated),
    canBranches: canManageBranches(hydrated),
  }
}

function isDetailingRow(row) {
  const cat = String(row?.services?.pay_category || '').toLowerCase()
  const slug = String(row?.services?.slug || '').toLowerCase()
  return (
    cat === 'detailing' ||
    ['ceramic-coating', 'nano-ceramic-tint', 'paint-protection-film', 'paint-maintenance'].includes(slug)
  )
}

function bookingRoute(profile, row) {
  const detailing = isDetailingRow(row)
  if (detailing && allowRoute(profile, 'bookings')) return '/operations/bookings'
  if (allowRoute(profile, 'queue')) return '/operations/queue'
  if (allowRoute(profile, 'bookings')) return '/operations/bookings'
  if (allowRoute(profile, 'dashboard')) return '/operations/dashboard'
  return allowRoute(profile, 'history') ? '/operations/history' : null
}

function unwrapRows(label, result) {
  if (result?.error) {
    console.error(`[smart-search] ${label}:`, result.error.message || result.error)
    return []
  }
  return Array.isArray(result?.data) ? result.data : []
}

function boardVisibleToProfile(board, profile) {
  if (!board) return false
  if (isSuperAdmin(profile) || isAssistantSuperAdmin(profile) || isOperationsLead(profile)) return true
  const allowed = board.visible_roles
  if (!Array.isArray(allowed) || allowed.length === 0) return true
  return allowed.includes(profile?.role)
}

export async function runScopedQueries(db, scope, term) {
  const { profile, branchSlugs } = scope
  const safeBranches = Array.isArray(branchSlugs)
    ? branchSlugs.map((s) => String(s || '').trim()).filter((s) => /^[a-z0-9_-]+$/i.test(s))
    : null
  const pattern = `%${term}%`
  const jobs = []

  // 1. Bookings & Floor Queue
  if (scope.canBookings && (safeBranches === null || safeBranches.length > 0)) {
    const investorOnly = isInvestor(profile)
    const orParts = [
      `vehicle_plate.ilike.${pattern}`,
      `vehicle_make.ilike.${pattern}`,
      `vehicle_model.ilike.${pattern}`,
    ]
    if (!investorOnly) {
      orParts.push(`customer_name.ilike.${pattern}`)
      if (scope.includeBookingPhone) orParts.push(`customer_phone.ilike.${pattern}`)
    }

    let q = db
      .from('bookings')
      .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, customer_name, queue_number, scheduled_start, services(name, slug, pay_category)')
      .or(orParts.join(','))
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(12)
    if (safeBranches) q = q.in('branch', safeBranches)
    jobs.push(
      q.then((res) => {
        const items = []
        for (const r of unwrapRows('bookings', res)) {
          if (scope.detailingOnlyBookings && !isDetailingRow(r)) continue
          const to = bookingRoute(profile, r)
          if (!to) continue
          const car = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')
          items.push({
            id: `booking-${r.id}`,
            category: 'bookings',
            label: `${r.vehicle_plate || 'Vehicle'}${r.customer_name && !investorOnly ? ` · ${r.customer_name}` : ''}`,
            subtitle: `${r.queue_number ? `Q${r.queue_number} · ` : ''}${r.services?.name || 'Visit'} · ${r.branch}${car ? ` · ${car}` : ''}`,
            badge: r.status,
            to,
          })
          if (items.length >= 6) break
        }
        return items
      }),
    )
  }

  // 2. Customers (strictly roles with canAccessCrm; phone/email visible only to CRM-authorized staff)
  if (scope.canCustomers) {
    jobs.push(
      db
        .from('customers')
        .select('id, full_name, phone, email')
        .eq('role', 'customer')
        .eq('is_archived', false)
        .or(`full_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .limit(6)
        .then((res) =>
          unwrapRows('customers', res).map((c) => ({
            id: `cust-${c.id}`,
            category: 'customers',
            label: c.full_name || c.phone || 'Customer',
            subtitle: [c.phone, c.email].filter(Boolean).join(' · ') || 'Customer profile',
            badge: 'Customer',
            to: opsCustomerSearchUrl(c.full_name || c.phone || term, allowRoute(profile, 'crm')),
          })),
        ),
    )
  }

  // 3. Vehicles / Plates
  if (scope.canVehicles && (safeBranches === null || safeBranches.length > 0)) {
    const canHist = allowRoute(profile, 'history')
    let q = db
      .from('vehicles')
      .select('id, plate_number, vehicle_make, vehicle_model, vehicle_type, last_branch')
      .eq('is_archived', false)
      .or(`plate_number.ilike.${pattern},vehicle_make.ilike.${pattern},vehicle_model.ilike.${pattern}`)
      .limit(6)
    if (safeBranches) q = q.in('last_branch', safeBranches)
    jobs.push(
      q.then((res) =>
        unwrapRows('vehicles', res).map((v) => ({
          id: `veh-${v.id}`,
          category: 'vehicles',
          label: v.plate_number || 'Vehicle',
          subtitle: [v.vehicle_make, v.vehicle_model, v.vehicle_type, v.last_branch].filter(Boolean).join(' · ') || 'Registered vehicle',
          badge: 'Plate',
          to: opsVehicleSearchUrl(v.plate_number || v.vehicle_model || term, canHist),
        })),
      ),
    )
  }

  // 4. Planner Tasks (all visible boards vs own assigned tasks only)
  if (scope.canAllPlanning) {
    jobs.push(
      db
        .from('plan_cards')
        .select('id, list_id, title, due_at, plan_lists!inner(board_id, plan_boards!inner(name, visible_roles))')
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(8)
        .then((res) =>
          unwrapRows('plan_cards', res)
            .filter((c) => boardVisibleToProfile(c.plan_lists?.plan_boards, profile))
            .slice(0, 5)
            .map((c) => {
              const boardId = c.plan_lists?.board_id
              const boardName = c.plan_lists?.plan_boards?.name
              return {
                id: `card-${c.id}`,
                category: 'tasks',
                label: c.title || 'Planner task',
                subtitle: [boardName, c.due_at ? `Due ${String(c.due_at).slice(0, 10)}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Planner card',
                badge: 'Task',
                to: boardId ? `/operations/planning?board=${boardId}&card=${c.id}` : '/operations/planning',
              }
            }),
        ),
    )
  } else if (scope.canAssignedTasksOnly) {
    jobs.push(
      db
        .from('plan_card_assignees')
        .select('card_id, plan_cards!inner(id, title, due_at)')
        .eq('staff_id', profile.id)
        .ilike('plan_cards.title', pattern)
        .limit(5)
        .then((res) =>
          unwrapRows('plan_card_assignees', res).map((row) => ({
            id: `mytask-${row.plan_cards.id}`,
            category: 'tasks',
            label: row.plan_cards.title || 'Assigned task',
            subtitle: row.plan_cards.due_at
              ? `Due ${String(row.plan_cards.due_at).slice(0, 10)}`
              : 'My assigned task',
            badge: 'My Task',
            to: '/operations/my-tasks',
          })),
        ),
    )
  }

  // 5. Form Results (excluding retired 'event' forms, respecting canonical branch scope helper)
  if (scope.canFormResults && (safeBranches === null || safeBranches.length > 0)) {
    jobs.push(
      db
        .from('ops_form_submissions')
        .select('id, respondent_label, status, created_at, payload, ops_forms!inner(slug, name, kind)')
        .neq('ops_forms.kind', 'event')
        .ilike('respondent_label', pattern)
        .order('created_at', { ascending: false })
        .limit(8)
        .then((res) =>
          filterSubmissionsByBranchScope(unwrapRows('ops_form_submissions', res), {
            branchFilter: 'all',
            scopeList: safeBranches,
          })
            .slice(0, 5)
            .map((s) => ({
              id: `formsub-${s.id}`,
              category: 'forms',
              label: s.respondent_label || s.ops_forms?.name || 'Form submission',
              subtitle: `${s.ops_forms?.name || 'Form'} · ${String(s.created_at || '').slice(0, 10)}`,
              badge: s.status || 'new',
              to: s.ops_forms?.slug ? `/operations/forms/results/${s.ops_forms.slug}` : '/operations/forms/results',
            })),
        ),
    )
  }

  // 6. Services & Products
  if (scope.canCatalog && (safeBranches === null || safeBranches.length > 0)) {
    const navFlags = {
      canInventory: allowRoute(profile, 'inventory'),
      canManageCatalog: canManageServices(profile),
      canPos: allowRoute(profile, 'pos'),
      canQueueNew: allowRoute(profile, 'queue-new'),
      canBookings: allowRoute(profile, 'bookings'),
    }
    if (navFlags.canInventory || navFlags.canPos || navFlags.canQueueNew || navFlags.canBookings) {
      jobs.push(
        db
          .from('services')
          .select('id, name, slug, pay_category')
          .eq('is_active', true)
          .eq('is_archived', false)
          .or(`name.ilike.${pattern},slug.ilike.${pattern},pay_category.ilike.${pattern}`)
          .limit(5)
          .then((res) =>
            unwrapRows('services', res)
              .map((s) => {
                const to = opsServiceSearchUrl(s, navFlags)
                if (!to) return null
                return {
                  id: `svc-${s.id}`,
                  category: 'catalog',
                  label: s.name,
                  subtitle: [s.pay_category, s.slug].filter(Boolean).join(' · ') || 'Service',
                  badge: 'Service',
                  to,
                }
              })
              .filter(Boolean),
          ),
      )
    }
    if (navFlags.canInventory || navFlags.canPos) {
      let pq = db
        .from('products')
        .select('id, name, sku, category, branch_slug')
        .eq('is_active', true)
        .eq('is_archived', false)
        .or(`name.ilike.${pattern},sku.ilike.${pattern},category.ilike.${pattern}`)
        .limit(5)
      if (safeBranches) pq = pq.or(`branch_slug.is.null,branch_slug.in.(${safeBranches.join(',')})`)
      jobs.push(
        pq.then((res) =>
          unwrapRows('products', res)
            .map((p) => {
              const to = opsProductSearchUrl(p, navFlags)
              if (!to) return null
              return {
                id: `prod-${p.id}`,
                category: 'catalog',
                label: p.name,
                subtitle: [p.sku, p.category, p.branch_slug].filter(Boolean).join(' · ') || 'Product',
                badge: 'Product',
                to,
              }
            })
            .filter(Boolean),
        ),
      )
    }
  }

  // 7. Staff directory (People managers & Attendance overrides only)
  if (scope.canStaff && (safeBranches === null || safeBranches.length > 0)) {
    const staffOpts = {
      canPeople: allowRoute(profile, 'people'),
      isCommandShell: usesCommandShell(profile),
    }
    let q = db
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug')
      .eq('is_active', true)
      .eq('is_archived', false)
      .ilike('full_name', pattern)
      .limit(5)
    if (safeBranches) q = q.in('branch_slug', safeBranches)
    jobs.push(
      q.then((res) =>
        unwrapRows('staff_profiles', res).map((st) => ({
          id: `staff-${st.id}`,
          category: 'staff',
          label: st.full_name || 'Staff member',
          subtitle: `${st.role}${st.branch_slug ? ` · ${st.branch_slug}` : ''}`,
          badge: 'Staff',
          to: opsStaffSearchUrl(st.full_name || term, staffOpts),
        })),
      ),
    )
  }

  // 8. Vouchers
  if (scope.canVouchers) {
    jobs.push(
      db
        .from('promo_vouchers')
        .select('id, code, title, is_active')
        .or(`code.ilike.${pattern},title.ilike.${pattern}`)
        .limit(4)
        .then((res) =>
          unwrapRows('promo_vouchers', res).map((v) => ({
            id: `voucher-${v.id}`,
            category: 'vouchers',
            label: `${v.code}${v.title ? ` · ${v.title}` : ''}`,
            subtitle: v.is_active === false ? 'Inactive voucher' : 'Active voucher',
            badge: 'Voucher',
            to: opsVoucherSearchUrl(v.code || v.title || term),
          })),
        ),
    )
  }

  // 9. Branches (filtered to assigned branches when branch-scoped)
  if (scope.canBranches && (safeBranches === null || safeBranches.length > 0)) {
    let q = db
      .from('branches')
      .select('slug, name, is_active, coming_soon')
      .eq('is_archived', false)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(4)
    if (safeBranches) q = q.in('slug', safeBranches)
    jobs.push(
      q.then((res) =>
        unwrapRows('branches', res).map((b) => ({
          id: `branch-${b.slug}`,
          category: 'branches',
          label: b.name,
          subtitle: b.coming_soon ? 'Coming soon' : b.is_active ? 'Active branch' : 'Archived',
          badge: 'Branch',
          to: '/operations/branches',
        })),
      ),
    )
  }

  const settled = await Promise.allSettled(jobs)
  const results = []
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      results.push(...s.value)
    }
  }
  return results
}

/**
 * GET /api/staff?operation=smart-search&q=<query>
 * Strictly authenticates staff and enforces RBAC + branch boundaries server-side.
 */
export async function handleSmartSearchRequest(req, res) {
  setCors(res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' })

  const db = admin()
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return json(res, 401, { error: 'Unauthorized' })

  const { data: staff } = await db
    .from('staff_profiles')
    .select(STAFF_SELECT)
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .eq('is_archived', false)
    .maybeSingle()

  const { data: extraBranches } = staff
    ? await db
        .from('staff_branch_assignments')
        .select('branch_slug')
        .eq('staff_id', staff.id)
    : { data: [] }

  const scope = resolveSearchScope(
    staff,
    (extraBranches || []).map((b) => b.branch_slug),
  )
  if (!scope) return json(res, 403, { error: 'Forbidden' })

  const url = new URL(req.url, 'http://localhost')
  const term = sanitizeSearchTerm(url.searchParams.get('q'))
  if (term.length < 2) {
    return json(res, 200, { query: term, results: [] })
  }

  const results = await runScopedQueries(db, scope, term)
  return json(res, 200, { query: term, results })
}
