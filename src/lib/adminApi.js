import { isoToDayOfWeek } from './branchHours'
import { supabase } from './supabase'
import { getAccessTokenFresh } from './authToken'
import { getBranchScope } from '../queue/queueLogic'
import { DEFAULT_ASSISTANT_GRANTS, getBranchScopeList } from '../auth/permissions'
import { applyBranchScope, collectInChunks } from './crmInsights'
import { writeAudit } from './audit'
import { smsNotificationsEnabledFromSetting } from './smsNotificationsToggle'
import {
  validateBranchInput,
  validateLoyaltyMilestoneInput,
  validateLoyaltyProgramSettings,
  validateMembershipTierInput,
  validateProvisionStaffInput,
  validateServiceInput,
  validateServiceLoyaltyWeight,
  validateStaffUpdate,
} from './opsValidation'

import { createTtlCache } from './coalesceReload'

const branchesCache = createTtlCache(90_000)
const servicesCache = createTtlCache(90_000)

function mapDbError(error, fallback = 'Request failed.') {
  const msg = error?.message || fallback
  if (/duplicate key|unique constraint/i.test(msg)) return new Error('That record already exists.')
  if (/42501|permission|policy|row-level/i.test(msg)) return new Error('You do not have permission for this action.')
  if (/23514|check constraint/i.test(msg)) return new Error('Invalid values — check required fields and formats.')
  return new Error(msg)
}

/** Nullable catalog salary % (0–100). Blank → null. */
function parseOptionalSalaryPct(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

/** Optional SLA minutes. Blank → null. */
function parseOptionalSlaMinutes(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error('SLA minutes must be a positive whole number.')
  }
  return n
}

export async function listBranches({ includeArchived = false } = {}) {
  const key = includeArchived ? 'all' : 'active'
  const hit = branchesCache.get()
  if (hit && hit.key === key) return hit.rows

  let q = supabase
    .from('branches')
    .select('id, slug, name, code, address, latitude, longitude, coming_soon, is_active, is_archived')
    .order('name')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) throw mapDbError(error)

  /* Hours live in branch_operating_hours, one row per weekday. They must be
     loaded with the branch: the form seeds its hours fields from these rows,
     and loading them empty would clear the branch's real schedule on the next
     save of any unrelated field. */
  const base = data || []
  const { data: hours, error: hoursError } = base.length
    ? await supabase
        .from('branch_operating_hours')
        .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
        .in('branch_slug', base.map((row) => row.slug))
    : { data: [], error: null }
  if (hoursError) throw mapDbError(hoursError)

  const bySlug = new Map()
  for (const entry of hours || []) {
    if (!bySlug.has(entry.branch_slug)) bySlug.set(entry.branch_slug, [])
    bySlug.get(entry.branch_slug).push(entry)
  }
  const rows = base.map((row) => ({ ...row, hours: bySlug.get(row.slug) || [] }))
  branchesCache.set({ key, rows })
  return rows
}

export async function createBranch(input) {
  const v = validateBranchInput(input, { requireSlug: true })
  const { data, error } = await supabase.rpc('create_branch', {
    input_name: v.name,
    input_slug: v.slug,
    input_code: v.code,
    input_address: v.address || '',
    input_latitude: v.latitude,
    input_longitude: v.longitude,
    input_coming_soon: v.coming_soon,
    input_is_active: v.is_active,
  })
  if (error) throw mapDbError(error)
  branchesCache.clear()
  return data
}

export async function updateBranch({ slug, name, code, address, is_active, latitude, longitude, coming_soon, status }) {
  const v = validateBranchInput(
    { name, slug, code, address, latitude, longitude, coming_soon, is_active, status },
    { requireSlug: false },
  )
  if (!slug) throw new Error('Branch slug is required.')
  const { data, error } = await supabase.rpc('update_branch', {
    input_branch_slug: slug,
    input_name: v.name,
    input_code: v.code,
    input_address: v.address || '',
    input_is_active: v.is_active,
    input_latitude: v.latitude,
    input_longitude: v.longitude,
    input_coming_soon: v.coming_soon,
  })
  if (error) throw mapDbError(error)
  branchesCache.clear()
  return data
}

