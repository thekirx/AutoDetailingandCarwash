/**
 * Payroll engine: period windows, POS-proofed preview, line edits.
 * Amounts in minor units. Reuses washPoolAmountMinor + splitWashPool.
 */

import { getLocalCalendarDate } from './localCalendarDate.js'
import {
  PAYOUT_FREQUENCIES,
  salaryPctPoolMinor,
  splitWashPool,
  washPoolAmountMinor,
} from './compensation.js'
import { normalizeSalaryDraftExtras } from './shiftClose.js'

export { PAYOUT_FREQUENCIES }

export const PAYROLL_WIZARD_STEPS = Object.freeze([
  { id: 'period', label: 'Period', hint: 'Branch, frequency, and dates' },
  { id: 'proof', label: 'POS proof', hint: 'Paid sales that fund this run' },
  { id: 'lines', label: 'Payouts', hint: 'Edit amounts and commission' },
  { id: 'confirm', label: 'Confirm', hint: 'Post to Finance' },
])

/** Fixed salary wizard — no bay; salary list → commissions → full review. */
export const PAYROLL_FIXED_WIZARD_STEPS = Object.freeze([
  { id: 'period', label: 'Period', hint: 'Frequency and dates only' },
  { id: 'people', label: 'Employees', hint: 'Monthly salaries — override or skip' },
  { id: 'extras', label: 'Commissions', hint: 'Add commission or bonus per person' },
  { id: 'review', label: 'Review', hint: 'Full payout list — adjust then post' },
])

/** Books bucket for company-wide / office salaries (not a wash bay). */
export const FIXED_SALARY_BOOKS_BRANCH = 'hq'

export function resolveFixedSalaryBranch(pkg = {}, staff = null) {
  return (
    String(pkg.branch || '').trim() ||
    String(staff?.branch_slug || pkg.staff?.branch_slug || '').trim() ||
    FIXED_SALARY_BOOKS_BRANCH
  )
}

export function payrollWizardSteps(runKind) {
  return String(runKind || '') === 'fixed' ? PAYROLL_FIXED_WIZARD_STEPS : PAYROLL_WIZARD_STEPS
}

/** Group lines by employee for salary review UI. */
export function groupPayrollLinesByStaff(lines = []) {
  const map = new Map()
  for (const row of lines || []) {
    const id = row.staff_id || 'unassigned'
    if (!map.has(id)) {
      map.set(id, {
        staff_id: id === 'unassigned' ? null : id,
        staff_name: row.staff_name || 'Unassigned',
        role: row.role || null,
        branch: row.branch || FIXED_SALARY_BOOKS_BRANCH,
        lines: [],
        salary_minor: 0,
        commission_minor: 0,
        total_minor: 0,
      })
    }
    const g = map.get(id)
    g.lines.push(row)
    const amt = Math.round(Number(row.pay_minor) || Number(row.amount_minor) || 0)
    const signed =
      row.direction === 'deduct' || row.kind === 'adjustment_deduct' ? -amt : amt
    if (String(row.kind || '').startsWith('package')) g.salary_minor += amt
    else if (
      row.kind === 'adjustment_add' ||
      row.kind === 'adjustment_deduct' ||
      /commission|bonus/i.test(String(row.label || ''))
    ) {
      g.commission_minor += signed
    }
    g.total_minor = netPayrollLinesMinor(g.lines)
  }
  return [...map.values()].sort((a, b) =>
    String(a.staff_name || '').localeCompare(String(b.staff_name || ''), undefined, {
      sensitivity: 'base',
    }),
  )
}

/** Remove every line for a staff member from this run. */
export function removeStaffFromPayrollPreview(lines = [], staffId) {
  if (!staffId) return lines || []
  return (lines || []).filter((row) => row.staff_id !== staffId)
}

function manilaNoon(ymd) {
  return new Date(`${ymd}T12:00:00+08:00`)
}

function formatYmd(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date)
}

function addDaysYmd(ymd, days) {
  const d = manilaNoon(ymd)
  d.setTime(d.getTime() + Number(days) * 86400000)
  return formatYmd(d)
}

function isoMonday(ymd) {
  const utcDay = manilaNoon(ymd).getUTCDay()
  const fromMonday = (utcDay + 6) % 7
  return addDaysYmd(ymd, -fromMonday)
}

function isoWeekNumber(ymd) {
  const monday = isoMonday(ymd)
  const jan4Monday = isoMonday(`${manilaNoon(ymd).getUTCFullYear()}-01-04`)
  const diffDays = Math.round((manilaNoon(monday) - manilaNoon(jan4Monday)) / 86400000)
  return Math.floor(diffDays / 7) + 1
}

