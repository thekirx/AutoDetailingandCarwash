import { supabase } from './supabase'
import { getBranchScope } from '../queue/queueLogic'
import { writeAudit } from './audit'
import {
  validateBranchInput,
  validateProvisionStaffInput,
  validateServiceInput,
  validateStaffUpdate,
} from './opsValidation'

function mapDbError(error, fallback = 'Request failed.') {
  const msg = error?.message || fallback
  if (/duplicate key|unique constraint/i.test(msg)) return new Error('That record already exists.')
  if (/42501|permission|policy|row-level/i.test(msg)) return new Error('You do not have permission for this action.')
  if (/23514|check constraint/i.test(msg)) return new Error('Invalid values — check required fields and formats.')
  return new Error(msg)
}

export async function listBranches({ includeArchived = false } = {}) {
  let q = supabase.from('branches').select('id, slug, name, code, address, is_active, is_archived').order('name')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function createBranch(input) {
  const v = validateBranchInput(input, { requireSlug: true })
  const { data, error } = await supabase.rpc('create_branch', {
    input_name: v.name,
    input_slug: v.slug,
    input_code: v.code,
    input_address: v.address || '',
  })
  if (error) throw mapDbError(error)
  return data
}

export async function updateBranch({ slug, name, code, address, is_active }) {
  const v = validateBranchInput({ name, slug, code, address }, { requireSlug: false })
  if (!slug) throw new Error('Branch slug is required.')
  const { data, error } = await supabase.rpc('update_branch', {
    input_branch_slug: slug,
    input_name: v.name,
    input_code: v.code,
    input_address: v.address || '',
    input_is_active: is_active,
  })
  if (error) throw mapDbError(error)
  return data
}

export async function archiveBranch(slug) {
  if (!String(slug || '').trim()) throw new Error('Branch slug is required.')
  const { data, error } = await supabase.rpc('archive_branch', { input_branch_slug: slug })
  if (error) throw mapDbError(error)
  return data
}

export async function listStaffPeople({ includeInactive = false } = {}) {
  let q = supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, phone, is_active, is_archived, created_at, updated_at')
    .eq('is_archived', false)
    .order('full_name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function updateStaffPerson({ id, full_name, role, branch_slug, phone, is_active }) {
  const v = validateStaffUpdate({ id, full_name, role, branch_slug, phone })
  const patch = {
    full_name: v.full_name,
    role: v.role,
    branch_slug: v.branch_slug,
    phone: v.phone,
    is_active: is_active ?? true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('staff_profiles').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Staff profile not found.')
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
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
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

export async function listServices({ includeArchived = false } = {}) {
  let q = supabase
    .from('services')
    .select('id, name, slug, description, price_minor, duration_minutes, is_active, is_archived, display_order')
    .order('display_order')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) throw mapDbError(error)
  return data || []
}

export async function createService(payload) {
  const v = validateServiceInput(payload)
  const row = {
    name: v.name,
    slug: v.slug,
    description: payload.description?.trim() || null,
    price_minor: v.price_minor,
    duration_minutes: v.duration_minutes,
    display_order: v.display_order,
    is_active: true,
    is_archived: false,
  }
  const { data, error } = await supabase.from('services').insert(row).select().maybeSingle()
  if (error) throw mapDbError(error)
  await writeAudit({
    action: 'create',
    entityType: 'service',
    entityId: data?.id,
    summary: `Created service ${data?.name}`,
    meta: { price_minor: data?.price_minor },
  })
  return data
}

export async function updateService(id, payload) {
  if (!id) throw new Error('Service id is required.')
  const v = validateServiceInput({
    name: payload.name,
    slug: payload.slug,
    price: payload.price,
    duration_minutes: payload.duration_minutes,
    display_order: payload.display_order,
  })
  const patch = {
    name: v.name,
    slug: v.slug,
    description: payload.description?.trim() || null,
    price_minor: v.price_minor,
    duration_minutes: v.duration_minutes,
    display_order: v.display_order,
    is_active: payload.is_active,
    updated_at: new Date().toISOString(),
  }
  if (payload.is_active === undefined) delete patch.is_active

  const { data, error } = await supabase.from('services').update(patch).eq('id', id).select().maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) throw new Error('Service not found.')
  await writeAudit({
    action: 'update',
    entityType: 'service',
    entityId: id,
    summary: `Updated service ${data.name}`,
    meta: { is_active: data.is_active, price_minor: data.price_minor },
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
  await writeAudit({
    action: 'archive',
    entityType: 'service',
    entityId: id,
    summary: `Archived service ${data.name}`,
  })
  return data
}

/** Console metrics: sales, expenses, stock, queue — optional branch filter. */
export async function fetchAdminConsoleSnapshot(profile, branchFilter = 'all') {
  const scope = branchFilter && branchFilter !== 'all' ? branchFilter : getBranchScope(profile)
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

  if (scope) {
    salesQ = salesQ.eq('branch', scope)
    expensesQ = expensesQ.eq('branch', scope)
    bookingsQ = bookingsQ.eq('branch', scope)
    queueQ = queueQ.eq('branch', scope)
  }

  const [sales, expenses, products, queue, bookings, staff, branches] = await Promise.all([
    salesQ,
    expensesQ,
    supabase.from('products').select('id, name, sku, stock_qty, price_minor, category, is_active').eq('is_archived', false).order('name'),
    queueQ,
    bookingsQ,
    supabase.from('staff_profiles').select('id, role, branch_slug, is_active').eq('is_active', true).eq('is_archived', false),
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