/**
 * Opening hours drive the public "open / opens at" state on the homepage.
 * Kept off updateBranch so that function's signature stays as-is.
 *
 * Writes the whole week to branch_operating_hours as seven rows. The editor
 * offers one opening window plus per-day closed toggles, so every trading day
 * gets the same times; the table itself allows per-day times if the UI ever
 * grows into them.
 *
 * @param {{ slug: string, opensAt: string|null, closesAt: string|null, closedWeekdays?: number[] }} input
 *   Times as "HH:MM"; ISO weekdays (1=Mon…7=Sun) in closedWeekdays. Pass null
 *   for both times to clear the schedule, which puts the public site back to
 *   showing queue length only.
 */
export async function setBranchHours({ slug, opensAt, closesAt, closedWeekdays = [] }) {
  if (!String(slug || '').trim()) throw new Error('Branch slug is required.')
  const opens = String(opensAt || '').trim() || null
  const closes = String(closesAt || '').trim() || null
  if (!!opens !== !!closes) throw new Error('Set both opening and closing time, or clear both.')

  /* Clearing the schedule removes the week outright — the check constraint
     rejects an open day with null times, and "no rows" is what the public
     site reads as "make no claim about availability". */
  if (!opens) {
    const { error } = await supabase.from('branch_operating_hours').delete().eq('branch_slug', slug)
    if (error) throw mapDbError(error)
    branchesCache.clear()
    return null
  }

  const closedDays = new Set((closedWeekdays || []).map(isoToDayOfWeek))
  const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const isClosed = closedDays.has(day)
    return {
      branch_slug: slug,
      day_of_week: day,
      /* A closed day keeps null times: the open-window check only applies to
         days that actually trade. */
      opens_at: isClosed ? null : opens,
      closes_at: isClosed ? null : closes,
      is_closed: isClosed,
      updated_at: new Date().toISOString(),
    }
  })

  const { data, error } = await supabase
    .from('branch_operating_hours')
    .upsert(rows, { onConflict: 'branch_slug,day_of_week' })
    .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
  if (error) throw mapDbError(error)
  branchesCache.clear()
  return data
}

export async function archiveBranch(slug) {
  if (!String(slug || '').trim()) throw new Error('Branch slug is required.')
  const { data, error } = await supabase.rpc('archive_branch', { input_branch_slug: slug })
  if (error) throw mapDbError(error)
  branchesCache.clear()
  return data
}

export async function listBranchOperatingHours(branchSlug) {
  const slug = String(branchSlug || '').trim()
  if (!slug) return []
  const { data, error } = await supabase
    .from('branch_operating_hours')
    .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
    .eq('branch_slug', slug)
    .order('day_of_week')
  if (error) throw mapDbError(error)
  return data || []
}

