/** Bacoor-style daily close report fields (minor units). */

import { expenseCountsOnDailyClose } from './posSale.js'
import { classifySaleBucket as classifyPosSaleBucket, posBucketToBacoor } from './posSellables.js'

export function manilaDayStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function approvedCaForCloseDay(row, dayIso) {
  const status = String(row?.status || '').toLowerCase()
  if (status !== 'resolved' && status !== 'approved') return false
  return manilaDayStamp(row.resolved_at) === String(dayIso || '')
}

export function emptyBacoorDailyReport(meta = {}) {
  return {
    branch: meta.branchDisplay || meta.branch || '',
    branch_slug: meta.branchSlug || meta.branch || '',
    date: meta.date || null,
    /** @deprecated storage key — UI label is Total sales (paid POS) */
    square_sales_minor: 0,
    total_sales_minor: 0,
    downpayments_minor: 0,
    ca_collected_minor: 0,
    total_gcash_minor: 0,
    credit_card_minor: 0,
    total_expenses_minor: 0,
    total_cash_left_minor: 0,
    queue_app_sales_minor: 0,
    car_wash_sales_minor: 0,
    ceramic_coating_sales_minor: 0,
    ppf_sales_minor: 0,
    ceramic_tint_sales_minor: 0,
    refreshment_sales_minor: 0,
    car_accessories_minor: 0,
    hakum_clothing_minor: 0,
    carwash_salary_minor: 0,
    detailer_salary_minor: 0,
    tinter_salary_minor: 0,
    approved_ca: [],
    /** Crew repaying advances into drawer — not counted as expenses. */
    ca_repayments: [],
    daily_expenses: [],
    expense_draft_count: 0,
    /** Cash from paid sales only — used to recompute cash left when CA repaid is typed. */
    cash_sales_minor: 0,
    wash_pool_pct: 0,
    salary_from_preview: false,
  }
}

/**
 * Build report from paid sales + expenses + approved cash advances.
 * sales: rows with payment_method, total_minor, bucket classification fields
 * expenses: { expense_kind, amount_minor|total_minor, label|notes }
 * cashAdvances: { status, amount_minor, employee_name, notes }
 */
export function classifySaleBucket(row) {
  return posBucketToBacoor(
    classifyPosSaleBucket({
      serviceSlug: row?.service_slug || row?.services?.slug,
      payCategory:
        row?.pay_category || row?.services?.pay_category || row?.bookings?.services?.pay_category,
      itemType: row?.item_type,
      serviceName: row?.service_name || row?.bucket || row?.name,
      productTags: row?.product_tags || row?.products?.tags,
      productCategory: row?.product_category || row?.category,
      productName: row?.product_name,
    }),
  )
}

export function buildBacoorDailyReport({
  branch = '',
  branchSlug = '',
  branchDisplay = '',
  date,
  sales = [],
  expenses = [],
  cashAdvances = [],
  classifyBucket,
} = {}) {
  const report = emptyBacoorDailyReport({
    branch: branchDisplay || branch,
    branchSlug: branchSlug || branch,
    branchDisplay: branchDisplay || branch,
    date,
  })
  const classify = classifyBucket || classifySaleBucket

  for (const row of sales || []) {
    if (String(row.status || 'paid') !== 'paid') continue
    const amount = Number(row.total_minor || 0)
    if (!Number.isFinite(amount)) continue
    report.square_sales_minor += amount
    report.total_sales_minor += amount
    const method = String(row.payment_method || '').toLowerCase()
    if (method === 'gcash') report.total_gcash_minor += amount
    if (method === 'card' || method === 'credit') report.credit_card_minor += amount

    const bucket = classify(row)
    if (bucket === 'carwash') {
      report.queue_app_sales_minor += amount
      report.car_wash_sales_minor += amount
    } else if (bucket === 'coating') report.ceramic_coating_sales_minor += amount
    else if (bucket === 'ppf') report.ppf_sales_minor += amount
    else if (bucket === 'tint') report.ceramic_tint_sales_minor += amount
    else if (bucket === 'refreshment') report.refreshment_sales_minor += amount
    else if (bucket === 'clothing') report.hakum_clothing_minor += amount
    else report.car_accessories_minor += amount
  }

  for (const row of expenses || []) {
    if (!expenseCountsOnDailyClose(row)) continue
    const amount = Number(row.amount_minor ?? row.total_minor ?? 0)
    if (!Number.isFinite(amount)) continue
    const status = String(row.status || 'draft').toLowerCase()
    const kind = String(row.expense_kind || row.category || '').toLowerCase()
    const label = row.label || row.notes || row.description || kind || 'expense'
    if (kind.includes('ca_repay') || kind === 'ca_repayment' || kind === 'cash_advance_payment') {
      report.ca_repayments.push({ label, amount_minor: amount })
      report.ca_collected_minor += amount
      if (status === 'draft') report.expense_draft_count += 1
      continue
    }
    report.total_expenses_minor += amount
    if (status === 'draft') report.expense_draft_count += 1
    if (kind.includes('carwash') && kind.includes('salary')) report.carwash_salary_minor += amount
    else if (kind.includes('detailer')) report.detailer_salary_minor += amount
    else if (kind.includes('tinter') || kind.includes('inter')) report.tinter_salary_minor += amount
    else if (kind.includes('cash_advance') || kind === 'cash_advance') {
      report.approved_ca.push({ label, amount_minor: amount })
    } else {
      report.daily_expenses.push({ label, amount_minor: amount, status })
    }
  }

  for (const row of cashAdvances || []) {
    if (String(row.status || '').toLowerCase() !== 'approved') continue
    const amount = Number(row.amount_minor || 0)
    report.approved_ca.push({
      label: row.employee_name || row.notes || 'CA',
      amount_minor: amount,
    })
    report.total_expenses_minor += amount
  }

  const cashSales = (sales || [])
    .filter((r) => String(r.payment_method || '').toLowerCase() === 'cash')
    .reduce((sum, r) => sum + Number(r.total_minor || 0), 0)
  report.cash_sales_minor = cashSales
  report.total_cash_left_minor =
    cashSales - report.total_expenses_minor + Number(report.ca_collected_minor || 0)
  return report
}

