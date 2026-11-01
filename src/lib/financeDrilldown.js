/**
 * Finance Drill-Down API — general ledger transaction breakdown for P&L accounts.
 * Provides line-by-line traceability into bills, daily sheet expenses, payroll,
 * POS sales, and cash advance movements.
 */

import { supabase } from './supabase.js'
import { collectPaged } from './crmInsights.js'
import { scopeBranch } from './financeData.js'

export const FAMILY_TO_LINE_KIND = {
  Services: 'service',
  Packages: 'package',
  Detailing: 'detailing',
  PPF: 'ppf',
  Merch: 'merch',
}

/** Parse daily sheet ID from an expense description (e.g. daily_sheet:<sheet_id>:<line_id>). */
export function extractDailySheetId(description) {
  if (!description || typeof description !== 'string') return null
  const match = description.match(/^daily_sheet:([0-9a-f-]{36})/i)
  return match ? match[1] : null
}

/** Parse payslip ID from an expense description (e.g. payslip:<payslip_id>...). */
export function extractPayslipId(description) {
  if (!description || typeof description !== 'string') return null
  const match = description.match(/^payslip:([0-9a-f-]{36})/i)
  return match ? match[1] : null
}

/** Determine a human-readable source label and redirection path for an expense line. */
export function getExpenseSourceMeta(expense) {
  const sheetId = extractDailySheetId(expense?.description)
  if (sheetId) {
    return {
      type: 'daily_sheet',
      label: 'Daily Sheet',
      badgeVariant: 'secondary',
      targetUrl: `/operations/finance?tab=sheets&sheet=${sheetId}`,
      actionLabel: 'Open Sheet',
    }
  }

  const payslipId = extractPayslipId(expense?.description)
  if (payslipId) {
    return {
      type: 'payslip',
      label: 'Payslip',
      badgeVariant: 'outline',
      targetUrl: `/operations/monthly-salaries`,
      actionLabel: 'View Salaries',
    }
  }

  if (expense?.vendor_id || expense?.bill_reference) {
    return {
      type: 'bill',
      label: expense.bill_reference ? `Bill · ${expense.bill_reference}` : 'Bill',
      badgeVariant: 'default',
      targetUrl: `/operations/finance?tab=purchases&acct=${expense?.category_id || ''}`,
      actionLabel: 'View in Bills',
    }
  }

  if (expense?.expense_kind === 'salary_carwash' || expense?.expense_kind === 'salary_detailer') {
    return {
      type: 'payroll',
      label: 'Floor Pay',
      badgeVariant: 'outline',
      targetUrl: `/operations/finance?tab=sheets`,
      actionLabel: 'View Sheets',
    }
  }

  return {
    type: 'expense',
    label: 'Expense Entry',
    badgeVariant: 'secondary',
    targetUrl: `/operations/finance?tab=purchases`,
    actionLabel: 'View in Bills',
  }
}

/**
 * Fetch all transaction lines that comprise an expense category within a date window and branch.
 */
