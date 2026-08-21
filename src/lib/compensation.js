/**
 * SA-configurable compensation engine (wash pool + ceramic detailing splits).
 * Amounts in minor units (centavos). Percentages are whole numbers (35 = 35%).
 */

export const PAYOUT_FREQUENCIES = Object.freeze([
  'daily',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'custom',
])

export const DEFAULT_COMPENSATION_RULES = Object.freeze({
  wash_pool_pct: 35,
  ceramic_shirt_deduction_minor: 50000,
  ceramic_card_fee_pct: 3.5,
  ceramic_crew_solo_pct: 20,
  ceramic_crew_split_pct: 10,
  ceramic_detailer_split_pct: 10,
  /** Hakum default: commission windows around the 15th and month-end. */
  payout_frequency: 'semimonthly',
  payout_weekday: 5,
})

const COMP_KEYS = [
  'wash_pool_pct',
  'ceramic_shirt_deduction_minor',
  'ceramic_card_fee_pct',
  'ceramic_crew_solo_pct',
  'ceramic_crew_split_pct',
  'ceramic_detailer_split_pct',
]

/** Map a compensation_settings row (scalar columns, or legacy rules json) to engine input. */
export function normalizeCompensationSettings(row) {
  const src = row && typeof row.rules === 'object' && row.rules ? { ...row, ...row.rules } : row || {}
  const out = { ...DEFAULT_COMPENSATION_RULES }
  for (const key of COMP_KEYS) {
    const n = Number(src[key])
    if (Number.isFinite(n)) out[key] = n
  }
  const freq = String(src.payout_frequency || out.payout_frequency).toLowerCase()
  out.payout_frequency = PAYOUT_FREQUENCIES.includes(freq) ? freq : DEFAULT_COMPENSATION_RULES.payout_frequency
  const weekday = Number(src.payout_weekday)
  out.payout_weekday = Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 5
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
    payout_frequency: n.payout_frequency,
    payout_weekday: n.payout_weekday,
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

export function detailingAmountMinor(lines = []) {
  return (lines || []).reduce((sum, line) => {
    const cat = String(line?.pay_category || line?.services?.pay_category || '').toLowerCase()
    if (cat !== 'detailing') return sum
    const qty = Number(line.quantity) || 1
    const unit = Number(line.line_total_minor) || Number(line.unit_price_minor) * qty || Number(line.price_minor) * qty || 0
    return sum + unit
  }, 0)
}

export function effectiveCeramicToggles(toggles = {}, paymentMethod) {
  const method = String(paymentMethod || '').toLowerCase()
  const card = method === 'card' || method === 'credit'
  return {
    freeShirt: Boolean(toggles.freeShirt),
    cardPayment: Boolean(toggles.cardPayment) || card,
    crewAssisted: toggles.crewAssisted !== false,
    detailerAssigned: Boolean(toggles.detailerAssigned),
  }
}

export function ceramicExpenseKey(saleId, kind) {
  return `ceramic:${saleId}:${kind}`
}

export function buildCeramicCompensationExpenses({
  saleId,
  date,
  branch,
  salesMinor = 0,
  rules,
  toggles = {},
  paymentMethod,
} = {}) {
  if (!saleId || !branch || branch === 'all') return []
  const amount = Math.round(Number(salesMinor) || 0)
  if (amount <= 0) return []
  const pay = computeCeramicPay({
    salesMinor: amount,
    rules,
    toggles: effectiveCeramicToggles(toggles, paymentMethod),
  })
  const rows = []
  if (pay.crew_minor > 0) {
    rows.push({
      title: `Ceramic crew share · ${branch}${date ? ` · ${date}` : ''}`,
      description: ceramicExpenseKey(saleId, 'crew'),
      total_minor: pay.crew_minor,
      unit_cost_minor: pay.crew_minor,
      quantity: 1,
      expense_kind: 'salary_carwash',
      branch,
      status: 'draft',
    })
  }
  if (pay.detailer_minor > 0) {
    rows.push({
      title: `Ceramic detailer share · ${branch}${date ? ` · ${date}` : ''}`,
      description: ceramicExpenseKey(saleId, 'detailer'),
      total_minor: pay.detailer_minor,
      unit_cost_minor: pay.detailer_minor,
      quantity: 1,
      expense_kind: 'salary_detailer',
      branch,
      status: 'draft',
    })
  }
  return rows
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

/** Group today's wash/package sales + present roster into per-branch pool drafts for Finance. */
export function washPoolAmountMinor(sale) {
  const lines = sale?.sale_line_items || sale?.lines || []
  if (lines.length) {
    return lines.reduce((sum, line) => {
      const cat = String(line?.pay_category || line?.services?.pay_category || '').toLowerCase()
      if (cat === 'detailing') return sum
      return sum + (Number(line.line_total_minor) || 0)
    }, 0)
  }
  const cat = String(sale?.pay_category || sale?.service_pay_category || '').toLowerCase()
  if (cat === 'detailing') return 0
  return Number(sale?.total_minor) || 0
}

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
    salesByBranch[branch] = (salesByBranch[branch] || 0) + washPoolAmountMinor(sale)
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
