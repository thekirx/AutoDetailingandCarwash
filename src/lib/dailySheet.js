/**
 * Daily Sheet formulas — one branch, one Manila day. Pure: rows in, numbers out (minor units).
 * POS (Branch Admin) and Finance (SA/ASA) both read these, so their numbers cannot disagree.
 */
import { rollupSales } from './salesSummary.js'
import { paidSalesToBacoorRows } from './posSellables.js'
import { buildPayrollPreview } from './payroll.js'
import { normalizeCompensationSettings } from './compensation.js'

export const SHEET_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'returned'])
export const LINE_KINDS = Object.freeze(['expense', 'salary', 'ca_release', 'ca_repay'])
export const SALARY_ACCOUNT_CODE = '14'

export const SHEET_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  submitted: 'Waiting for approval',
  approved: 'Approved',
  returned: 'Returned',
})

/** Same as SQL asa_has_grant: a key that was never set counts as granted. */
const grantOr = (profile, keys) => {
  const g = profile?.permission_grants || {}
  return keys.some((k) => !Object.prototype.hasOwnProperty.call(g, k) || Boolean(g[k]))
}

/** Mirrors SQL daily_sheet_can_edit (branch access is enforced server-side). */
export function canEditDailySheet(profile) {
  const role = profile?.role
  if (role === 'BossMich' || role === 'admin') return true
  return role === 'assistant_super_admin' && grantOr(profile, ['pos', 'finance_write'])
}

/** Mirrors SQL daily_sheet_can_review. */
export function canReviewDailySheet(profile) {
  if (profile?.role === 'BossMich') return true
  return profile?.role === 'assistant_super_admin' && grantOr(profile, ['finance_view'])
}

const FAMILY_OF_BUCKET = {
  carwash: 'car_wash',
  coating: 'coating',
  paint_maint: 'detailing',
  detailing: 'detailing',
  ppf: 'ppf',
  tint: 'tint',
  refreshment: 'coffee',
  clothing: 'merch',
  accessories: 'merch',
}

export const FAMILY_LABELS = Object.freeze({
  car_wash: 'Car wash',
  coating: 'Coating',
  detailing: 'Detailing',
  ppf: 'PPF',
  tint: 'Tint',
  coffee: 'Coffee',
  merch: 'Merch',
})

const METHOD_OF = { cash: 'cash', gcash: 'gcash', 'g-cash': 'gcash', card: 'card', credit: 'card', debit: 'card', online: 'bank', bank: 'bank', transfer: 'bank' }

export const METHOD_LABELS = Object.freeze({ cash: 'Cash', gcash: 'GCash', card: 'Card', bank: 'Bank' })

const amount = (v) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? n : 0
}

const linesOf = (lines, kind) => (lines || []).filter((l) => l?.kind === kind)
const sumOf = (rows) => rows.reduce((s, l) => s + amount(l.amount_minor), 0)

/** Gross / discounts / refunds / net / count / average + payment methods + service families. */
export function summarizeSheetSales(sales = []) {
  const r = rollupSales(sales)
  const byMethod = { cash: 0, gcash: 0, card: 0, bank: 0 }
  const paid = (sales || []).filter((s) => s?.status === 'paid')
  for (const s of paid) {
    byMethod[METHOD_OF[String(s.payment_method || 'cash').toLowerCase()] || 'cash'] += amount(s.total_minor)
  }
  const families = new Map()
  for (const row of paidSalesToBacoorRows(paid)) {
    const id = FAMILY_OF_BUCKET[row.bucket] || 'merch'
    families.set(id, (families.get(id) || 0) + amount(row.total_minor))
  }
  return {
    grossMinor: r.grossMinor,
    discountsMinor: r.discountsMinor,
    refundsMinor: r.refundsMinor,
    netMinor: r.netMinor,
    count: paid.length,
    avgMinor: paid.length ? Math.round(r.netMinor / paid.length) : 0,
    byMethod,
    cashMinor: byMethod.cash,
    byFamily: [...families.entries()]
      .filter(([, minor]) => minor)
      .map(([id, minor]) => ({ id, label: FAMILY_LABELS[id] || id, minor }))
      .sort((a, b) => b.minor - a.minor),
  }
}