/** Upsert a full Sun–Sat week for one branch. */
export async function saveBranchOperatingHours(branchSlug, week) {
  const slug = String(branchSlug || '').trim()
  if (!slug) throw new Error('Branch slug is required.')
  const { normalizeWeekHours, validateWeekHours, normalizeTimeInput } = await import('./branchOperatingHours.js')
  const normalized = normalizeWeekHours(week, slug)
  const invalid = validateWeekHours(normalized)
  if (invalid) throw new Error(invalid)

  const rows = normalized.map((row) => ({
    branch_slug: slug,
    day_of_week: row.day_of_week,
    is_closed: Boolean(row.is_closed),
    opens_at: row.is_closed ? null : normalizeTimeInput(row.opens_at),
    closes_at: row.is_closed ? null : normalizeTimeInput(row.closes_at),
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('branch_operating_hours')
    .upsert(rows, { onConflict: 'branch_slug,day_of_week' })
    .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
  if (error) throw mapDbError(error)
  return data || []
}

export async function listStaffPeople({ includeInactive = false } = {}) {
  let q = supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, phone, is_active, is_archived, permission_grants, attendance_enabled, geofence_enabled, employment_type, created_at, updated_at')
    .eq('is_archived', false)
    .order('full_name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  const rows = data || []
  if (!rows.length) return rows
  const ids = rows.map((r) => r.id)
  const assigns = await collectInChunks(ids, async (chunk, from, to) => {
    const { data, error } = await supabase
      .from('staff_branch_assignments')
      .select('staff_id, branch_slug')
      .in('staff_id', chunk)
      .order('staff_id', { ascending: true })
      .range(from, to)
    if (error) throw mapDbError(error)
    return data || []
  })
  const byStaff = new Map()
  for (const a of assigns || []) {
    const list = byStaff.get(a.staff_id) || []
    list.push(a.branch_slug)
    byStaff.set(a.staff_id, list)
  }
  return rows.map((r) => ({
    ...r,
    permission_grants: r.permission_grants || {},
    branch_slugs: byStaff.get(r.id) || (r.branch_slug ? [r.branch_slug] : []),
  }))
}

export async function updateStaffPerson({
  id,
  full_name,
  role,
  branch_slug,
  branch_slugs,
  phone,
  is_active,
  permission_grants,
  attendance_enabled,
  geofence_enabled,
  employment_type,
}) {
  const primary =
    branch_slug || (Array.isArray(branch_slugs) && branch_slugs.length ? branch_slugs[0] : null)
  const v = validateStaffUpdate({
    id,
    full_name,
    role,
    branch_slug: role === 'assistant_super_admin' ? null : primary,
    phone,
  })
  const patch = {
    full_name: v.full_name,
    role: v.role,
    branch_slug: v.role === 'assistant_super_admin' ? null : v.branch_slug,
    phone: v.phone,
    is_active: is_active ?? true,
    updated_at: new Date().toISOString(),
  }
  if (attendance_enabled !== undefined) patch.attendance_enabled = attendance_enabled
  if (geofence_enabled !== undefined) patch.geofence_enabled = geofence_enabled
  if (employment_type !== undefined) patch.employment_type = employment_type
  // Only patch grants when explicitly provided (People UI omits when editor lacks rbac_edit)
  if (
    v.role === 'assistant_super_admin' &&
    permission_grants !== undefined &&
    permission_grants &&
    typeof permission_grants === 'object'
  ) {
    patch.permission_grants = permission_grants
  }

  const { data, error } = await supabase.from('staff_profiles').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Staff profile not found.')

  if (['admin', 'team_lead', 'staff', 'marketing'].includes(v.role)) {
    const slugs = Array.isArray(branch_slugs) && branch_slugs.length
      ? branch_slugs.map(String)
      : v.branch_slug
        ? [v.branch_slug]
        : []
    const { error: delErr } = await supabase.from('staff_branch_assignments').delete().eq('staff_id', id)
    if (delErr) throw mapDbError(delErr)
    if (slugs.length) {
      const { error: insErr } = await supabase
        .from('staff_branch_assignments')
        .insert(slugs.map((slug) => ({ staff_id: id, branch_slug: slug })))
      if (insErr) throw mapDbError(insErr)
    }
  } else if (v.role === 'BossMich') {
    const { error: delErr } = await supabase.from('staff_branch_assignments').delete().eq('staff_id', id)
    if (delErr) throw mapDbError(delErr)
  } else if (v.role === 'assistant_super_admin') {
    const grants = { ...DEFAULT_ASSISTANT_GRANTS, ...(data.permission_grants || {}) }
    const { error: delErr } = await supabase.from('staff_branch_assignments').delete().eq('staff_id', id)
    if (delErr) throw mapDbError(delErr)
    // Scoped ASA needs assignments; all-branch ASA stays clear
    if (grants.branches_all === false) {
      const slugs = Array.isArray(branch_slugs) && branch_slugs.length
        ? branch_slugs.map(String)
        : []
      if (slugs.length) {
        const { error: insErr } = await supabase
          .from('staff_branch_assignments')
          .insert(slugs.map((slug) => ({ staff_id: id, branch_slug: slug })))
        if (insErr) throw mapDbError(insErr)
      }
    }
  }

  await writeAudit({
    action: 'update',
    entityType: 'staff_profile',
    entityId: id,
    summary: `Updated staff ${data.full_name}`,
    meta: { role: data.role, branch_slug: data.branch_slug, is_active: data.is_active },
  })
  return data
}

export async function deactivateStaffPerson(id, { archive = false } = {}) {
  if (!id) throw new Error('Staff id is required.')
  const { data: existing, error: readErr } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle()
  if (readErr) throw mapDbError(readErr)
  if (!existing) throw new Error('Staff profile not found.')
  if (existing.role === 'BossMich') throw new Error('Cannot deactivate Super Admin.')

  const { data, error } = await supabase
    .from('staff_profiles')
    .update({
      is_active: false,
      is_archived: archive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: archive ? 'archive' : 'deactivate',
    entityType: 'staff_profile',
    entityId: id,
    summary: `${archive ? 'Archived' : 'Deactivated'} staff ${data?.full_name || id}`,
  })
  return data
}

export async function provisionStaff(payload) {
  validateProvisionStaffInput(payload)
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/provision-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...payload, site_origin: window.location.origin }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Unable to create account.')
  await writeAudit({
    action: 'create',
    entityType: 'staff_profile',
    entityId: body.user_id || body.auth_user_id || null,
    summary: `Provisioned ${payload.role} ${payload.full_name || payload.email}`,
    meta: { email: payload.email, role: payload.role, branch_slug: payload.branch_slug },
  })
  return body
}

/** Update crew login + profile (email/password/branch via service role). */
export async function updateStaffAccountFields(payload) {
  if (!payload?.id) throw new Error('Staff id is required.')
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/update-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Unable to update staff account.')
  await writeAudit({
    action: 'update',
    entityType: 'staff_profile',
    entityId: payload.id,
    summary: `Updated staff account ${body.full_name || payload.id}`,
    meta: {
      email: payload.email || undefined,
      branch_slug: payload.branch_slug || undefined,
      password_set: Boolean(payload.temporary_password),
    },
  })
  return body
}

export async function listServices({ includeArchived = false } = {}) {
  const key = includeArchived ? 'all' : 'active'
  const hit = servicesCache.get()
  if (hit && hit.key === key) return hit.rows

  let q = supabase
    .from('services')
    .select(
      'id, name, slug, description, price_minor, duration_minutes, sla_minutes, pay_category, salary_pct, is_active, is_archived, display_order, loyalty_weight, included_service_ids, service_size_prices(size_slug, price_minor)',
    )
    .order('display_order')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) {
    // Older DBs without included_service_ids
    if (/included_service_ids/i.test(error.message || '')) {
      let q2 = supabase
        .from('services')
        .select(
          'id, name, slug, description, price_minor, duration_minutes, pay_category, is_active, is_archived, display_order, loyalty_weight, service_size_prices(size_slug, price_minor)',
        )
        .order('display_order')
      if (!includeArchived) q2 = q2.eq('is_archived', false)
      const retry = await q2
      if (retry.error) throw mapDbError(retry.error)
      const rows = (retry.data || []).map((row) => ({
        ...row,
        included_service_ids: [],
        size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
      }))
      servicesCache.set({ key, rows })
      return rows
    }
    throw mapDbError(error)
  }
  const rows = (data || []).map((row) => ({
    ...row,
    included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
    size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
  }))
  servicesCache.set({ key, rows })
  return rows
}

async function replaceServiceSizePrices(serviceId, sizePriceMinor) {
  if (!serviceId) return
  const { error: delErr } = await supabase.from('service_size_prices').delete().eq('service_id', serviceId)
  if (delErr) throw mapDbError(delErr)
  if (!sizePriceMinor || !Object.keys(sizePriceMinor).length) return
  const rows = Object.entries(sizePriceMinor).map(([size_slug, price_minor]) => ({
    service_id: serviceId,
    size_slug,
    price_minor,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('service_size_prices').insert(rows)
  if (error) throw mapDbError(error)
}

export async function createService(payload) {
  const v = validateServiceInput(payload)
  const row = {
    name: v.name,
    slug: v.slug,
    description: payload.description?.trim() || null,
    price_minor: v.price_minor,
    duration_minutes: v.duration_minutes,
    sla_minutes: parseOptionalSlaMinutes(payload.sla_minutes),
    pay_category: v.pay_category,
    display_order: v.display_order,
    is_active: true,
    is_archived: false,
    salary_pct: parseOptionalSalaryPct(payload.salary_pct),
  }
  if (Array.isArray(payload.included_service_ids)) {
    row.included_service_ids = payload.included_service_ids.filter(Boolean)
  }
  const { data, error } = await supabase.from('services').insert(row).select().maybeSingle()
  if (error) throw mapDbError(error)
  await replaceServiceSizePrices(data?.id, v.size_price_minor)
  servicesCache.clear()
  await writeAudit({
    action: 'create',
    entityType: 'service',
    entityId: data?.id,
    summary: `Created service ${data?.name}`,
    meta: { price_minor: data?.price_minor, pay_category: data?.pay_category, size_prices: v.size_price_minor },
  })
  return data
}

export async function updateService(id, payload) {
  if (!id) throw new Error('Service id is required.')
  const v = validateServiceInput({
    name: payload.name,
    slug: payload.slug,
    price: payload.price,
    size_prices: payload.size_prices,
    duration_minutes: payload.duration_minutes,
    display_order: payload.display_order,
    pay_category: payload.pay_category,
  })
  const patch = {
    name: v.name,
    slug: v.slug,
    description: payload.description?.trim() || null,
    price_minor: v.price_minor,
    duration_minutes: v.duration_minutes,
    sla_minutes: parseOptionalSlaMinutes(payload.sla_minutes),
    pay_category: v.pay_category,
    display_order: v.display_order,
    is_active: payload.is_active,
    updated_at: new Date().toISOString(),
    salary_pct: parseOptionalSalaryPct(payload.salary_pct),
  }
  if (payload.is_active === undefined) delete patch.is_active
  if (Array.isArray(payload.included_service_ids)) {
    patch.included_service_ids = payload.included_service_ids.filter(Boolean)
  }

  const { data, error } = await supabase.from('services').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Service not found.')
  await replaceServiceSizePrices(id, v.size_price_minor)
  servicesCache.clear()
  await writeAudit({
    action: 'update',
    entityType: 'service',
    entityId: id,
    summary: `Updated service ${data.name}`,
    meta: { is_active: data.is_active, price_minor: data.price_minor, size_prices: v.size_price_minor },
  })
  return data
}

export async function archiveService(id) {
  if (!id) throw new Error('Service id is required.')
  const { data, error } = await supabase
    .from('services')
    .update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Service not found.')
  servicesCache.clear()
  await writeAudit({
    action: 'archive',
    entityType: 'service',
    entityId: id,
    summary: `Archived service ${data.name}`,
  })
  return data
}

/** Console metrics: sales, expenses, stock, queue — optional branch filter (slug | 'all' | list). */
export async function fetchAdminConsoleSnapshot(profile, branchFilter = 'all') {
  // Prefer explicit UI filter; 'all' for scoped Admin → all assigned branches via getBranchScopeList
  let scope =
    branchFilter && branchFilter !== 'all'
      ? branchFilter
      : (() => {
          const list = getBranchScopeList(profile)
          if (list === null) return null
          if (!list.length) return '__none__'
          return list.length === 1 ? list[0] : list
        })()
  // Legacy single-slug callers may still pass getBranchScope()
  if (scope == null && branchFilter === 'all' && getBranchScope(profile) && getBranchScope(profile) !== '__none__') {
    scope = null
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  let salesQ = supabase.from('daily_sales_summary').select('*').order('sale_date', { ascending: false }).limit(60)
  let expensesQ = supabase
    .from('expenses')
    .select('id, title, total_minor, branch, status, created_at')
    .order('created_at', { ascending: false })
    .limit(80)
  let bookingsQ = supabase
    .from('bookings')
    .select('id, branch, status, customer_name, vehicle_plate, scheduled_start, final_price_minor, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  let queueQ = supabase
    .from('bookings')
    .select('id, branch, status')
    .in('status', ['waiting', 'in_progress', 'final_checking', 'for_payment'])

  salesQ = applyBranchScope(salesQ, scope ?? 'all')
  expensesQ = applyBranchScope(expensesQ, scope ?? 'all')
  bookingsQ = applyBranchScope(bookingsQ, scope ?? 'all')
  queueQ = applyBranchScope(queueQ, scope ?? 'all')

  let productsQ = supabase
    .from('products')
    .select('id, name, sku, stock_qty, price_minor, category, is_active')
    .eq('is_archived', false)
    .order('name')
  // products are global inventory (no branch column) — stock stays company-wide
  let staffQ = supabase
    .from('staff_profiles')
    .select('id, role, branch_slug, is_active')
    .eq('is_active', true)
    .eq('is_archived', false)
  if (typeof scope === 'string' && scope && scope !== 'all') {
    staffQ = staffQ.eq('branch_slug', scope)
  } else if (Array.isArray(scope) && scope.length) {
    staffQ = staffQ.in('branch_slug', scope)
  } else if (scope === '__none__') {
    staffQ = staffQ.eq('branch_slug', '__none__')
  }

  const [sales, expenses, products, queue, bookings, staff, branches] = await Promise.all([
    salesQ,
    expensesQ,
    productsQ,
    queueQ,
    bookingsQ,
    staffQ,
    listBranches(),
  ])

  const salesRows = sales.data || []
  const expenseRows = expenses.data || []
  const productRows = products.data || []
  const queueRows = queue.data || []
  const bookingRows = bookings.data || []

  const revenueMinor = salesRows.reduce((sum, r) => sum + Number(r.total_sales_minor || 0), 0)
  const todaySales = salesRows.filter((r) => r.sale_date === today)
  const todayRevenueMinor = todaySales.reduce((sum, r) => sum + Number(r.total_sales_minor || 0), 0)

  const approvedExpenseMinor = expenseRows
    .filter((r) => ['approved', 'paid'].includes(r.status))
    .reduce((sum, r) => sum + Number(r.total_minor || 0), 0)
  const pendingExpenseMinor = expenseRows
    .filter((r) => ['draft', 'pending_approval'].includes(r.status))
    .reduce((sum, r) => sum + Number(r.total_minor || 0), 0)

  const profitMinor = revenueMinor - approvedExpenseMinor
  const lowStock = productRows.filter((p) => Number(p.stock_qty) <= 10)

  const queueByBranch = {}
  for (const row of queueRows) {
    const key = row.branch || 'unknown'
    if (!queueByBranch[key]) queueByBranch[key] = { waiting: 0, in_progress: 0, final_checking: 0, for_payment: 0, total: 0 }
    if (queueByBranch[key][row.status] != null) queueByBranch[key][row.status] += 1
    queueByBranch[key].total += 1
  }

  return {
    scope: scope || 'all',
    today,
    revenueMinor,
    todayRevenueMinor,
    approvedExpenseMinor,
    pendingExpenseMinor,
    profitMinor,
    salesRows,
    expenseRows,
    productRows,
    lowStock,
    queueByBranch,
    queueRows,
    bookingRows,
    staffRows: staff.data || [],
    branches: branches || [],
    errors: [sales.error, expenses.error, products.error, queue.error, bookings.error, staff.error].filter(Boolean),
  }
}

export function formatPeso(minor) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(minor || 0) / 100)
}

export async function listMembershipTiers({ includeInactive = true } = {}) {
  let q = supabase.from('membership_tiers').select('*').order('starting_price_minor')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function createMembershipTier(input) {
  const v = validateMembershipTierInput(input)
  const { data, error } = await supabase
    .from('membership_tiers')
    .insert({ ...v, is_active: true })
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'create',
    entityType: 'membership_tier',
    entityId: data?.id,
    summary: `Created membership tier ${data?.name}`,
  })
  return data
}

export async function updateMembershipTier(id, input) {
  if (!id) throw new Error('Tier id is required.')
  const v = validateMembershipTierInput(input)
  const patch = { ...v }
  if (input.is_active !== undefined) patch.is_active = input.is_active
  const { data, error } = await supabase.from('membership_tiers').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Membership tier not found.')
  await writeAudit({
    action: 'update',
    entityType: 'membership_tier',
    entityId: id,
    summary: `Updated membership tier ${data.name}`,
    meta: { is_active: data.is_active },
  })
  return data
}

export async function listLoyaltyMilestones({ includeInactive = false } = {}) {
  let q = supabase.from('loyalty_milestones').select('*').order('sort_order').order('threshold_points')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function createLoyaltyMilestone(input) {
  const v = validateLoyaltyMilestoneInput(input)
  const { data, error } = await supabase
    .from('loyalty_milestones')
    .insert({ ...v, is_active: true })
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'create',
    entityType: 'loyalty_milestone',
    entityId: data?.id,
    summary: `Created loyalty milestone at ${data?.threshold_points} points`,
  })
  return data
}

export async function updateLoyaltyMilestone(id, input) {
  if (!id) throw new Error('Milestone id is required.')
  const v = validateLoyaltyMilestoneInput(input)
  const patch = { ...v }
  if (input.is_active !== undefined) patch.is_active = input.is_active
  const { data, error } = await supabase.from('loyalty_milestones').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Milestone not found.')
  await writeAudit({
    action: 'update',
    entityType: 'loyalty_milestone',
    entityId: id,
    summary: `Updated loyalty milestone ${data.reward_label}`,
  })
  return data
}

const DEFAULT_LOYALTY_SETTINGS = {
  id: 1,
  card_slots: 15,
  stamps_enabled: true,
  points_enabled: true,
  memberships_enabled: true,
  stamp_earn_mode: 'all_weighted',
  stamp_pay_categories: ['wash'],
  apply_membership_multiplier_to_stamps: false,
  wrap_stamps_at_card: false,
}

export async function getLoyaltyProgramSettings() {
  const { data, error } = await supabase.from('loyalty_program_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw mapDbError(error)
  return { ...DEFAULT_LOYALTY_SETTINGS, ...(data || {}) }
}

export async function updateLoyaltyProgramSettings(input) {
  const v = validateLoyaltyProgramSettings(input)
  const { data, error } = await supabase
    .from('loyalty_program_settings')
    .upsert({ id: 1, ...v, updated_at: new Date().toISOString() })
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'update',
    entityType: 'loyalty_program',
    entityId: '1',
    summary: `Updated loyalty program (slots=${data?.card_slots}, stamps=${data?.stamps_enabled}, points=${data?.points_enabled}, memberships=${data?.memberships_enabled}, earn=${data?.stamp_earn_mode})`,
    meta: v,
  })
  return data
}

export async function updateServiceLoyaltyWeight(id, weight) {
  if (!id) throw new Error('Service id is required.')
  const loyalty_weight = validateServiceLoyaltyWeight(weight)
  const { data, error } = await supabase
    .from('services')
    .update({ loyalty_weight, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, loyalty_weight')
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Service not found.')
  await writeAudit({
    action: 'update',
    entityType: 'service',
    entityId: id,
    summary: `Set loyalty score for ${data.name} to ${loyalty_weight}`,
    meta: { loyalty_weight },
  })
  return data
}

export async function assignCustomerMembership({ customer_id, tier_id, starts_at, ends_at }) {
  if (!customer_id || !tier_id) throw new Error('Customer and tier are required.')
  const { data: existing } = await supabase
    .from('customer_memberships')
    .select('id')
    .eq('customer_id', customer_id)
    .eq('is_active', true)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('customer_memberships')
      .update({
        tier_id,
        starts_at: starts_at || new Date().toISOString().slice(0, 10),
        ends_at: ends_at || null,
        is_active: true,
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle()
    if (error) throw mapDbError(error)
    await writeAudit({
      action: 'update',
      entityType: 'customer_membership',
      entityId: data?.id,
      summary: 'Updated customer membership tier',
      meta: { customer_id, tier_id },
    })
    return data
  }

  const { data, error } = await supabase
    .from('customer_memberships')
    .insert({
      customer_id,
      tier_id,
      starts_at: starts_at || new Date().toISOString().slice(0, 10),
      ends_at: ends_at || null,
      is_active: true,
    })
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'create',
    entityType: 'customer_membership',
    entityId: data?.id,
    summary: 'Assigned customer membership tier',
    meta: { customer_id, tier_id },
  })
  return data
}

export async function listCustomersForMembership(limit = 50) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, loyalty_stamps, loyalty_points')
    .eq('role', 'customer')
    .eq('is_archived', false)
    .order('full_name')
    .limit(limit)
  if (error) throw mapDbError(error)
  return data || []
}

export async function listActiveCustomerMemberships(limit = 100) {
  const { data, error } = await supabase
    .from('customer_memberships')
    .select(
      'id, customer_id, tier_id, starts_at, ends_at, is_active, customers(full_name, email, phone), membership_tiers(name)',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw mapDbError(error)
  return data || []
}

export async function revokeCustomerMembership(id) {
  if (!id) throw new Error('Membership id is required.')
  const { data, error } = await supabase
    .from('customer_memberships')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Membership not found.')
  await writeAudit({
    action: 'update',
    entityType: 'customer_membership',
    entityId: id,
    summary: 'Revoked customer membership',
    meta: { customer_id: data.customer_id, tier_id: data.tier_id },
  })
  return data
}

function stockGroupFromName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeProductTags(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean))]
  }
  return String(raw || '')
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

