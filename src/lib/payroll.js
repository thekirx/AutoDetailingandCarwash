/**
 * Payroll engine: period windows, POS-proofed preview, line edits.
 * Amounts in minor units. Reuses washPoolAmountMinor + splitWashPool.
 */

import { getLocalCalendarDate } from './localCalendarDate.js'
import {
  PAYOUT_FREQUENCIES,
  clampCompensationPercent,
  salaryPctPoolMinor,
  splitWashPool,
  washPoolAmountMinor,
} from './compensation.js'

export { PAYOUT_FREQUENCIES }

/** Books bucket for company-wide / office salaries (not a wash bay). */
export const FIXED_SALARY_BOOKS_BRANCH = 'hq'

export function resolveFixedSalaryBranch(pkg = {}, staff = null) {
  return (
    String(pkg.branch || '').trim() ||
    String(staff?.branch_slug || pkg.staff?.branch_slug || '').trim() ||
    FIXED_SALARY_BOOKS_BRANCH
  )
}

function manilaNoon(ymd) {
  return new Date(`${ymd}T12:00:00+08:00`)
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
  const poolPct = clampCompensationPercent(rules.wash_pool_pct)
  const washByBranchDay = new Map()
  const salaryPctByBranchDay = new Map()
  const proof = []
  let posSalesMinor = 0
  let salaryPctTotalMinor = 0
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
      salaryPctTotalMinor += directPct
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
    theoretical_pool_minor: Math.round(posSalesMinor * poolPct / 100) + salaryPctTotalMinor,
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

export function netPayrollLinesMinor(lines = []) {
  return (lines || []).reduce((sum, row) => {
    const amt = Math.round(Number(row.pay_minor) || Number(row.amount_minor) || 0)
    if (row.direction === 'deduct' || row.kind === 'adjustment_deduct') return sum - amt
    return sum + amt
  }, 0)
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
  out.wash_pool_pct = clampCompensationPercent(rules.wash_pool_pct ?? preview?.rules?.wash_pool_pct)
  out.salary_from_preview = true
  return out
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
