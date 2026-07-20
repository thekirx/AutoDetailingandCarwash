import { supabase } from './supabase'
import { getBranchScope } from '../queue/queueLogic'

export async function listBranches({ includeArchived = false } = {}) {
  let q = supabase.from('branches').select('id, slug, name, code, address, is_active, is_archived').order('name')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createBranch({ name, slug, code, address }) {
  const { data, error } = await supabase.rpc('create_branch', {
    input_name: name,
    input_slug: slug,
    input_code: code,
    input_address: address || '',
  })
  if (error) throw error
  return data
}

export async function updateBranch({ slug, name, code, address, is_active }) {
  const { data, error } = await supabase.rpc('update_branch', {
    input_branch_slug: slug,
    input_name: name,
    input_code: code,
    input_address: address || '',
    input_is_active: is_active,
  })
  if (error) throw error
  return data
}

export async function archiveBranch(slug) {
  const { data, error } = await supabase.rpc('archive_branch', { input_branch_slug: slug })
  if (error) throw error
  return data
}

export async function listStaffPeople() {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, phone, is_active, is_archived, created_at')
    .eq('is_archived', false)
    .order('full_name')
  if (error) throw error
  return data || []
}

export async function provisionStaff(payload) {
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
  return body
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