export async function listProducts({ includeArchived = false } = {}) {
  let q = supabase
    .from('products')
    .select('id, name, sku, category, price_minor, stock_qty, stock_group, branch_slug, tags, usage_kind, is_active, is_archived, updated_at')
    .order('name')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function createProduct(payload) {
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('Product name is required.')
  const price = Number(payload.price)
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a valid number.')
  const tags = normalizeProductTags(payload.tags)
  const row = {
    name,
    sku: String(payload.sku || '').trim() || null,
    category: String(payload.category || 'merch').trim() || 'merch',
    price_minor: Math.round(price * 100),
    stock_qty: Math.max(0, Number(payload.stock_qty) || 0),
    stock_group: stockGroupFromName(payload.stock_group || name),
    branch_slug: payload.branch_slug || null,
    tags: tags.length ? tags : ['sellable', 'merch'],
    usage_kind: payload.usage_kind === 'internal' ? 'internal' : 'resellable',
    is_active: payload.is_active !== false,
    is_archived: false,
  }
  const { data, error } = await supabase.from('products').insert(row).select().maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'create',
    entityType: 'product',
    entityId: data?.id,
    summary: `Created product ${data?.name}`,
    meta: { price_minor: data?.price_minor, stock_qty: data?.stock_qty, stock_group: data?.stock_group },
  })
  return data
}