/**
 * Suggested pay per person clocked in: daily rate (if set) + wash pool share + detailing share.
 * Wash pool = car wash sales × wash_pool_pct split by attendance weight (TL/detailers excluded, see compensation.js).
 */
export function suggestSalaries({
  date,
  branch,
  sales = [],
  attendance = [],
  ceramicExpenses = [],
  rules = {},
  dailyRates = {},
} = {}) {
  const day = String(date || '').slice(0, 10)
  const comp = normalizeCompensationSettings(rules)
  const roster = (attendance || [])
    .map((row) => ({
      staff_id: row.staff_id || row.id,
      full_name: row.full_name || row.staff_profiles?.full_name || '',
      role: row.role || row.staff_profiles?.role || 'staff',
      status: String(row.status || row.attendance_status || 'present').toLowerCase(),
      branch_slug: branch,
      attendance_date: day,
      checked_in_at: row.checked_in_at,
    }))
    .filter((row) => row.staff_id && ['present', 'late'].includes(row.status))
  const preview = buildPayrollPreview({
    period: { start: day, end: day },
    rules: comp,
    sales: (sales || []).map((s) => ({ ...s, branch: s.branch || branch, status: s.status || 'paid' })),
    attendance: roster,
    ceramicExpenses: (ceramicExpenses || []).map((e) => ({ ...e, branch: e.branch || branch })),
    runKind: 'floor',
  })
  const parts = new Map()
  for (const line of preview.lines || []) {
    if (!line.staff_id) continue
    const p = parts.get(line.staff_id) || { wash_minor: 0, detailing_minor: 0 }
    if (line.kind === 'wash_pool') p.wash_minor += amount(line.pay_minor)
    else p.detailing_minor += amount(line.pay_minor)
    parts.set(line.staff_id, p)
  }
  return roster.map((row) => {
    const p = parts.get(row.staff_id) || { wash_minor: 0, detailing_minor: 0 }
    const daily = amount(dailyRates?.[row.staff_id])
    return {
      staff_id: row.staff_id,
      staff_name: row.full_name,
      role: row.role,
      attendance: row.status,
      parts: { daily_minor: daily, ...p },
      suggested_minor: daily + p.wash_minor + p.detailing_minor,
    }
  })
}

/**
 * Summary panel. Every expense/salary line is paid from the drawer.
 * ponytail: no per-line "paid from" — add a column if GCash-paid expenses become common.
 */
export function computeSheetTotals({ sales = [], lines = [], openingFloatMinor = 0, countedCashMinor = null } = {}) {
  const s = summarizeSheetSales(sales)
  const expensesMinor = sumOf(linesOf(lines, 'expense'))
  const salariesMinor = sumOf(linesOf(lines, 'salary'))
  const caReleasedMinor = sumOf(linesOf(lines, 'ca_release'))
  const caRepaidMinor = sumOf(linesOf(lines, 'ca_repay'))
  const totalExpensesMinor = expensesMinor + salariesMinor
  const expectedCashMinor =
    amount(openingFloatMinor) + s.cashMinor + caRepaidMinor - expensesMinor - salariesMinor - caReleasedMinor
  const counted = countedCashMinor == null || countedCashMinor === '' ? null : amount(countedCashMinor)
  return {
    ...s,
    expensesMinor,
    salariesMinor,
    totalExpensesMinor,
    netProfitMinor: s.netMinor - totalExpensesMinor,
    caReleasedMinor,
    caRepaidMinor,
    openingFloatMinor: amount(openingFloatMinor),
    expectedCashMinor,
    countedCashMinor: counted,
    overShortMinor: counted == null ? null : counted - expectedCashMinor,
  }
}