export function formatBacoorReportText(report, formatMoney) {
  const m = formatMoney || ((n) => String(Math.round((Number(n) || 0) / 100)))
  const caCollected = Number(report.ca_collected_minor || 0)
  const cashLeft =
    caCollected > 0 && Number.isFinite(Number(report.cash_sales_minor))
      ? Number(report.cash_sales_minor) - Number(report.total_expenses_minor || 0) + caCollected
      : Number(report.total_cash_left_minor || 0)
  const lines = [
    formatBacoorReportHeader(report),
    report.date || '',
    '',
    '━━━━━━━━━━━',
    'Sales Report Summary',
    '━━━━━━━━━━━',
    `Square Sales: ${m(report.total_sales_minor || report.square_sales_minor)}`,
    `Total Sales: ${m(report.total_sales_minor || report.square_sales_minor)}`,
    `Downpayments: ${m(report.downpayments_minor)}`,
    `CA Collected: ${m(report.ca_collected_minor)}`,
    `Total Gcash: ${m(report.total_gcash_minor)}`,
    `Credit Card: ${m(report.credit_card_minor)}`,
    `Total Expenses: ${m(report.total_expenses_minor)}`,
    `Total Cash Left: ${m(cashLeft)}`,
    '',
    '━━━━━━━━━━━',
    'Daily Sales Income',
    '━━━━━━━━━━━',
    `Queue App Sales: ${m(report.queue_app_sales_minor)}`,
    `Car Wash Sales: ${m(report.car_wash_sales_minor)}`,
    `Ceramic Coating Sales: ${m(report.ceramic_coating_sales_minor)}`,
    `PPF Sales: ${m(report.ppf_sales_minor)}`,
    `Ceramic Tint Sales: ${m(report.ceramic_tint_sales_minor)}`,
    `Refreshment Sales: ${m(report.refreshment_sales_minor)}`,
    `Car Accessories: ${m(report.car_accessories_minor)}`,
    `Hakum Clothing: ${m(report.hakum_clothing_minor)}`,
    '',
    '━━━━━━━━━━━',
    'Expense Enumeration',
    '━━━━━━━━━━━',
    `Carwash Salary: ${m(report.carwash_salary_minor)}${
      report.salary_from_preview && report.wash_pool_pct
        ? ` (wash pool ${report.wash_pool_pct}%)`
        : ''
    }`,
    `Detailer Salary: ${m(report.detailer_salary_minor)}${
      report.salary_from_preview ? ' (from detailing / ceramic preview)' : ''
    }`,
    `Tinter Salary: ${m(report.tinter_salary_minor)}`,
    '',
    'Approved CA:',
    ...(report.approved_ca || []).map((row) => `${row.label}-${m(row.amount_minor)}`),
    '',
    `Daily Expenses:`,
    ...(report.daily_expenses || []).map((row) => `${row.label}-${m(row.amount_minor)}`),
    '',
    '━━━━━━━━━━━',
    'Cash Advance Payment',
    '━━━━━━━━━━━',
    ...(report.ca_repayments || []).map((row) => `${row.label}-${m(row.amount_minor)}`),
    ...(report.ca_repayments || []).length === 0 && caCollected
      ? [`CA repaid to drawer (total): ${m(caCollected)}`]
      : [],
    ...(report.ca_repayments || []).length === 0 && !caCollected
      ? ['CA repaid to drawer — add CA repayment lines or type total at End of shift.']
      : [],
  ]
  return lines.join('\n')
}

/** Multi-branch header — slug when known (BACOOR), else display name. */
export function formatBacoorReportHeader(report) {
  const slug = String(report?.branch_slug || '').trim()
  if (slug) return `${slug.toUpperCase()} SALES REPORT`
  const label = String(report?.branch || 'BRANCH').trim()
  return `${label.toUpperCase()} SALES REPORT`
}

/** True when the branch had money activity worth closing. */
export function shiftCloseHasActivity({
  sales = [],
  expenses = [],
  cashAdvances = [],
  caRepayments = [],
} = {}) {
  if ((sales || []).some((r) => String(r.status || 'paid') === 'paid' && Number(r.total_minor) > 0)) {
    return true
  }
  if ((expenses || []).some((r) => Number(r.amount_minor ?? r.total_minor ?? 0) > 0)) return true
  if ((cashAdvances || []).some((r) => Number(r.amount_minor) > 0)) return true
  if ((caRepayments || []).some((r) => Number(r.amount_minor) > 0)) return true
  return false
}