export function payrollPeriodRange(frequency, anchorYmd, customRange = null) {
  const ymd = String(anchorYmd || '').slice(0, 10)
  const freq = String(frequency || 'weekly').toLowerCase()
  if (freq === 'custom') {
    const start = String(customRange?.start || ymd).slice(0, 10)
    const end = String(customRange?.end || start).slice(0, 10)
    return { start, end }
  }
  if (freq === 'daily') return { start: ymd, end: ymd }
  if (freq === 'annual' || freq === 'yearly') {
    const [y] = ymd.split('-').map(Number)
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  if (freq === 'semimonthly') {
    const [y, m, day] = ymd.split('-').map(Number)
    if (day <= 15) {
      return { start: `${y}-${String(m).padStart(2, '0')}-01`, end: `${y}-${String(m).padStart(2, '0')}-15` }
    }
    const last = new Date(Date.UTC(y, m, 0, 4, 0, 0))
    return { start: `${y}-${String(m).padStart(2, '0')}-16`, end: formatYmd(last) }
  }
  if (freq === 'monthly') {
    const [y, m] = ymd.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const last = new Date(Date.UTC(y, m, 0, 4, 0, 0))
    return { start, end: formatYmd(last) }
  }
  const monday = isoMonday(ymd)
  if (freq === 'biweekly') {
    const week = isoWeekNumber(ymd)
    const start = week % 2 === 0 ? monday : addDaysYmd(monday, -7)
    return { start, end: addDaysYmd(start, 13) }
  }
  return { start: monday, end: addDaysYmd(monday, 6) }
}

/** Validate custom range: end ≥ start, span ≤ 366 days. */
export function validatePayrollCustomRange(start, end) {
  const s = String(start || '').slice(0, 10)
  const e = String(end || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) {
    return { ok: false, reason: 'Start and end dates are required' }
  }
  if (e < s) return { ok: false, reason: 'End date must be on or after start' }
  const days = Math.round((manilaNoon(e) - manilaNoon(s)) / 86400000) + 1
  if (days > 366) return { ok: false, reason: 'Custom range cannot exceed 366 days' }
  return { ok: true, reason: null, days }
}

function saleDay(sale) {
  return saleBusinessDate(sale)
}

/**
 * Shop business day for a sale (Asia/Manila). Never use UTC `.slice(0, 10)` on ISO timestamps.
 */
export function saleBusinessDate(sale) {
  const explicit = sale?.business_date || sale?.occurred_on
  if (explicit) {
    const s = String(explicit).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  }
  const raw = sale?.occurred_at || sale?.sale_date
  if (!raw) return null
  try {
    return String(raw).length === 10 ? String(raw).slice(0, 10) : getLocalCalendarDate(raw)
  } catch {
    return null
  }
}

/**
 * Keep ceramic/detailing draft expenses whose sale_id is in the loaded POS set.
 * Ignores expense created_at — drafts may be posted after the sale day.
 */
export function filterCeramicExpensesForSales(expenses = [], sales = []) {
  const saleIds = new Set((sales || []).map((s) => String(s?.id || '')).filter(Boolean))
  if (!saleIds.size) return []
  return (expenses || []).filter((exp) => {
    const parsed = parseCeramicKey(exp?.description)
    return parsed && saleIds.has(String(parsed.saleId))
  })
}

/** Stamp staff_id on CA form payloads when the submitter is known. */
export function enrichCashAdvancePayload(payload = {}, profile = null) {
  const out = { ...(payload && typeof payload === 'object' ? payload : {}) }
  const existing = String(out.staff_id || '').trim()
  const profileId = String(profile?.id || '').trim()
  if (!existing && profileId) out.staff_id = profileId
  if (!String(out.employee_name || '').trim() && profile?.full_name) {
    out.employee_name = profile.full_name
  }
  return out
}

function inPeriod(day, period) {
  if (!day || !period?.start || !period?.end) return false
  return day >= period.start && day <= period.end
}

function parseCeramicKey(description) {
  // Legacy ceramic: + canonical detailing: keys
  const m = /^(?:ceramic|detailing):([^:]+):(crew|detailer)$/i.exec(String(description || '').trim())
  if (!m) return null
  return { saleId: m[1], side: m[2].toLowerCase() }
}

function rosterFor(attendance, branch, day) {
  return (attendance || [])
    .filter((row) => (row.branch_slug || row.branch) === branch && (row.attendance_date || row.date) === day)
    .map((row) => ({
      ...row,
      id: row.id || row.staff_id,
      staff_id: row.staff_id || row.id,
      attendance_status: row.attendance_status || row.status,
      branch_slug: row.branch_slug || row.branch,
    }))
}

function lineKey({ kind, staffId, branch, sourceKey }) {
  return `${kind}:${staffId || 'unassigned'}:${branch}:${sourceKey}`
}

function toLine({ kind, staff, branch, sourceKey, sourceSaleId, payMinor, date, missingAssignee = false }) {
  const staffId = staff?.staff_id || staff?.id || null
  return {
    key: lineKey({ kind, staffId, branch, sourceKey }),
    kind,
    staff_id: staffId,
    staff_name: staff?.full_name || staff?.name || '',
    role: staff?.role || null,
    branch,
    date,
    source_key: sourceKey,
    source_sale_id: sourceSaleId || null,
    attendance_weight: staff?.weight ?? null,
    pay_minor: Math.round(Number(payMinor) || 0),
    amount_minor: Math.round(Number(payMinor) || 0),
    missing_assignee: Boolean(missingAssignee),
  }
}

function splitAmount(roster, amountMinor, kind, { branch, sourceKey, sourceSaleId, date, rules }) {
  const pool = Math.round(Number(amountMinor) || 0)
  if (pool <= 0) return []
  const split = splitWashPool({ totalSalesMinor: pool, poolPct: 100, roster, rules, forWashPool: false })
  if (!split.rows.length) {
    return [
      toLine({
        kind,
        staff: null,
        branch,
        sourceKey,
        sourceSaleId,
        payMinor: pool,
        date,
        missingAssignee: true,
      }),
    ]
  }
  return split.rows.map((row) =>
    toLine({
      kind,
      staff: row,
      branch,
      sourceKey,
      sourceSaleId,
      payMinor: row.pay_minor,
      date,
    }),
  )
}

/**
 * Build a confirmable payroll preview from paid POS sales + daily attendance.
 * Ceramic Finance drafts (ceramic:{saleId}:crew|detailer) split onto that day's roster.
 * Package amount_minor = monthly salary; prorated by frequency for this run.
 * @param {'floor'|'fixed'|'all'} [opts.runKind]
 */
export function buildPayrollPreview({
  period,
  rules = {},
  sales = [],
  attendance = [],
  ceramicExpenses = [],
  claimedSaleIds = [],
  packages = [],
  runKind = 'all',
  frequency = 'weekly',
} = {}) {
  const claimed = new Set((claimedSaleIds || []).map(String))
  const poolPct = Number(rules.wash_pool_pct)
  const washByBranchDay = new Map()
  const salaryPctByBranchDay = new Map()
  const proof = []
  let posSalesMinor = 0
  const kind = String(runKind || 'all').toLowerCase()
  const includeFloor = kind === 'all' || kind === 'floor'
  const includeFixed = kind === 'all' || kind === 'fixed'
  let lines = []

  if (includeFloor) {
    for (const sale of sales || []) {
      if (String(sale?.status || 'paid') !== 'paid') continue
      const id = String(sale.id || '')
      if (!id || claimed.has(id)) continue
      const branch = sale.branch
      const day = saleDay(sale)
      if (!branch || !inPeriod(day, period)) continue
      const wash = washPoolAmountMinor(sale)
      const directPct = salaryPctPoolMinor(sale)
      if (wash <= 0 && directPct <= 0) continue
      posSalesMinor += wash
      proof.push({
        sale_id: id,
        branch,
        day,
        total_minor: Number(sale.total_minor) || wash,
        wash_pool_minor: wash,
        occurred_at: sale.occurred_at || null,
      })
      const key = `${branch}|${day}`
      if (wash > 0) washByBranchDay.set(key, (washByBranchDay.get(key) || 0) + wash)
      if (directPct > 0) salaryPctByBranchDay.set(key, (salaryPctByBranchDay.get(key) || 0) + directPct)
    }

    const allKeys = new Set([...washByBranchDay.keys(), ...salaryPctByBranchDay.keys()])
    for (const key of allKeys) {
      const [branch, day] = key.split('|')
      const roster = rosterFor(attendance, branch, day)
      const sourceKey = `compensation:${branch}:${day}`
      const split = splitWashPool({
        totalSalesMinor: washByBranchDay.get(key) || 0,
        poolPct,
        roster,
        rules,
      })
      for (const row of split.rows) {
        if (!row.pay_minor) continue
        lines.push(
          toLine({
            kind: 'wash_pool',
            staff: row,
            branch,
            sourceKey,
            payMinor: row.pay_minor,
            date: day,
          }),
        )
      }
      const directMinor = salaryPctByBranchDay.get(key) || 0
      if (directMinor > 0) {
        const directSplit = splitWashPool({
          totalSalesMinor: directMinor,
          poolPct: 100,
          roster,
          rules,
        })
        for (const row of directSplit.rows) {
          if (!row.pay_minor) continue
          lines.push(
            toLine({
              kind: 'wash_pool',
              staff: row,
              branch,
              sourceKey: `salary_pct:${branch}:${day}`,
              payMinor: row.pay_minor,
              date: day,
            }),
          )
        }
      }
    }

    for (const exp of ceramicExpenses || []) {
      const parsed = parseCeramicKey(exp.description)
      if (!parsed) continue
      if (claimed.has(String(parsed.saleId))) continue
      const sale = (sales || []).find((s) => String(s.id) === String(parsed.saleId))
      const branch = exp.branch || sale?.branch
      const day = saleDay(sale) || period?.start
      if (!branch || !inPeriod(day, period)) continue
      const lineKind = parsed.side === 'detailer' ? 'ceramic_detailer' : 'ceramic_crew'
      let roster = rosterFor(attendance, branch, day)
      if (lineKind === 'ceramic_detailer') {
        const assignedId =
          exp.staff_id ||
          exp.assigned_staff_id ||
          sale?.assigned_staff_id ||
          sale?.detailer_staff_id ||
          sale?.booking?.assigned_staff_id
        if (assignedId) {
          roster = roster.filter((r) => String(r.staff_id || r.id) === String(assignedId))
        } else {
          const detailers = roster.filter((r) => String(r.role || '').toLowerCase() === 'detailer')
          roster = detailers.length ? detailers : []
        }
      }
      lines.push(
        ...splitAmount(roster, exp.total_minor, lineKind, {
          branch,
          sourceKey: exp.description,
          sourceSaleId: parsed.saleId,
          date: day,
          rules,
        }),
      )
    }
  }

  if (includeFixed) {
    for (const pkg of packages || []) {
      const staffId = pkg.staff_id || pkg.staff?.id
      if (!staffId) continue
      const effectiveFrom = String(pkg.effective_from || '1970-01-01').slice(0, 10)
      if (period?.end && effectiveFrom > period.end) continue
      const monthly = Math.round(Number(pkg.amount_minor) || 0)
      if (monthly <= 0) continue
      const staff = pkg.staff || { id: staffId, staff_id: staffId, full_name: pkg.staff_name }
      const branch = resolveFixedSalaryBranch(pkg, staff)
      const payMinor = prorateMonthlyPackageMinor(monthly, frequency, period)
      if (payMinor <= 0) continue
      const pkgKind = pkg.package_kind === 'hybrid' ? 'package_hybrid' : 'package_fixed'
      lines.push({
        ...toLine({
          kind: pkgKind,
          staff,
          branch,
          sourceKey: `package:${pkg.id || staffId}`,
          payMinor,
          date: period?.start,
        }),
        direction: 'add',
        label: pkg.notes || 'Monthly salary (prorated)',
        monthly_amount_minor: monthly,
      })
    }
  }

  // Contract: cash advances deduct only via manual payroll wizard adjustments.

  const totalPayoutMinor = netPayrollLinesMinor(lines)
  return {
    period,
    run_kind: kind,
    frequency,
    rules: { wash_pool_pct: poolPct },
    pos_sales_minor: posSalesMinor,
    pool_minor: lines.filter((l) => l.kind === 'wash_pool').reduce((s, l) => s + l.pay_minor, 0),
    total_payout_minor: totalPayoutMinor,
    proof,
    lines,
    input: {
      period,
      rules,
      sales,
      attendance,
      ceramicExpenses,
      claimedSaleIds,
      packages,
      runKind: kind,
      frequency,
    },
  }
}

/** Monthly package → this run's share by payout frequency. */
export function prorateMonthlyPackageMinor(monthlyMinor, frequency, period = null) {
  const monthly = Math.round(Number(monthlyMinor) || 0)
  if (monthly <= 0) return 0
  const freq = String(frequency || 'weekly').toLowerCase()
  if (freq === 'monthly') return monthly
  if (freq === 'semimonthly') return Math.round(monthly / 2)
  if (freq === 'biweekly') return Math.round((monthly * 12) / 26)
  if (freq === 'weekly') return Math.round((monthly * 12) / 52)
  if (freq === 'daily') return Math.round(monthly / 30)
  if (freq === 'custom' && period?.start && period?.end) {
    const days = Math.round((manilaNoon(period.end) - manilaNoon(period.start)) / 86400000) + 1
    const [y, m] = String(period.start).split('-').map(Number)
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return Math.round((monthly * Math.max(1, days)) / Math.max(28, daysInMonth))
  }
  return Math.round((monthly * 12) / 52)
}

export const PAYROLL_RUN_KINDS = Object.freeze([
  { id: 'floor', label: 'Floor pay', hint: 'Crew, TL, detailer — wash pool + ceramic from days worked' },
  { id: 'fixed', label: 'Fixed salary', hint: 'Office / BA / marketing — monthly package prorated' },
])

export function netPayrollLinesMinor(lines = []) {
  return (lines || []).reduce((sum, row) => {
    const amt = Math.round(Number(row.pay_minor) || Number(row.amount_minor) || 0)
    if (row.direction === 'deduct' || row.kind === 'adjustment_deduct') return sum - amt
    return sum + amt
  }, 0)
}

/**
 * Add labeled adjustment (add or deduct). Amount always stored positive.
 */
export function addPayrollAdjustment(lines = [], { staff, branch, direction, label, amountMinor }) {
  const dir = direction === 'deduct' ? 'deduct' : 'add'
  const amount = Math.round(Number(amountMinor) || 0)
  const trimmed = String(label || '').trim()
  if (amount <= 0 || !trimmed || !staff) return lines
  const lineBranch = String(branch || staff.branch_slug || FIXED_SALARY_BOOKS_BRANCH).trim()
  if (!lineBranch) return lines
  const kind = dir === 'deduct' ? 'adjustment_deduct' : 'adjustment_add'
  const sourceKey = `${dir}:${trimmed}`
  const row = {
    ...toLine({
      kind,
      staff,
      branch: lineBranch,
      sourceKey,
      payMinor: amount,
      date: null,
    }),
    direction: dir,
    label: trimmed,
  }
  return [...(lines || []), row]
}

/** Commission / bonus convenience — always an add labeled for the review UI. */
/**
 * SA wizard applies approved cash advances as labeled deducts.
 * Pending/draft rows are ignored. Never auto-runs inside buildPayrollPreview.
 */
export function applyCashAdvanceDeductions(lines = [], advances = []) {
  let next = [...(lines || [])]
  for (const ca of advances || []) {
    const status = String(ca.status || '').toLowerCase()
    if (!['approved', 'accepted', 'paid'].includes(status)) continue
    const amount = Math.round(Number(ca.amount_minor) || 0)
    const staff = ca.staff || {
      id: ca.staff_id,
      staff_id: ca.staff_id,
      full_name: ca.staff_name || ca.employee_name || '',
      branch_slug: ca.branch,
    }
    if (amount <= 0 || !(staff.staff_id || staff.id)) continue
    next = addPayrollAdjustment(next, {
      staff,
      branch: ca.branch || staff.branch_slug,
      direction: 'deduct',
      label: ca.label || `Cash advance${ca.id ? ` · ${ca.id}` : ''}`,
      amountMinor: amount,
    })
  }
  return next
}

export function addPayrollCommission(lines = [], { staff, branch, label, amountMinor }) {
  const trimmed = String(label || 'Commission').trim() || 'Commission'
  return addPayrollAdjustment(lines, {
    staff,
    branch: branch || resolveFixedSalaryBranch({}, staff),
    direction: 'add',
    label: /commission|bonus/i.test(trimmed) ? trimmed : `Commission · ${trimmed}`,
    amountMinor,
  })
}

export function validatePayrollAdjustment({ direction, label, amountMinor }) {
  const errors = {}
  if (!['add', 'deduct'].includes(direction)) errors.direction = 'Choose add or deduct'
  if (!String(label || '').trim()) errors.label = 'Label is required'
  const amt = Math.round(Number(amountMinor) || 0)
  if (!(amt > 0)) errors.amount = 'Amount must be greater than 0'
  return { ok: Object.keys(errors).length === 0, errors }
}

export function adjustPayrollLine(lines = [], key, amountMinor) {
  const next = Math.max(0, Math.round(Number(amountMinor) || 0))
  return (lines || []).map((row) =>
    row.key === key ? { ...row, pay_minor: next, amount_minor: next, missing_assignee: next > 0 && !row.staff_id } : row,
  )
}

export function rebuildWashPoolLines(preview, washPoolPct) {
  const input = preview?.input || {}
  return buildPayrollPreview({
    ...input,
    rules: { ...(input.rules || preview?.rules || {}), wash_pool_pct: Number(washPoolPct) },
  })
}

export function payrollBlocksConfirm(preview) {
  const lines = preview?.lines || preview || []
  const list = Array.isArray(lines) ? lines : []
  if (list.some((row) => row.missing_assignee || (row.pay_minor > 0 && !row.staff_id))) {
    return { blocked: true, reason: 'Assign every payout line to an employee' }
  }
  if (list.some((row) => {
    const amt = Number(row.pay_minor)
    return !Number.isFinite(amt) || amt < 0
  })) {
    return { blocked: true, reason: 'Payout lines cannot be negative' }
  }
  if (list.some((row) => (row.kind === 'adjustment_add' || row.kind === 'adjustment_deduct') && !String(row.label || '').trim())) {
    return { blocked: true, reason: 'Each add/deduct needs a label' }
  }
  if (netPayrollLinesMinor(list) <= 0) {
    return { blocked: true, reason: 'Nothing to pay for this period' }
  }
  return { blocked: false, reason: null }
}

export function ownPayTotalMinor(lines = [], staffId) {
  if (!staffId) return 0
  return (lines || [])
    .filter((row) => row.staff_id === staffId || row.id === staffId)
    .reduce((sum, row) => sum + (Number(row.pay_minor) || Number(row.amount_minor) || 0), 0)
}

/** Latest confirmed/paid run total. Lines are newest-first. */
export function currentPostedPayoutMinor(lines = []) {
  const open = (lines || []).filter((row) => ['confirmed', 'paid'].includes(row.payroll_runs?.status))
  const latest = open[0]
  if (!latest?.payroll_runs) return { amountMinor: 0, periodStart: null, periodEnd: null }
  const periodStart = latest.payroll_runs.period_start
  const periodEnd = latest.payroll_runs.period_end
  const confirmedAt = latest.payroll_runs.confirmed_at || ''
  const amountMinor = open
    .filter((row) =>
      row.payroll_runs?.period_start === periodStart
      && row.payroll_runs?.period_end === periodEnd
      && (row.payroll_runs?.confirmed_at || '') === confirmedAt)
    .reduce((sum, row) => sum + signedLineMinor(row), 0)
  return { amountMinor, periodStart, periodEnd }
}

function signedLineMinor(row) {
  const amt = Math.round(Number(row.amount_minor) || Number(row.pay_minor) || 0)
  const key = String(row.source_key || '')
  if (key.startsWith('deduct:') || row.direction === 'deduct' || row.kind === 'adjustment_deduct') {
    return -amt
  }
  return amt
}

/** Confirmed lines whose run overlaps [start,end] (inclusive YMD). */
export function confirmedPayInCalendarWindow(lines = [], { start, end } = {}) {
  const s = String(start || '').slice(0, 10)
  const e = String(end || '').slice(0, 10)
  return (lines || [])
    .filter((row) => ['confirmed', 'paid'].includes(row.payroll_runs?.status))
    .filter((row) => {
      const ps = row.payroll_runs?.period_start
      const pe = row.payroll_runs?.period_end
      if (!ps || !pe || !s || !e) return false
      return ps <= e && pe >= s
    })
    .reduce((sum, row) => sum + signedLineMinor(row), 0)
}

/** Manila calendar month bounds for a YMD. */
export function manilaMonthBounds(ymd) {
  const day = String(ymd || getLocalCalendarDate()).slice(0, 10)
  return payrollPeriodRange('monthly', day)
}

export function assignPayrollLineStaff(lines = [], key, staff) {
  return (lines || []).map((row) => {
    if (row.key !== key) return row
    const staffId = staff?.id || staff?.staff_id || null
    return {
      ...row,
      staff_id: staffId,
      staff_name: staff?.full_name || staff?.name || row.staff_name,
      missing_assignee: row.pay_minor > 0 && !staffId,
      key: lineKey({ kind: row.kind, staffId, branch: row.branch, sourceKey: row.source_key }),
    }
  })
}

export function buildRunPayrollPayload({ preview, branch, frequency, notes = '', runKind = 'floor' }) {
  const period = preview?.period || {}
  const kind = String(runKind || preview?.run_kind || 'floor').toLowerCase() === 'fixed' ? 'fixed' : 'floor'
  return {
    branch: branch && branch !== 'all' ? branch : null,
    frequency,
    period_start: period.start,
    period_end: period.end,
    wash_pool_pct: Number(preview?.rules?.wash_pool_pct) || 0,
    notes,
    run_kind: kind,
    sales: (preview?.proof || []).map((row) => ({
      sale_id: row.sale_id,
      branch: row.branch,
      total_minor: row.total_minor,
      wash_pool_minor: row.wash_pool_minor,
    })),
    lines: (preview?.lines || [])
      .filter((row) => row.pay_minor > 0)
      .map((row) => ({
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        branch: row.branch,
        kind: row.kind === 'adjustment_deduct' || row.kind === 'adjustment_add' ? 'adjustment' : row.kind,
        direction: row.direction || (row.kind === 'adjustment_deduct' ? 'deduct' : 'add'),
        label: row.label || null,
        source_key: row.source_key,
        source_sale_id: row.source_sale_id,
        attendance_weight: row.attendance_weight,
        amount_minor: row.pay_minor,
      })),
  }
}

/** True when a payroll run is floor/bay pay (not fixed salary). */
export function isFloorPayrollRun(run) {
  const kind = String(run?.run_kind || '').toLowerCase()
  if (kind === 'floor') return true
  if (kind === 'fixed') return false
  const notes = String(run?.notes || '')
  if (/fixed\s*salary/i.test(notes)) return false
  if (/floor\s*pay/i.test(notes)) return true
  if (Number(run?.pos_sales_minor) > 0) return true
  const sales = run?.payroll_run_sales
  return Array.isArray(sales) && sales.length > 0
}

/** Confirmed/paid floor run covers this branch business day via claimed sales, else period. */
export function floorPayrollCoversDay(run, ymd, branch) {
  if (!isFloorPayrollRun(run)) return false
  if (!['confirmed', 'paid'].includes(String(run?.status || ''))) return false
  const day = String(ymd || '').slice(0, 10)
  const br = String(branch || '').trim()
  if (!day || !br) return false
  if (run.branch && String(run.branch) !== br) return false

  const claimed = run.payroll_run_sales || run.claimed_sales || []
  if (Array.isArray(claimed) && claimed.length > 0) {
    return claimed.some((sale) => {
      const saleBranch = String(sale.branch || run.branch || '').trim()
      if (saleBranch && saleBranch !== br) return false
      const claimedDay = saleBusinessDate(sale)
      if (claimedDay) return claimedDay === day
      // Sale row without a day — fall through to period only for that sale's absence
      return false
    })
  }

  const start = String(run.period_start || '').slice(0, 10)
  const end = String(run.period_end || '').slice(0, 10)
  if (!start || !end || start > day || end < day) return false
  return true
}

/**
 * Accepted (and submitted) end-of-shift days not yet covered by a floor payroll run.
 * Coverage prefers claimed POS sale business dates when payroll_run_sales are present.
 * Optional posProofByKey: Map or object of `${branch}|${business_date}` → wash-eligible / total paid minor.
 */
/**
 * Collect BA salary draft extras from accepted/locked (or submitted) closes in a window.
 */
export function collectSalaryDraftExtrasFromCloses(
  closes = [],
  { branch = null, periodStart = null, periodEnd = null, readyOnly = true } = {},
) {
  const start = periodStart ? String(periodStart).slice(0, 10) : null
  const end = periodEnd ? String(periodEnd).slice(0, 10) : null
  const bay = branch ? String(branch).trim() : null
  const out = []
  for (const close of closes || []) {
    const status = String(close.status || '')
    if (readyOnly && !['accepted', 'locked'].includes(status)) continue
    if (!readyOnly && !['submitted', 'accepted', 'locked'].includes(status)) continue
    const d = String(close.business_date || '').slice(0, 10)
    const b = String(close.branch || '').trim()
    if (!d || !b) continue
    if (bay && b !== bay) continue
    if (start && d < start) continue
    if (end && d > end) continue
    const extras = normalizeSalaryDraftExtras(close.submitted?.salary_draft_extras)
    for (const row of extras) {
      out.push({
        ...row,
        branch: b,
        business_date: d,
        close_id: close.id || null,
      })
    }
  }
  return out
}

/** Seed preview adjustments from BA EoS drafts (SA still confirms). */
export function applySalaryDraftExtrasToPreview(preview, drafts = [], staffRoster = []) {
  if (!preview || !Array.isArray(preview.lines)) return preview
  const byId = new Map((staffRoster || []).map((s) => [String(s.id || s.staff_id), s]))
  let lines = [...preview.lines]
  for (const draft of drafts || []) {
    const staff =
      (draft.staff_id && byId.get(String(draft.staff_id))) ||
      (staffRoster || []).find(
        (s) =>
          String(s.full_name || s.staff_name || '').trim().toLowerCase() ===
          String(draft.staff_name || '').trim().toLowerCase(),
      ) || {
        id: draft.staff_id || null,
        staff_id: draft.staff_id || null,
        full_name: draft.staff_name,
      }
    const note = draft.note ? `BA draft · ${draft.note}` : 'BA draft from end of shift'
    lines = addPayrollAdjustment(lines, {
      staff,
      branch: draft.branch,
      direction: draft.kind === 'deduction' ? 'deduct' : 'add',
      label: note,
      amountMinor: draft.amount_minor,
    })
  }
  return {
    ...preview,
    lines,
    total_payout_minor: netPayrollLinesMinor(lines),
    salary_draft_extras: drafts,
  }
}

export function buildPendingFloorPayrollQueue({ closes = [], runs = [], posProofByKey = null } = {}) {
  const readyStatuses = new Set(['accepted', 'locked'])
  const reviewStatuses = new Set(['submitted'])
  const proofMap =
    posProofByKey instanceof Map
      ? posProofByKey
      : posProofByKey && typeof posProofByKey === 'object'
        ? new Map(Object.entries(posProofByKey))
        : null
  const days = []

  for (const close of closes || []) {
    const business_date = String(close.business_date || '').slice(0, 10)
    const branch = String(close.branch || '').trim()
    const status = String(close.status || '')
    if (!business_date || !branch) continue
    if (!readyStatuses.has(status) && !reviewStatuses.has(status)) continue
    if ((runs || []).some((r) => floorPayrollCoversDay(r, business_date, branch))) continue

    const close_sales_minor = Math.round(
      Number(close.submitted?.total_sales_minor ?? close.submitted?.square_sales_minor ?? 0) || 0,
    )
    const proofKey = `${branch}|${business_date}`
    const pos_proof_minor = proofMap?.has(proofKey)
      ? Math.round(Number(proofMap.get(proofKey)) || 0)
      : null
    const salary_draft_extras = normalizeSalaryDraftExtras(close.submitted?.salary_draft_extras)
    days.push({
      close_id: close.id,
      branch,
      business_date,
      status,
      ready: readyStatuses.has(status),
      total_sales_minor: close_sales_minor,
      close_sales_minor,
      pos_proof_minor,
      shift_ended_at: close.shift_ended_at || null,
      salary_draft_extras,
    })
  }

  days.sort(
    (a, b) =>
      a.business_date.localeCompare(b.business_date) || a.branch.localeCompare(b.branch),
  )

  const byBranch = new Map()
  for (const row of days) {
    if (!byBranch.has(row.branch)) {
      byBranch.set(row.branch, {
        branch: row.branch,
        days: [],
        ready_count: 0,
        review_count: 0,
        total_sales_minor: 0,
        close_sales_minor: 0,
        pos_proof_minor: 0,
        pos_proof_known: false,
        period_start: row.business_date,
        period_end: row.business_date,
        salary_draft_extras: [],
      })
    }
    const g = byBranch.get(row.branch)
    g.days.push(row)
    g.total_sales_minor += row.close_sales_minor
    g.close_sales_minor += row.close_sales_minor
    if (row.salary_draft_extras?.length) {
      g.salary_draft_extras.push(
        ...row.salary_draft_extras.map((e) => ({ ...e, business_date: row.business_date })),
      )
    }
    if (row.pos_proof_minor != null) {
      g.pos_proof_minor += row.pos_proof_minor
      g.pos_proof_known = true
    }
    if (row.ready) g.ready_count += 1
    else g.review_count += 1
    if (row.business_date < g.period_start) g.period_start = row.business_date
    if (row.business_date > g.period_end) g.period_end = row.business_date
  }

  const groups = [...byBranch.values()].sort((a, b) => a.branch.localeCompare(b.branch))
  days.groups = groups
  days.ready_day_count = days.filter((d) => d.ready).length
  days.review_day_count = days.filter((d) => !d.ready).length
  return days
}

/**
 * Hard gate when pending_floor_optional === false:
 * every day in the floor period for this branch must have an accepted/locked close
 * (or no close at all only if allowMissingClose — default false requires accepted when sales expected).
 */
export function floorConfirmBlockedByPendingCloses({
  pendingFloorOptional = true,
  runKind = 'floor',
  branch,
  periodStart,
  periodEnd,
  closes = [],
} = {}) {
  if (String(runKind || '') !== 'floor') return { blocked: false, reason: null }
  if (pendingFloorOptional !== false) return { blocked: false, reason: null }
  const start = String(periodStart || '').slice(0, 10)
  const end = String(periodEnd || '').slice(0, 10)
  const bay = String(branch || '').trim()
  if (!start || !end || !bay) {
    return { blocked: true, reason: 'Pick a branch and period for floor pay' }
  }

  const inWindow = (closes || []).filter((c) => {
    const d = String(c.business_date || '').slice(0, 10)
    return String(c.branch || '') === bay && d >= start && d <= end
  })

  const waiting = inWindow.filter((c) => String(c.status || '') === 'submitted')
  if (waiting.length) {
    return {
      blocked: true,
      reason: `Accept ${waiting.length} end-of-shift close(s) in Finance before confirming floor pay`,
    }
  }

  const ready = inWindow.filter((c) => ['accepted', 'locked'].includes(String(c.status || '')))
  if (!ready.length) {
    return {
      blocked: true,
      reason: 'No accepted end-of-shift close for this branch and period — submit and accept close first',
    }
  }
  return { blocked: false, reason: null }
}

/** Roll wash-pool + ceramic preview lines onto Bacoor salary fields (display / EoS baseline). */
export function applyFloorPreviewToBacoorReport(report, preview, rules = {}) {
  const out = report && typeof report === 'object' ? { ...report } : {}
  const lines = preview?.lines || []
  let wash = 0
  let detailer = 0
  let tinter = 0
  for (const row of lines) {
    const kind = String(row.kind || '')
    const amt = Math.round(Number(row.pay_minor) || 0)
    if (!amt) continue
    // Carwash salary cell = wash pool only. Ceramic crew/detailer are detailing splits.
    if (kind === 'wash_pool') wash += amt
    else if (kind === 'ceramic_detailer') detailer += amt
  }
  const poolFallback = Math.round(Number(preview?.pool_minor) || 0)
  out.carwash_salary_minor = wash || poolFallback
  out.detailer_salary_minor = detailer
  out.tinter_salary_minor = tinter
  out.wash_pool_pct = Number(rules.wash_pool_pct ?? preview?.rules?.wash_pool_pct) || 0
  out.salary_from_preview = true
  return out
}

/** Build `${branch}|${day}` → paid total minor from sales rows (for pending dual ₱). */
export function posProofTotalsByBranchDay(sales = []) {
  const map = new Map()
  for (const sale of sales || []) {
    if (String(sale?.status || 'paid') !== 'paid') continue
    const branch = String(sale.branch || '').trim()
    const day = String(saleBusinessDate(sale) || '').slice(0, 10)
    if (!branch || !day) continue
    const key = `${branch}|${day}`
    map.set(key, (map.get(key) || 0) + (Number(sale.total_minor) || 0))
  }
  return map
}

/** Finance / reporting label for whether floor pay has posted for a close day. */
export function shiftClosePayrollCoverage(close, runs = []) {
  const status = String(close?.status || '')
  const day = String(close?.business_date || '').slice(0, 10)
  const branch = String(close?.branch || '').trim()
  if (!day || !branch) return { covered: false, label: '—' }
  if ((runs || []).some((r) => floorPayrollCoversDay(r, day, branch))) {
    return { covered: true, label: 'Floor coverage · posted' }
  }
  if (status === 'accepted' || status === 'locked') {
    return { covered: false, label: 'Floor coverage · pending confirm' }
  }
  if (status === 'submitted') return { covered: false, label: 'Floor coverage · awaiting close review' }
  return { covered: false, label: status || '—' }
}
