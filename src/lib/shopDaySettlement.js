/**
 * Shop-day settlement: Bacoor report + floor preview salaries for one branch/day.
 * Keeps POS End-of-shift and daily report on one seam (money contract).
 */
import { buildBacoorDailyReport, shiftCloseHasActivity } from './bacoorDailyReport.js'
import { expenseCountsOnDailyClose } from './posSale.js'
import { paidSalesToBacoorRows } from './posSellables.js'
import {
  applyFloorPreviewToBacoorReport,
  buildPayrollPreview,
} from './payroll.js'
import { normalizeCompensationSettings } from './compensation.js'

export { shiftCloseHasActivity }

/**
 * @param {object} opts
 * @param {string} opts.branchSlug
 * @param {string} [opts.branchDisplay]
 * @param {string} opts.date — Manila YYYY-MM-DD
 * @param {object[]} opts.sales — paid sale rows (with line items when available)
 * @param {object[]} [opts.expenses]
 * @param {object[]} [opts.cashAdvances] — { status, amount_minor, employee_name }
 * @param {object[]} [opts.attendance] — roster rows for wash pool split
 * @param {object} [opts.rules] — compensation settings
 */
export function buildShopDaySettlementReport({
  branchSlug = '',
  branchDisplay = '',
  date,
  sales = [],
  expenses = [],
  cashAdvances = [],
  attendance = [],
  rules = {},
} = {}) {
  const slug = String(branchSlug || '').trim()
  const display = String(branchDisplay || slug).trim()
  const day = String(date || '').slice(0, 10)
  const comp = normalizeCompensationSettings(rules)

  const closeExpenses = (expenses || [])
    .filter((e) => expenseCountsOnDailyClose(e))
    .map((e) => ({
      expense_kind: e.expense_kind,
      amount_minor: e.amount_minor ?? e.total_minor,
      label: e.label || e.title,
      status: e.status,
      description: e.description,
    }))

  const base = buildBacoorDailyReport({
    branch: display,
    branchSlug: slug,
    branchDisplay: display,
    date: day,
    sales: paidSalesToBacoorRows(sales),
    classifyBucket: (row) => row.bucket,
    expenses: closeExpenses,
    cashAdvances,
  })

  const previewSales = (sales || []).map((s) => ({
    ...s,
    branch: s.branch || slug,
    status: s.status || 'paid',
  }))
  const ceramicExpenses = (expenses || []).filter((e) =>
    /^(?:ceramic|detailing):/i.test(String(e.description || '')),
  )
  const roster = (attendance || []).map((row) => ({
    id: row.staff_id || row.id,
    staff_id: row.staff_id || row.id,
    full_name: row.full_name || row.staff_profiles?.full_name || '',
    role: row.role || row.staff_profiles?.role || '',
    branch_slug: row.branch_slug || slug,
    attendance_date: row.attendance_date || day,
    status: row.status || row.attendance_status || 'present',
  }))

  const preview = buildPayrollPreview({
    period: { start: day, end: day },
    rules: comp,
    sales: previewSales,
    attendance: roster,
    ceramicExpenses,
    runKind: 'floor',
  })

  return applyFloorPreviewToBacoorReport(base, preview, comp)
}

/** True when this branch/day should offer End of shift. */
export function shopDayShouldClose(input = {}) {
  return shiftCloseHasActivity(input)
}