export function salaryLineNeedsReason(line = {}) {
  if (line.kind !== 'salary') return false
  if (amount(line.amount_minor) === amount(line.suggested_minor)) return false
  return !String(line.reason || '').trim()
}

/** Section ✓ marks + the plain-language list shown under a disabled Submit. */
export function sheetChecklist({ sheet = {}, lines = [], sales = [] } = {}) {
  const missing = []
  const expenses = linesOf(lines, 'expense')
  const badExpense = expenses.filter((l) => !String(l.description || '').trim() || !l.account_id || amount(l.amount_minor) <= 0)
  if (badExpense.length) missing.push(`Finish ${badExpense.length} expense line(s): what it was, account and amount`)
  const noReason = linesOf(lines, 'salary').filter(salaryLineNeedsReason)
  if (noReason.length) missing.push(`Add a reason for ${noReason.length} changed salary amount(s)`)
  const badSalary = linesOf(lines, 'salary').filter((l) => amount(l.amount_minor) < 0)
  if (badSalary.length) missing.push('Salary amounts cannot be negative')
  const ca = [...linesOf(lines, 'ca_release'), ...linesOf(lines, 'ca_repay')]
  const badCa = ca.filter((l) => !l.staff_id || amount(l.amount_minor) <= 0)
  if (badCa.length) missing.push(`Pick the staff member and amount on ${badCa.length} cash advance line(s)`)
  const floatSet = sheet.opening_float_minor != null && sheet.opening_float_minor !== ''
  const countSet = sheet.counted_cash_minor != null && sheet.counted_cash_minor !== ''
  if (!floatSet) missing.push('Enter the opening float')
  if (!countSet) missing.push('Count the cash in the drawer')
  const totals = computeSheetTotals({
    sales,
    lines,
    openingFloatMinor: sheet.opening_float_minor,
    countedCashMinor: countSet ? sheet.counted_cash_minor : null,
  })
  const offBy = totals.overShortMinor
  if (offBy != null && offBy !== 0 && !String(sheet.notes || '').trim()) {
    missing.push(`Cash is ${offBy > 0 ? 'over' : 'short'} by ${formatAccounting(Math.abs(offBy))} — add a note`)
  }
  return {
    totals,
    missing,
    canSubmit: missing.length === 0,
    sections: {
      sales: true,
      expenses: badExpense.length === 0,
      salaries: noReason.length === 0 && badSalary.length === 0,
      cashAdvances: badCa.length === 0,
      cash: floatSet && countSet && !(offBy && !String(sheet.notes || '').trim()),
    },
  }
}

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Xero number style: ₱1,234.56 and (₱50.00) for negatives. */
export function formatAccounting(minor) {
  const n = amount(minor)
  const text = PESO.format(Math.abs(n) / 100)
  return n < 0 ? `(${text})` : text
}

export function manilaHour(iso) {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  return Number(h) % 24
}

/**
 * Owner Money view on the Floor Board. Net sales today vs yesterday up to the same Manila hour, per branch;
 * month-to-date net profit from finance_daily_pl rows; sheets waiting; drawer over/short alerts.
 */
export function floorMoney({ todaySales = [], yesterdaySales = [], nowHour = 23, plRows = [], sheets = [] } = {}) {
  const net = (list) => rollupSales(list).netMinor
  const sameTime = yesterdaySales.filter((s) => s?.occurred_at && manilaHour(s.occurred_at) <= nowHour)
  const branches = [...new Set([...todaySales, ...sameTime].map((s) => s?.branch).filter(Boolean))].sort()
  const byBranch = branches.map((branch) => ({
    branch,
    todayMinor: net(todaySales.filter((s) => s.branch === branch)),
    yesterdayMinor: net(sameTime.filter((s) => s.branch === branch)),
  }))
  const mtdNetMinor = (plRows || []).reduce((s, r) => s + (r?.kind === 'income' ? 1 : r?.kind === 'expense' ? -1 : 0) * amount(r.amount_minor), 0)
  const waiting = (sheets || []).filter((s) => s?.status === 'submitted')
  const alerts = (sheets || [])
    .filter((s) => s?.status !== 'draft' && Number(s?.totals?.overShortMinor))
    .map((s) => ({ id: s.id, branch: s.branch, date: s.business_date, overShortMinor: Number(s.totals.overShortMinor) }))
  return {
    byBranch,
    todayMinor: net(todaySales),
    yesterdayMinor: net(sameTime),
    mtdNetMinor,
    waiting: waiting.length,
    alerts,
    allGood: waiting.length === 0 && alerts.length === 0,
  }
}

