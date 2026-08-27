/** Owner Revisions P5 — vendors, quote payload, corporate/HQ finance helpers. */

import { FIXED_SALARY_BOOKS_BRANCH } from './payroll.js'
import { isAssistantSuperAdmin, isSuperAdmin, hasGrant, ROLES } from '../auth/permissions.js'

/** Books slug for corporate / HQ (same as fixed-salary posts). */
export const CORPORATE_BRANCH_SLUG = FIXED_SALARY_BOOKS_BRANCH || 'hq'

export function isCorporateBranch(slug) {
  return String(slug || '').trim().toLowerCase() === CORPORATE_BRANCH_SLUG
}

/** SA + ASA finance_write — vendor CRUD / corporate balance write. */
export function canManageFinanceVendors(profile) {
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_write')
  return false
}

/** Corporate books tab + balances: SA/ASA finance_view; never investor. */
export function canAccessCorporateFinance(profile) {
  if (!profile) return false
  if (profile.role === ROLES.INVESTOR) return false
  if (isSuperAdmin(profile)) return true
  if (isAssistantSuperAdmin(profile)) return hasGrant(profile, 'finance_view')
  return false
}

/**
 * Hide HQ/corporate from investor Finance branch options.
 * Other roles keep hq (labeled Corporate in UI).
 */
export function filterFinanceBranchOptions(branches, profile) {
  const list = Array.isArray(branches) ? branches : []
  if (profile?.role === ROLES.INVESTOR) {
    return list.filter((b) => !isCorporateBranch(b?.slug))
  }
  return list
}

/** Display name for Finance branch picker — hq → Corporate (HQ). */
export function labelFinanceBranch(branch) {
  if (!branch) return ''
  if (isCorporateBranch(branch.slug)) {
    const name = String(branch.name || '').trim()
    if (/corporate/i.test(name) || /^hq\b/i.test(name)) return name || 'Corporate (HQ)'
    return 'Corporate (HQ)'
  }
  return branch.name || branch.slug || ''
}

/** Normalize vendor insert/update payload. */
export function normalizeVendorPayload(input = {}) {
  const name = String(input.name || '').trim()
  if (!name) return null
  return {
    name,
    contact: String(input.contact || '').trim() || null,
    notes: String(input.notes || '').trim() || null,
    is_active: input.is_active !== false,
  }
}

/**
 * Build POST body for /api/send-finance-quote.
 * Requires customer.email.
 */
export function buildFinanceQuotePayload({
  customer,
  title = 'Quotation',
  amountPesos,
  amountMinor,
  notes = '',
  branch = '',
  subject,
} = {}) {
  const email = String(customer?.email || '').trim()
  const minor =
    amountMinor != null && Number.isFinite(Number(amountMinor))
      ? Math.max(0, Math.round(Number(amountMinor)))
      : Math.max(0, Math.round(Number(String(amountPesos ?? '').replace(/,/g, '')) * 100) || 0)
  const pesos = (minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const amountLabel = `₱${pesos}`
  const custName = String(customer?.full_name || customer?.first_name || 'Customer').trim()
  return {
    to: email,
    subject: String(subject || `Hakum Auto Care quotation — ${custName}`).trim(),
    title: String(title || 'Quotation').trim(),
    amount_label: amountLabel,
    notes: String(notes || '').trim(),
    branch: String(branch || '').trim(),
    customer_id: customer?.id || null,
    amount_minor: minor,
  }
}

/** Validate quote payload before API call. */
export function financeQuotePayloadErrors(payload) {
  const errs = []
  if (!payload?.to || !String(payload.to).includes('@')) errs.push('Customer email is required')
  if (!payload?.customer_id) errs.push('Select a CRM customer')
  if (!Number.isFinite(Number(payload?.amount_minor)) || Number(payload.amount_minor) < 0) {
    errs.push('Amount must be zero or greater')
  }
  return errs
}

/**
 * EOM corporate roll-up: sum accepted/locked branch closes + HQ expenses.
 * Closes exclude hq itself (branch drawers remitted up); HQ expenses are corporate outflows.
 */
export function rollupCorporatePeriod({ closes = [], hqExpenses = [] } = {}) {
  let closeSalesMinor = 0
  let closeCount = 0
  for (const row of closes) {
    if (isCorporateBranch(row?.branch)) continue
    const status = String(row?.status || '')
    if (status !== 'accepted' && status !== 'locked') continue
    const submitted = row?.submitted && typeof row.submitted === 'object' ? row.submitted : {}
    const sales = Number(
      submitted.total_sales_minor ?? submitted.square_sales_minor ?? row?.pos_baseline?.total_sales_minor ?? 0,
    )
    closeSalesMinor += Number.isFinite(sales) ? sales : 0
    closeCount += 1
  }
  let hqExpenseMinor = 0
  for (const exp of hqExpenses) {
    if (!isCorporateBranch(exp?.branch)) continue
    const status = String(exp?.status || '')
    if (status === 'draft' || status === 'pending_approval') continue
    hqExpenseMinor += Number(exp?.total_minor || 0) || 0
  }
  return {
    closeCount,
    closeSalesMinor,
    hqExpenseMinor,
    /** Remitted closes minus booked HQ expenses (manual balance is separate). */
    rollupNetMinor: closeSalesMinor - hqExpenseMinor,
  }
}