export async function fetchExpenseCategoryLines({
  categoryName,
  start,
  end,
  branch,
  profile,
}) {
  const isCashAdvance =
    categoryName === 'Cash advance and cash advance payment' ||
    /cash advance/i.test(categoryName)

  // 1. Fetch from public.expenses
  const expenseRows = await collectPaged(async (from, to) => {
    let q = supabase
      .from('expenses')
      .select(`
        id,
        title,
        description,
        quantity,
        unit_cost_minor,
        total_minor,
        branch,
        status,
        expense_kind,
        paid_from,
        created_at,
        bill_reference,
        vendor_id,
        category_id,
        vendors (name),
        expense_categories (id, name, code)
      `)
      .in('status', ['paid', 'posted'])

    if (start) q = q.gte('created_at', `${start}T00:00:00+08:00`)
    if (end) q = q.lte('created_at', `${end}T23:59:59.999+08:00`)

    q = scopeBranch(q, profile, branch)
    const { data, error } = await q.order('created_at', { ascending: false }).range(from, to)
    if (error) throw error
    return data || []
  }, 1000)

  // Filter to matching category name
  const isAll =
    !categoryName ||
    categoryName.startsWith('All ') ||
    categoryName === 'Total operating expenses' ||
    categoryName === 'Operating expenses'

  const matchedExpenses = isAll
    ? expenseRows
    : expenseRows.filter(
        (r) =>
          (r.expense_categories?.name || 'Uncategorized').toLowerCase() ===
          categoryName.toLowerCase()
      )

  const normalized = matchedExpenses.map((r) => {
    const meta = getExpenseSourceMeta(r)
    return {
      id: r.id,
      date: (r.created_at || '').slice(0, 10),
      rawDate: r.created_at,
      branch: r.branch,
      title: r.title || 'Expense',
      description: r.description || '',
      vendor: r.vendors?.name || '',
      reference: r.bill_reference || '',
      category: categoryName,
      code: r.expense_categories?.code || '',
      amountMinor: Number(r.total_minor) || 0,
      paidFrom: r.paid_from || 'cash',
      status: r.status,
      sourceType: meta.type,
      sourceLabel: meta.label,
      badgeVariant: meta.badgeVariant,
      targetUrl: meta.targetUrl,
      actionLabel: meta.actionLabel,
    }
  })

  // 2. If inspecting Cash Advance, also query daily_sheet_lines for releases and repayments
  if (isCashAdvance) {
    try {
      const caLines = await collectPaged(async (from, to) => {
        let q = supabase
          .from('daily_sheet_lines')
          .select(`
            id,
            kind,
            amount_minor,
            description,
            staff_id,
            sheet_id,
            paid_from,
            staff_profiles (full_name),
            daily_sheets (id, business_date, branch, status)
          `)
          .in('kind', ['ca_release', 'ca_repay'])
          .gt('amount_minor', 0)

        const { data, error } = await q.order('id', { ascending: false }).range(from, to)
        if (error) throw error
        return data || []
      }, 500)

      const scopedCa = caLines
        .filter((l) => {
          const sheet = l.daily_sheets
          if (!sheet) return false
          if (branch && branch !== 'all' && sheet.branch !== branch) return false
          const d = sheet.business_date
          if (start && d < start) return false
          if (end && d > end) return false
          return true
        })
        .map((l) => {
          const isRelease = l.kind === 'ca_release'
          const staffName = l.staff_profiles?.full_name || 'Staff'
          const date = l.daily_sheets?.business_date || ''
          return {
            id: `ca-${l.id}`,
            date,
            rawDate: `${date}T12:00:00+08:00`,
            branch: l.daily_sheets?.branch || '',
            title: isRelease
              ? `Cash Advance Given · ${staffName}`
              : `Cash Advance Repaid · ${staffName}`,
            description: l.description ? `Note: ${l.description}` : (isRelease ? 'Cash advance release' : 'Cash advance repayment'),
            vendor: staffName,
            reference: isRelease ? 'Given Out' : 'Paid Back',
            category: categoryName,
            code: '9',
            amountMinor: Number(l.amount_minor) || 0,
            paidFrom: l.paid_from || 'cash',
            status: l.daily_sheets?.status || 'approved',
            sourceType: 'daily_sheet',
            sourceLabel: isRelease ? 'CA Released' : 'CA Repaid',
            badgeVariant: isRelease ? 'destructive' : 'default',
            targetUrl: `/operations/finance?tab=sheets&sheet=${l.sheet_id}`,
            actionLabel: 'Open Sheet',
          }
        })

      return [...normalized, ...scopedCa].sort((a, b) => b.rawDate.localeCompare(a.rawDate))
    } catch {
      // Return normalized if caLines query fails
      return normalized
    }
  }

  return normalized
}

/**
 * Fetch all transaction lines that comprise a trading income family (Packages, Services, etc.)
 */