/** Square "performance by hour": net sales (pesos) per Manila hour, today vs prior day. */
export function hourlyNetSales(todaySales = [], priorSales = []) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`, today: 0, prior: 0 }))
  const add = (list, key) => {
    for (const s of list || []) {
      if (s?.status !== 'paid' || !s.occurred_at) continue
      rows[manilaHour(s.occurred_at)][key] += amount(s.total_minor) / 100
    }
  }
  add(todaySales, 'today')
  add(priorSales, 'prior')
  return rows
}

/** Lines → rows for the save_daily_sheet RPC payload. */
export function toSheetPayloadLines(lines = []) {
  return (lines || [])
    .filter((l) => LINE_KINDS.includes(l?.kind))
    .map((l) => ({
      id: l.id || null,
      kind: l.kind,
      staff_id: l.staff_id || null,
      account_id: l.account_id || null,
      description: String(l.description || '').trim() || null,
      suggested_minor: l.kind === 'salary' ? amount(l.suggested_minor) : null,
      amount_minor: amount(l.amount_minor),
      reason: String(l.reason || '').trim() || null,
      receipt_path: l.receipt_path || null,
    }))
}

/** Merge suggestions into existing salary lines: keep typed amounts, refresh suggestions, add new people. */
export function mergeSalarySuggestions(lines = [], suggestions = []) {
  const others = (lines || []).filter((l) => l.kind !== 'salary')
  const existing = new Map((lines || []).filter((l) => l.kind === 'salary').map((l) => [l.staff_id, l]))
  const merged = suggestions.map((s) => {
    const prev = existing.get(s.staff_id)
    existing.delete(s.staff_id)
    if (!prev) return { kind: 'salary', staff_id: s.staff_id, staff_name: s.staff_name, role: s.role, parts: s.parts, suggested_minor: s.suggested_minor, amount_minor: s.suggested_minor, reason: '' }
    const untouched = amount(prev.amount_minor) === amount(prev.suggested_minor)
    return { ...prev, staff_name: s.staff_name, role: s.role, parts: s.parts, suggested_minor: s.suggested_minor, amount_minor: untouched ? s.suggested_minor : prev.amount_minor }
  })
  return [...others, ...merged, ...existing.values()]
}

/** "1,500.50" pesos → 150050 minor; blank or not a number → null (filter off). */
const pesosOrNull = (text) => {
  const s = String(text ?? '').replace(/[₱,\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** Finance › Daily sheets client-side filters on top of the status / branch / date query. */
export function filterSheets(rows = [], { search = '', submitter = '', minNet = '', maxNet = '', overShortOnly = false, branchName = (s) => s } = {}) {
  const q = String(search || '').trim().toLowerCase()
  const min = pesosOrNull(minNet)
  const max = pesosOrNull(maxNet)
  return (rows || []).filter((r) => {
    const net = amount(r?.totals?.netProfitMinor)
    if (submitter && r.submitted_by !== submitter) return false
    if (min != null && net < min) return false
    if (max != null && net > max) return false
    if (overShortOnly && !amount(r?.totals?.overShortMinor)) return false
    if (!q) return true
    return [r.business_date, r.branch, branchName(r.branch), r.staff_profiles?.full_name, r.notes, r.review_note]
      .some((v) => String(v || '').toLowerCase().includes(q))
  })
}

/**
 * Square-style close-of-day slip: one flat row list (section · item · detail · amount) that feeds
 * Print / Save as PDF, CSV and Excel. Figures come from computeSheetTotals, same as the sheet itself.
 */
export function closeOfDaySlip({ sheet = {}, lines = [], sales = [], branchLabel = '' } = {}) {
  const t = computeSheetTotals({ sales, lines, openingFloatMinor: sheet.opening_float_minor, countedCashMinor: sheet.counted_cash_minor })
  const rows = []
  const add = (section, item, amountMinor, detail = '') => rows.push({ section, item, detail, amount_minor: amountMinor })
  const who = (l) => l.staff_name || 'Staff'

  add('Sales', 'Gross sales', t.grossMinor)
  if (t.discountsMinor) add('Sales', 'Discounts', -t.discountsMinor)
  if (t.refundsMinor) add('Sales', 'Refunds', -t.refundsMinor)
  add('Sales', 'Net sales', t.netMinor)
  add('Sales', 'Transactions', null, `${t.count} sale(s) · average ${formatAccounting(t.avgMinor)}`)
  for (const [id, label] of Object.entries(METHOD_LABELS)) if (t.byMethod[id]) add('Payments', label, t.byMethod[id])
  for (const f of t.byFamily) add('Services', f.label, f.minor)

  for (const l of linesOf(lines, 'expense')) add('Expenses', l.description || 'Expense', amount(l.amount_minor), l.account_label || '')
  add('Expenses', 'Total expenses', t.expensesMinor)
  for (const l of linesOf(lines, 'salary')) {
    const changed = amount(l.amount_minor) !== amount(l.suggested_minor)
    add('Salaries', who(l), amount(l.amount_minor), changed ? `Suggested ${formatAccounting(l.suggested_minor)} · ${l.reason || 'no reason'}` : '')
  }
  add('Salaries', 'Total salaries', t.salariesMinor)
  for (const l of linesOf(lines, 'ca_release')) add('Cash advances', `Given out · ${who(l)}`, amount(l.amount_minor))
  for (const l of linesOf(lines, 'ca_repay')) add('Cash advances', `Paid back · ${who(l)}`, amount(l.amount_minor))

  add('Drawer', 'Opening float', t.openingFloatMinor)
  add('Drawer', 'Cash sales', t.cashMinor)
  if (t.caRepaidMinor) add('Drawer', 'Cash advances paid back', t.caRepaidMinor)
  add('Drawer', 'Expenses paid', -t.expensesMinor)
  add('Drawer', 'Salaries paid', -t.salariesMinor)
  if (t.caReleasedMinor) add('Drawer', 'Cash advances given out', -t.caReleasedMinor)
  add('Drawer', 'Expected cash', t.expectedCashMinor)
  add('Drawer', 'Counted cash', t.countedCashMinor)
  add('Drawer', 'Over/short', t.overShortMinor, t.overShortMinor ? sheet.notes || '' : '')

  add('Result', 'Net profit', t.netProfitMinor, 'Net sales − expenses − salaries')

  const date = String(sheet.business_date || '').slice(0, 10)
  const by = sheet.staff_profiles?.full_name
  return {
    title: `Close of day · ${branchLabel || sheet.branch || ''} · ${date}`,
    subtitle: [SHEET_STATUS_LABELS[sheet.status] || 'Not saved yet', by ? `Submitted by ${by}` : '', sheet.review_note ? `Review note: ${sheet.review_note}` : '']
      .filter(Boolean)
      .join(' · '),
    rows,
    totals: t,
  }
}

/** Distinct submitters for the "Submitted by" filter. */
export function sheetSubmitters(rows = []) {
  const seen = new Map()
  for (const r of rows || []) if (r?.submitted_by && !seen.has(r.submitted_by)) seen.set(r.submitted_by, r.staff_profiles?.full_name || 'Branch Admin')
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}
