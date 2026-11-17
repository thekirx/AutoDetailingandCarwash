import { bearer, json, setCors } from './httpUtil.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'
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
  if (!profile || profile.is_active === false || !profile.role) {
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

function catalogServiceRoute(profile) {
  if (allowRoute(profile, 'inventory')) return '/operations/inventory?tab=bay'
  if (allowRoute(profile, 'pos')) return '/operations/pos'
  if (allowRoute(profile, 'queue-new')) return '/operations/queue/new'
  if (allowRoute(profile, 'bookings')) return '/operations/bookings'
  return null
}

function catalogProductRoute(profile) {
  if (allowRoute(profile, 'inventory')) return '/operations/inventory'
  if (allowRoute(profile, 'pos')) return '/operations/pos'
  return null
}

async function runScopedQueries(db, scope, term) {
  const { profile, branchSlugs } = scope
  if (branchSlugs && branchSlugs.length === 0) {
    // Still permit company-wide items the role explicitly owns (tasks/catalog/vouchers/branches).
  }

  const pattern = `%${term}%`
  const jobs = []

  // 1. Bookings & Floor Queue
  if (scope.canBookings && (branchSlugs === null || branchSlugs.length > 0)) {
    let q = db
      .from('bookings')
      .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, customer_name, queue_number, scheduled_start, services(name, slug, pay_category)')
      .or(`vehicle_plate.ilike.${pattern},customer_name.ilike.${pattern},vehicle_make.ilike.${pattern},vehicle_model.ilike.${pattern}`)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(12)
    if (branchSlugs) q = q.in('branch', branchSlugs)
    jobs.push(
      q.then(({ data }) => {
        const items = []
        for (const r of data || []) {
          if (scope.detailingOnlyBookings && !isDetailingRow(r)) continue
          const to = bookingRoute(profile, r)
          if (!to) continue
          const car = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')
          items.push({
            id: `booking-${r.id}`,
            category: 'bookings',
            label: `${r.vehicle_plate || 'Vehicle'}${r.customer_name && !isInvestor(profile) ? ` · ${r.customer_name}` : ''}`,
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
        .then(({ data }) =>
          (data || []).map((c) => ({
            id: `cust-${c.id}`,
            category: 'customers',
            label: c.full_name || c.phone || 'Customer',
            subtitle: [c.phone, c.email].filter(Boolean).join(' · ') || 'Customer profile',
            badge: 'Customer',
            to: allowRoute(profile, 'crm') ? '/operations/crm' : '/operations/history',
          })),
        ),
    )
  }

  // 3. Vehicles / Plates
  if (scope.canVehicles) {
    const dest = allowRoute(profile, 'history') ? '/operations/history' : '/operations/crm'
    jobs.push(
      db
        .from('vehicles')
        .select('id, plate_number, make, model, vehicle_type')
        .eq('is_archived', false)
        .or(`plate_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
        .limit(6)
        .then(({ data }) =>
          (data || []).map((v) => ({
            id: `veh-${v.id}`,
            category: 'vehicles',
            label: v.plate_number || 'Vehicle',
            subtitle: [v.make, v.model, v.vehicle_type].filter(Boolean).join(' · ') || 'Registered vehicle',
            badge: 'Plate',
            to: dest,
          })),
        ),
    )
  }

  // 4. Planner Tasks (all visible boards vs own assigned tasks only)
  if (scope.canAllPlanning) {
    jobs.push(
      db
        .from('plan_cards')
        .select('id, board_id, title, due_at, branch_slug')
        .eq('is_archived', false)
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(8)
        .then(({ data }) =>
          (data || [])
            .filter((c) => !c.branch_slug || !branchSlugs || branchSlugs.includes(c.branch_slug))
            .slice(0, 5)
            .map((c) => ({
              id: `card-${c.id}`,
              category: 'tasks',
              label: c.title || 'Planner task',
              subtitle: [c.branch_slug, c.due_at ? `Due ${String(c.due_at).slice(0, 10)}` : null]
                .filter(Boolean)
                .join(' · ') || 'Planner card',
              badge: 'Task',
              to: c.board_id ? `/operations/planning?board=${c.board_id}` : '/operations/planning',
            })),
        ),
    )
  } else if (scope.canAssignedTasksOnly) {
    jobs.push(
      db
        .from('plan_card_assignees')
        .select('card_id, plan_cards!inner(id, title, due_at, is_archived)')
        .eq('staff_id', profile.id)
        .eq('plan_cards.is_archived', false)
        .ilike('plan_cards.title', pattern)
        .limit(5)
        .then(({ data }) =>
          (data || []).map((row) => ({
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

  // 5. Form Results (excluding retired 'event' forms)
  if (scope.canFormResults) {
    jobs.push(
      db
        .from('ops_form_submissions')
        .select('id, respondent_label, status, created_at, ops_forms!inner(slug, name, kind)')
        .neq('ops_forms.kind', 'event')
        .ilike('respondent_label', pattern)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) =>
          (data || []).map((s) => ({
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
  if (scope.canCatalog) {
    const svcTo = catalogServiceRoute(profile)
    const prodTo = catalogProductRoute(profile)
    if (svcTo) {
      jobs.push(
        db
          .from('services')
          .select('id, name, category, pay_category')
          .eq('is_active', true)
          .or(`name.ilike.${pattern},category.ilike.${pattern}`)
          .limit(5)
          .then(({ data }) =>
            (data || []).map((s) => ({
              id: `svc-${s.id}`,
              category: 'catalog',
              label: s.name,
              subtitle: [s.category, s.pay_category].filter(Boolean).join(' · ') || 'Service',
              badge: 'Service',
              to: s.pay_category === 'detailing' && allowRoute(profile, 'inventory')
                ? '/operations/inventory?tab=detailing'
                : svcTo,
            })),
          ),
      )
    }
    if (prodTo) {
      jobs.push(
        db
          .from('products')
          .select('id, name, sku, category')
          .eq('is_active', true)
          .or(`name.ilike.${pattern},sku.ilike.${pattern},category.ilike.${pattern}`)
          .limit(5)
          .then(({ data }) =>
            (data || []).map((p) => ({
              id: `prod-${p.id}`,
              category: 'catalog',
              label: p.name,
              subtitle: [p.sku, p.category].filter(Boolean).join(' · ') || 'Product',
              badge: 'Product',
              to: prodTo,
            })),
          ),
      )
    }
  }

  // 7. Staff directory (People managers & Attendance overrides only)
  if (scope.canStaff && (branchSlugs === null || branchSlugs.length > 0)) {
    const staffDest = allowRoute(profile, 'people') ? '/operations/people' : '/operations/attendance'
    let q = db
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug')
      .eq('is_active', true)
      .ilike('full_name', pattern)
      .limit(5)
    if (branchSlugs) q = q.in('branch_slug', branchSlugs)
    jobs.push(
      q.then(({ data }) =>
        (data || []).map((st) => ({
          id: `staff-${st.id}`,
          category: 'staff',
          label: st.full_name || 'Staff member',
          subtitle: `${st.role}${st.branch_slug ? ` · ${st.branch_slug}` : ''}`,
          badge: 'Staff',
          to: staffDest,
        })),
      ),
    )
  }

  // 8. Vouchers
  if (scope.canVouchers) {
    jobs.push(
      db
        .from('promo_vouchers')
        .select('id, code, label, is_active')
        .or(`code.ilike.${pattern},label.ilike.${pattern}`)
        .limit(4)
        .then(({ data }) =>
          (data || []).map((v) => ({
            id: `voucher-${v.id}`,
            category: 'vouchers',
            label: `${v.code}${v.label ? ` · ${v.label}` : ''}`,
            subtitle: v.is_active === false ? 'Inactive voucher' : 'Active voucher',
            badge: 'Voucher',
            to: '/operations/vouchers',
          })),
        ),
    )
  }

  // 9. Branches (filtered to assigned branches when branch-scoped)
  if (scope.canBranches && (branchSlugs === null || branchSlugs.length > 0)) {
    let q = db
      .from('branches')
      .select('slug, name, is_active, coming_soon')
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(4)
    if (branchSlugs) q = q.in('slug', branchSlugs)
    jobs.push(
      q.then(({ data }) =>
        (data || []).map((b) => ({
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