export async function updateProduct(id, payload) {
  if (!id) throw new Error('Product id is required.')
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('Product name is required.')
  const price = Number(payload.price)
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a valid number.')
  const patch = {
    name,
    sku: String(payload.sku || '').trim() || null,
    category: String(payload.category || 'merch').trim() || 'merch',
    price_minor: Math.round(price * 100),
    stock_qty: Math.max(0, Number(payload.stock_qty) || 0),
    stock_group: stockGroupFromName(payload.stock_group || name),
    branch_slug: payload.branch_slug || null,
    tags: normalizeProductTags(payload.tags),
    usage_kind: payload.usage_kind === 'internal' ? 'internal' : 'resellable',
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'update',
    entityType: 'product',
    entityId: id,
    summary: `Updated product ${name}`,
    meta: { price_minor: patch.price_minor, stock_qty: patch.stock_qty },
  })
  return data
}

export async function archiveProduct(id) {
  if (!id) throw new Error('Product id is required.')
  const { data, error } = await supabase
    .from('products')
    .update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'archive',
    entityType: 'product',
    entityId: id,
    summary: `Archived product ${data?.name || id}`,
  })
  return data
}

export async function getSmsNotificationsEnabled() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
  if (error) throw mapDbError(error)
  return smsNotificationsEnabledFromSetting(data?.value)
}

