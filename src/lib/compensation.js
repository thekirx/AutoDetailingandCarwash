/**
 * SA-configurable compensation engine (wash pool + ceramic detailing splits).
 * Amounts in minor units (centavos). Percentages are whole numbers (35 = 35%).
 */

export const DEFAULT_COMPENSATION_RULES = Object.freeze({
  wash_pool_pct: 35,
  ceramic_shirt_deduction_minor: 50000,
  ceramic_card_fee_pct: 3.5,
  ceramic_crew_solo_pct: 20,
  ceramic_crew_split_pct: 10,
  ceramic_detailer_split_pct: 10,
})

const COMP_KEYS = Object.keys(DEFAULT_COMPENSATION_RULES)

/** Map a compensation_settings row (scalar columns, or legacy rules json) to engine input. */
export function normalizeCompensationSettings(row) {
  const src = row && typeof row.rules === 'object' && row.rules ? { ...row, ...row.rules } : row || {}
  const out = { ...DEFAULT_COMPENSATION_RULES }
  for (const key of COMP_KEYS) {
    const n = Number(src[key])
    if (Number.isFinite(n)) out[key] = n
  }
  return out
}

/** Payload for compensation_settings upsert — never a `rules` json blob. */
export function toCompensationSettingsRow(rules, { id = 1 } = {}) {
  const n = normalizeCompensationSettings(rules)
  return {
    id,
    wash_pool_pct: n.wash_pool_pct,
    ceramic_shirt_deduction_minor: n.ceramic_shirt_deduction_minor,
    ceramic_card_fee_pct: n.ceramic_card_fee_pct,
    ceramic_crew_solo_pct: n.ceramic_crew_solo_pct,
    ceramic_crew_split_pct: n.ceramic_crew_split_pct,
    ceramic_detailer_split_pct: n.ceramic_detailer_split_pct,
  }
}

/**
 * Lateness weight: present = 1, late = 0.7, else 0.
 * ponytail: linear weights; upgrade to minute-based if SA asks.
 */
export function attendanceWeight(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'present') return 1
  if (s === 'late') return 0.7
  return 0
}

/** Split wash/package sales pool across on-shift crew + TL by attendance weight. */
export function splitWashPool({ totalSalesMinor = 0, poolPct = 35, roster = [] } = {}) {
  const pool = Math.round((Number(totalSalesMinor) || 0) * (Number(poolPct) || 0) / 100)
  const weighted = (roster || [])
    .map((row) => ({
      ...row,
      weight: attendanceWeight(row.attendance_status || row.status),
    }))
    .filter((row) => row.weight > 0)
  const weightSum = weighted.reduce((sum, row) => sum + row.weight, 0)
  if (!pool || !weightSum) {
    return { pool_minor: pool, rows: weighted.map((row) => ({ ...row, pay_minor: 0 })) }
  }
  const rows = weighted.map((row) => ({
    ...row,
    pay_minor: Math.round((pool * row.weight) / weightSum),
  }))
  return { pool_minor: pool, rows }
}

/**
 * Ceramic / detailing net after optional shirt + card fee, then crew/detailer split.
 * toggles: { freeShirt, cardPayment, crewAssisted, detailerAssigned }
 */
export function computeCeramicPay({
  salesMinor = 0,
  rules = DEFAULT_COMPENSATION_RULES,
  toggles = {},
} = {}) {
  const r = { ...DEFAULT_COMPENSATION_RULES, ...rules }
  let remaining = Number(salesMinor) || 0
  if (toggles.freeShirt) remaining -= Number(r.ceramic_shirt_deduction_minor) || 0
  if (toggles.cardPayment) {
    remaining -= Math.round(remaining * (Number(r.ceramic_card_fee_pct) || 0) / 100)
  }
  remaining = Math.max(0, remaining)

  const detailerAssigned = Boolean(toggles.detailerAssigned)
  const crewPct = detailerAssigned
    ? Number(r.ceramic_crew_split_pct) || 0
    : toggles.crewAssisted === false
      ? 0
      : Number(r.ceramic_crew_solo_pct) || 0
  const detailerPct = detailerAssigned ? Number(r.ceramic_detailer_split_pct) || 0 : 0

  return {
    remaining_minor: remaining,
    crew_minor: Math.round(remaining * crewPct / 100),
    detailer_minor: Math.round(remaining * detailerPct / 100),
    crew_pct: crewPct,
    detailer_pct: detailerPct,
  }
}

export function compensationExpenseKey({ date, branch } = {}) {
  return `compensation:${branch}:${date}`
}

/** Draft expense row for today's wash pool. Null when there is nothing to post. */
export function buildDailyCompensationExpense({ date, branch, poolMinor } = {}) {
  const pool = Math.round(Number(poolMinor) || 0)
  if (!date || !branch || branch === 'all' || pool <= 0) return null
  return {
    title: `Carwash salary pool · ${branch} · ${date}`,
    description: compensationExpenseKey({ date, branch }),
    total_minor: pool,
    unit_cost_minor: pool,
    quantity: 1,
    expense_kind: 'salary_carwash',
    branch,
    status: 'draft',
  }
}

export function findPostedCompensationExpense(expenses = [], { date, branch } = {}) {
  const key = compensationExpenseKey({ date, branch })
  return (expenses || []).find((row) => row?.description === key) || null
}

function rosterAttendanceStatus(member) {
  return member?.attendance_status || member?.attendance?.status || (member?.is_present_today ? 'present' : 'absent')
}

/** Group today's sales + present roster into per-branch pool drafts for Finance. */
export function buildCompensationPostPlan({
  date,
  salesRows = [],
  roster = [],
  poolPct,
  posted = [],
  branchFilter = 'all',
} = {}) {
  const salesByBranch = {}
  for (const sale of salesRows || []) {
    const branch = sale?.branch
    if (!branch) continue
    if (branchFilter && branchFilter !== 'all' && branch !== branchFilter) continue
    salesByBranch[branch] = (salesByBranch[branch] || 0) + Number(sale.total_minor || 0)
  }

  const rosterByBranch = {}
  for (const member of roster || []) {
    const status = rosterAttendanceStatus(member)
    if (attendanceWeight(status) <= 0) continue
    const branch = member.branch_slug || (branchFilter && branchFilter !== 'all' ? branchFilter : null)
    if (!branch) continue
    if (branchFilter && branchFilter !== 'all' && branch !== branchFilter) continue
    if (!rosterByBranch[branch]) rosterByBranch[branch] = []
    rosterByBranch[branch].push({ ...member, attendance_status: status })
  }

  const branchResults = [...new Set([...Object.keys(salesByBranch), ...Object.keys(rosterByBranch)])].map((branch) => ({
    branch,
    ...splitWashPool({
      totalSalesMinor: salesByBranch[branch] || 0,
      poolPct,
      roster: rosterByBranch[branch] || [],
    }),
  }))

  const drafts = branchResults
    .map((row) => buildDailyCompensationExpense({ date, branch: row.branch, poolMinor: row.pool_minor }))
    .filter(Boolean)
  const pending = drafts.filter((draft) => !findPostedCompensationExpense(posted, { date, branch: draft.branch }))

  return {
    totalSales: Object.values(salesByBranch).reduce((sum, n) => sum + n, 0),
    pool_minor: branchResults.reduce((sum, row) => sum + row.pool_minor, 0),
    rows: branchResults.flatMap((row) => row.rows.map((member) => ({ ...member, branch: row.branch }))),
    drafts,
    pending,
  }
}
