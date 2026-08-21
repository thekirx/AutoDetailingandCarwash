/**
 * Payroll engine: period windows, POS-proofed preview, line edits.
 * Amounts in minor units. Reuses washPoolAmountMinor + splitWashPool.
 */

import { getLocalCalendarDate } from './localCalendarDate.js'
import { PAYOUT_FREQUENCIES, splitWashPool, washPoolAmountMinor } from './compensation.js'

export { PAYOUT_FREQUENCIES }

export const PAYROLL_WIZARD_STEPS = Object.freeze([
  { id: 'period', label: 'Period', hint: 'Branch, frequency, and dates' },
  { id: 'proof', label: 'POS proof', hint: 'Paid sales that fund this run' },
  { id: 'lines', label: 'Payouts', hint: 'Edit amounts and commission' },
  { id: 'confirm', label: 'Confirm', hint: 'Post to Finance' },
])

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
  const raw = sale?.occurred_at || sale?.sale_date
  if (!raw) return null
  try {
    return String(raw).length === 10 ? raw : getLocalCalendarDate(raw)
  } catch {
    return null
  }
}

function inPeriod(day, period) {
  if (!day || !period?.start || !period?.end) return false
  return day >= period.start && day <= period.end
}

function parseCeramicKey(description) {
  const m = /^ceramic:([^:]+):(crew|detailer)$/i.exec(String(description || '').trim())
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

function splitAmount(roster, amountMinor, kind, { branch, sourceKey, sourceSaleId, date }) {
  const pool = Math.round(Number(amountMinor) || 0)
  if (pool <= 0) return []
  const split = splitWashPool({ totalSalesMinor: pool, poolPct: 100, roster })
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
 */
export function buildPayrollPreview({
  period,
  rules = {},
  sales = [],
  attendance = [],
  ceramicExpenses = [],
  claimedSaleIds = [],
  packages = [],
} = {}) {
  const claimed = new Set((claimedSaleIds || []).map(String))
  const poolPct = Number(rules.wash_pool_pct)
  const washByBranchDay = new Map()
  const proof = []
  let posSalesMinor = 0

  for (const sale of sales || []) {
    if (String(sale?.status || 'paid') !== 'paid') continue
    const id = String(sale.id || '')
    if (!id || claimed.has(id)) continue
    const branch = sale.branch
    const day = saleDay(sale)
    if (!branch || !inPeriod(day, period)) continue
    const wash = washPoolAmountMinor(sale)
    if (wash <= 0) continue
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
    washByBranchDay.set(key, (washByBranchDay.get(key) || 0) + wash)
  }

  const lines = []
  for (const [key, totalSalesMinor] of washByBranchDay) {
    const [branch, day] = key.split('|')
    const sourceKey = `compensation:${branch}:${day}`
    const split = splitWashPool({
      totalSalesMinor,
      poolPct,
      roster: rosterFor(attendance, branch, day),
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
  }

  for (const exp of ceramicExpenses || []) {
    const parsed = parseCeramicKey(exp.description)
    if (!parsed) continue
    if (claimed.has(String(parsed.saleId))) continue
    const sale = (sales || []).find((s) => String(s.id) === String(parsed.saleId))
    const branch = exp.branch || sale?.branch
    const day = saleDay(sale) || period?.start
    if (!branch || !inPeriod(day, period)) continue
    const kind = parsed.side === 'detailer' ? 'ceramic_detailer' : 'ceramic_crew'
    let roster = rosterFor(attendance, branch, day)
    if (kind === 'ceramic_detailer') {
      const detailers = roster.filter((r) => String(r.role || '').toLowerCase() === 'detailer')
      roster = detailers.length ? detailers : []
    }
    lines.push(
      ...splitAmount(roster, exp.total_minor, kind, {
        branch,
        sourceKey: exp.description,
        sourceSaleId: parsed.saleId,
        date: day,
      }),
    )
  }

  for (const pkg of packages || []) {
    const staffId = pkg.staff_id || pkg.staff?.id
    if (!staffId) continue
    const effectiveFrom = String(pkg.effective_from || '1970-01-01').slice(0, 10)
    if (period?.end && effectiveFrom > period.end) continue
    const amount = Math.round(Number(pkg.amount_minor) || 0)
    if (amount <= 0) continue
    const branch = pkg.branch
    if (!branch) continue
    const kind = pkg.package_kind === 'hybrid' ? 'package_hybrid' : 'package_fixed'
    lines.push({
      ...toLine({
        kind,
        staff: pkg.staff || { id: staffId, staff_id: staffId, full_name: pkg.staff_name },
        branch,
        sourceKey: `package:${pkg.id || staffId}`,
        payMinor: amount,
        date: period?.start,
      }),
      direction: 'add',
      label: pkg.notes || pkg.package_kind || 'Pay package',
    })
  }

  const totalPayoutMinor = netPayrollLinesMinor(lines)
  return {
    period,
    rules: { wash_pool_pct: poolPct },
    pos_sales_minor: posSalesMinor,
    pool_minor: lines.filter((l) => l.kind === 'wash_pool').reduce((s, l) => s + l.pay_minor, 0),
    total_payout_minor: totalPayoutMinor,
    proof,
    lines,
    input: { period, rules, sales, attendance, ceramicExpenses, claimedSaleIds, packages },
  }
}

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
  const lineBranch = String(branch || staff.branch_slug || '').trim()
  if (!lineBranch) return lines
  const staffId = staff.staff_id || staff.id
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

export function buildRunPayrollPayload({ preview, branch, frequency, notes = '' }) {
  const period = preview?.period || {}
  return {
    branch: branch && branch !== 'all' ? branch : null,
    frequency,
    period_start: period.start,
    period_end: period.end,
    wash_pool_pct: Number(preview?.rules?.wash_pool_pct) || 0,
    notes,
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