export async function setSmsNotificationsEnabled(enabled) {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'sms_notifications',
        value: { enabled: Boolean(enabled) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'update',
    entityType: 'app_settings',
    entityId: 'sms_notifications',
    summary: `SMS notifications ${enabled ? 'enabled' : 'disabled'}`,
    meta: { enabled: Boolean(enabled) },
  })
  return data
}

export async function listVehicleSizes({ activeOnly = true } = {}) {
  let q = supabase.from('vehicle_sizes').select('id, slug, label, sort_order, is_active').order('sort_order')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function upsertVehicleSize({ id, slug, label, sort_order, is_active }) {
  const row = {
    slug: String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    label: String(label || '').trim(),
    sort_order: Number(sort_order) || 0,
    is_active: is_active !== false,
  }
  if (!row.slug || !row.label) throw new Error('Size slug and label are required.')
  if (id) {
    const { data, error } = await supabase.from('vehicle_sizes').update(row).eq('id', id).select().maybeSingle()
    if (error) throw mapDbError(error)
    return data
  }
  const { data, error } = await supabase.from('vehicle_sizes').insert(row).select().maybeSingle()
  if (error) throw mapDbError(error)
  return data
}

export async function deactivateVehicleSize(id) {
  const { data, error } = await supabase
    .from('vehicle_sizes')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw mapDbError(error)
  return data
}
