/** Daily Sheet data access (Supabase). Formulas live in dailySheet.js — this file only moves rows. */
import { supabase } from '@/lib/supabase'
import { collectPaged } from '@/lib/crmInsights'
import { normalizeCompensationSettings } from '@/lib/compensation'
import { suggestSalaries, toSheetPayloadLines } from '@/lib/dailySheet'

const SALE_SELECT =
  'id, branch, status, total_minor, discount_minor, payment_method, occurred_at, booking_id, bookings(services(name, pay_category)), sale_line_items(item_type, line_total_minor, name, service_id, product_id, services(name, slug, pay_category, salary_pct), products(name, tags, category))'

export const dayRange = (date) => ({ start: `${date}T00:00:00+08:00`, end: `${date}T23:59:59.999+08:00` })

export function previousDay(date) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Paid + refunded sales for one branch/day (refunds feed the Net sales formula). */
export async function loadDaySales(branch, date, { select = SALE_SELECT } = {}) {
  const { start, end } = dayRange(date)
  return collectPaged(async (from, to) => {
    let q = supabase.from('sales').select(select).in('status', ['paid', 'refunded']).gte('occurred_at', start).lte('occurred_at', end)
    if (branch && branch !== 'all') q = q.eq('branch', branch)
    const { data, error } = await q.order('occurred_at', { ascending: true }).range(from, to)
    if (error) throw error
    return data || []
  }, 1000)
}

export async function loadAccounts() {
  const { data, error } = await supabase.from('expense_categories').select('*').order('sort_order', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data || []).sort((a, b) => String(a.code || '99').localeCompare(String(b.code || '99')))
}

export async function loadSheet(branch, date) {
  const { data, error } = await supabase
    .from('daily_sheets')
    .select('*, daily_sheet_lines(*, staff_profiles(full_name, role), expense_categories(name, code))')
    .eq('branch', branch)
    .eq('business_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function loadSheetById(id) {
  const { data, error } = await supabase
    .from('daily_sheets')
    .select('*, daily_sheet_lines(*, staff_profiles(full_name, role), expense_categories(name, code))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Everything the Branch Admin needs to fill a sheet: sales, crew suggestions, accounts, staff, CA requests. */
export async function loadSheetContext(branch, date) {
  const { start, end } = dayRange(date)
  const [sales, sheet, accounts, attendanceRes, draftsRes, compRes, staffRes, caRes] = await Promise.all([
    loadDaySales(branch, date),
    loadSheet(branch, date),
    loadAccounts(),
    supabase.from('staff_attendance').select('staff_id, status, checked_in_at, staff_profiles(*)').eq('branch_slug', branch).eq('attendance_date', date).limit(200),
    supabase.from('expenses').select('id, description, total_minor, branch').eq('branch', branch).eq('status', 'draft').gte('created_at', start).lte('created_at', end).or('description.ilike.detailing:%,description.ilike.ceramic:%'),
    supabase.from('compensation_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('staff_profiles').select('id, full_name, role, branch_slug').eq('is_active', true).order('full_name'),
    supabase
      .from('ops_form_submissions')
      .select('id, payload, status, respondent_label, created_at, ops_forms!inner(kind)')
      .eq('ops_forms.kind', 'cash_advance')
      .in('status', ['new', 'resolved'])
      .gte('created_at', `${previousDay(previousDay(date))}T00:00:00+08:00`)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const attendance = (attendanceRes.data || []).map((row) => ({
    staff_id: row.staff_id,
    status: row.status,
    checked_in_at: row.checked_in_at,
    full_name: row.staff_profiles?.full_name,
    role: row.staff_profiles?.role,
    daily_rate_minor: Number(row.staff_profiles?.daily_rate_minor) || 0,
  }))
  const rules = normalizeCompensationSettings(compRes.data)
  const suggestions = suggestSalaries({
    date,
    branch,
    sales,
    attendance,
    ceramicExpenses: draftsRes.data || [],
    rules,
    dailyRates: Object.fromEntries(attendance.map((a) => [a.staff_id, a.daily_rate_minor])),
  })
  const caRequests = (caRes.data || []).filter((r) => {
    const b = String(r.payload?.branch || '').toLowerCase()
    return !b || b === branch
  })
  return { sales, sheet, accounts, attendance, suggestions, rules, staff: staffRes.data || [], caRequests }
}

async function rpc(name, payload) {
  const { data, error } = await supabase.rpc(name, { payload })
  if (error) throw error
  return data
}

export function saveSheet({ branch, date, openingFloatMinor, countedCashMinor, notes, totals, lines }) {
  return rpc('save_daily_sheet', {
    branch,
    business_date: date,
    opening_float_minor: openingFloatMinor,
    counted_cash_minor: countedCashMinor,
    notes,
    totals,
    lines: toSheetPayloadLines(lines),
  })
}

export const submitSheet = (id) => rpc('submit_daily_sheet', { id })
export const reviewSheet = (id, action, reviewNote) => rpc('review_daily_sheet', { id, action, review_note: reviewNote || null })
export const reopenSheet = (id, reviewNote) => rpc('reopen_daily_sheet', { id, review_note: reviewNote })

export async function uploadReceipt({ branch, date, file }) {
  const ext = String(file.name || 'jpg').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${branch}/${date}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('daily-sheet-receipts').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from('daily-sheet-receipts').createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl
}

/** Finance inbox / history. Filters: status, branch, from, to. */
export async function listSheets({ status = 'all', branch = 'all', from, to, limit = 200 } = {}) {
  let q = supabase
    .from('daily_sheets')
    .select('id, branch, business_date, status, totals, notes, review_note, submitted_at, submitted_by, reviewed_at, staff_profiles!daily_sheets_submitted_by_fkey(full_name)')
    .order('business_date', { ascending: false })
    .limit(limit)
  if (status !== 'all') q = q.eq('status', status)
  if (branch !== 'all') q = q.eq('branch', branch)
  if (from) q = q.gte('business_date', from)
  if (to) q = q.lte('business_date', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

/** Friendly message when the Daily Sheet migration has not been applied yet. */
export function sheetErrorMessage(err) {
  const msg = String(err?.message || err || '')
  if (/daily_sheet|does not exist|schema cache/i.test(msg)) {
    return 'The Daily Sheet needs its database update (migration 20261001090000_daily_sheet). Ask the owner to apply it.'
  }
  return msg || 'Something went wrong. Try again.'
}