export async function fetchIncomeCategoryLines({
  categoryName,
  start,
  end,
  branch,
  profile,
}) {
  const isDiscounts = categoryName === 'Discounts and adjustments'
  const isAll =
    !categoryName ||
    categoryName.startsWith('All ') ||
    categoryName === 'Total trading income' ||
    categoryName === 'Trading income'
  const lineKind = isAll ? null : FAMILY_TO_LINE_KIND[categoryName]

  const salesRows = await collectPaged(async (from, to) => {
    let q = supabase
      .from('sales')
      .select(`
        id,
        occurred_at,
        branch,
        total_minor,
        discount_minor,
        discount_reason,
        payment_method,
        status,
        customers (full_name),
        sale_line_items (
          id,
          name,
          item_type,
          line_kind,
          quantity,
          unit_price_minor,
          line_total_minor,
          service_id,
          services (slug, pay_category)
        )
      `)
      .eq('status', 'paid')

    if (start) q = q.gte('occurred_at', `${start}T00:00:00+08:00`)
    if (end) q = q.lte('occurred_at', `${end}T23:59:59.999+08:00`)

    q = scopeBranch(q, profile, branch)
    const { data, error } = await q.order('occurred_at', { ascending: false }).range(from, to)
    if (error) throw error
    return data || []
  }, 1000)

  if (isDiscounts) {
    // Return sales that had discounts
    return salesRows
      .filter((s) => Number(s.discount_minor) > 0)
      .map((s) => ({
        id: `disc-${s.id}`,
        date: (s.occurred_at || '').slice(0, 10),
        rawDate: s.occurred_at,
        branch: s.branch,
        title: `Discount · Sale #${s.id.slice(0, 8)}`,
        description: s.discount_reason || 'POS Discount / Adjustment',
        customer: s.customers?.full_name || 'Walk-in',
        reference: `Sale #${s.id.slice(0, 8)}`,
        category: categoryName,
        amountMinor: -(Number(s.discount_minor) || 0),
        paidFrom: s.payment_method || 'cash',
        status: s.status,
        sourceType: 'sale',
        sourceLabel: 'POS Sale',
        badgeVariant: 'secondary',
        targetUrl: `/operations/finance?tab=sales`,
        actionLabel: 'View Sale',
      }))
  }

  // Filter line items by matching family
  const lines = []
  for (const s of salesRows) {
    for (const item of s.sale_line_items || []) {
      const itemKind =
        item.line_kind ||
        (item.item_type === 'product'
          ? 'merch'
          : item.services?.pay_category === 'detailing'
          ? 'detailing'
          : item.item_type === 'package'
          ? 'package'
          : 'service')

      if (lineKind && itemKind !== lineKind) continue

      lines.push({
        id: `line-${item.id}`,
        date: (s.occurred_at || '').slice(0, 10),
        rawDate: s.occurred_at,
        branch: s.branch,
        title: item.name || 'Service',
        description: `Qty: ${item.quantity || 1} @ ₱${((item.unit_price_minor || 0) / 100).toFixed(2)}`,
        customer: s.customers?.full_name || 'Walk-in',
        reference: `Sale #${s.id.slice(0, 8)}`,
        category: categoryName || 'Trading Income',
        amountMinor: Number(item.line_total_minor) || 0,
        paidFrom: s.payment_method || 'cash',
        status: s.status,
        sourceType: 'sale',
        sourceLabel: 'POS Sale',
        badgeVariant: 'default',
        targetUrl: `/operations/finance?tab=sales`,
        actionLabel: 'View Sale',
      })
    }

    if (isAll && Number(s.discount_minor) > 0) {
      lines.push({
        id: `disc-${s.id}`,
        date: (s.occurred_at || '').slice(0, 10),
        rawDate: s.occurred_at,
        branch: s.branch,
        title: `Discount · Sale #${s.id.slice(0, 8)}`,
        description: s.discount_reason || 'POS Discount / Adjustment',
        customer: s.customers?.full_name || 'Walk-in',
        reference: `Sale #${s.id.slice(0, 8)}`,
        category: 'Discounts and adjustments',
        amountMinor: -(Number(s.discount_minor) || 0),
        paidFrom: s.payment_method || 'cash',
        status: s.status,
        sourceType: 'sale',
        sourceLabel: 'POS Discount',
        badgeVariant: 'secondary',
        targetUrl: `/operations/finance?tab=sales`,
        actionLabel: 'View Sale',
      })
    }
  }

  return lines.sort((a, b) => b.rawDate.localeCompare(a.rawDate))
}
