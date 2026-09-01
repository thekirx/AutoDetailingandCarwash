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
  attendance_present_weight: 1,
  attendance_late_weight: 0.7,
  pending_floor_optional: false,
  cash_advance_auto_deduct: false,
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
  const presentW = Number(src.attendance_present_weight)
  if (Number.isFinite(presentW) && presentW >= 0) out.attendance_present_weight = presentW
  const lateW = Number(src.attendance_late_weight)
  if (Number.isFinite(lateW) && lateW >= 0) out.attendance_late_weight = lateW
  if (typeof src.pending_floor_optional === 'boolean') out.pending_floor_optional = src.pending_floor_optional
  // Contract: CA deduct is manual in payroll wizard only — never honor auto-deduct.
  out.cash_advance_auto_deduct = false
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
    attendance_present_weight: n.attendance_present_weight,
    attendance_late_weight: n.attendance_late_weight,
    pending_floor_optional: n.pending_floor_optional,
    cash_advance_auto_deduct: false,
  }
}

/** HH:MM or ISO timestamp → minutes from midnight (Asia/Manila for ISO). Null if unparseable. */
export function hhmmToMinutes(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  // Plain wall-clock HH:MM (shift windows, demo clocks) — use as written.
  if (!raw.includes('T')) {
    const hm = /^(\d{1,2}):(\d{2})/.exec(raw)
    if (!hm) return null
    return Number(hm[1]) * 60 + Number(hm[2])
  }
  // Live attendance stores UTC ISO via toISOString(); never take the UTC digits literally.
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  const h = hour === 24 ? 0 : hour
  return h * 60 + minute
}

/** Default bay shift when branch hours are missing (Manila shop day). */
export const DEFAULT_BAY_SHIFT = Object.freeze({ shift_start: '08:00', shift_end: '16:00' })

/** Index branch_operating_hours rows as `${branch_slug}|${day_of_week}` → row. */
export function indexBranchOperatingHours(rows = []) {
  const out = Object.create(null)
  for (const h of rows || []) {
    if (h?.is_closed) continue
    const slug = h.branch_slug || h.branch
    const dow = Number(h.day_of_week)
    if (!slug || !Number.isFinite(dow)) continue
    out[`${slug}|${dow}`] = h
  }
  return out
}

/** Manila weekday 0–6 for a YYYY-MM-DD shop date. */
export function manilaDayOfWeek(ymd) {
  const day = String(ymd || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T12:00:00+08:00`).getUTCDay()
}

/** Look up opens/closes for one attendance row's branch×date. */
export function hoursForAttendanceDay(hoursIndex, branchSlug, attendanceDate) {
  const dow = manilaDayOfWeek(attendanceDate)
  if (dow == null || !branchSlug) return null
  return hoursIndex?.[`${branchSlug}|${dow}`] || null
}

/**
 * Map a staff_attendance DB row (+ optional hours) into a payroll roster clock shape.
 * Poka-yoke: always expose checked_in_at so remaining-shift late math can run.
 */
export function attendanceRowForPayroll(row = {}, hours = null) {
  const opens = hours?.opens_at || hours?.opensAt || DEFAULT_BAY_SHIFT.shift_start
  const closes = hours?.closes_at || hours?.closesAt || DEFAULT_BAY_SHIFT.shift_end
  return {
    id: row.staff_id || row.id,
    staff_id: row.staff_id || row.id,
    full_name: row.staff_profiles?.full_name || row.full_name || '',
    role: row.staff_profiles?.role || row.role || '',
    branch_slug: row.branch_slug || row.branch,
    attendance_date: row.attendance_date || row.date,
    status: row.status,
    attendance_status: row.status,
    checked_in_at: row.checked_in_at || row.checkedInAt || null,
    clock_in_at: row.clock_in_at || row.clockInAt || null,
    minutes_late: row.minutes_late ?? row.minutesLate ?? null,
    shift_start: opens,
    shift_end: closes,
  }
}

/**
 * Pay share for a roster row.
 * Absent / missing / off → 0 (no car, no pool).
 * With clock_in + shift window → remaining shift / scheduled (what they naabutan).
 * Else status: present = 1, late = 0.7.
 */
export function attendanceWeight(status, rules = {}, clock = {}) {
  const s = String(status || clock.attendance_status || clock.status || '').toLowerCase()
  if (!s || s === 'absent' || s === 'off' || s === 'leave' || s === 'no_show') return 0
  const present = Number(rules.attendance_present_weight)
  const presentW = Number.isFinite(present) && present >= 0 ? present : 1
  const start = hhmmToMinutes(clock.shift_start || clock.shiftStart)
  const end = hhmmToMinutes(clock.shift_end || clock.shiftEnd)
  // Live attendance stores checked_in_at (ISO); demos/tests may use clock_in_at HH:MM.
  const inn = hhmmToMinutes(
    clock.clock_in_at ||
      clock.clockInAt ||
      clock.clock_in ||
      clock.checked_in_at ||
      clock.checkedInAt,
  )
  const scheduledArg = Number(clock.scheduled_minutes || clock.scheduledMinutes)
  const lateMins = Number(clock.minutes_late || clock.minutesLate)
  let scheduledMins = Number.isFinite(scheduledArg) && scheduledArg > 0 ? scheduledArg : null
  if (scheduledMins == null && start != null && end != null) scheduledMins = Math.max(1, end - start)
  if (!scheduledMins) scheduledMins = 480
  if (Number.isFinite(lateMins) && lateMins >= 0) {
    return presentW * Math.min(1, Math.max(0, scheduledMins - lateMins) / scheduledMins)
  }
  if (inn != null && (start != null || end != null)) {
    const endMins = end != null ? end : start + scheduledMins
    return presentW * Math.min(1, Math.max(0, endMins - inn) / scheduledMins)
  }
  if (s === 'present') return presentW
  if (s === 'late') {
    const late = Number(rules.attendance_late_weight)
    return Number.isFinite(late) && late >= 0 ? late : 0.7
  }
  return 0
}

/** UI presets — late crew still earn; this is their share vs on-time (stored as 0–1 weight). */
export const LATE_PAY_SHARE_PRESETS = Object.freeze([
  { id: 'full', label: 'No penalty', percent: 100, hint: 'Late gets same share as on time' },
  { id: 'standard', label: 'Standard', percent: 70, hint: 'Hakum default' },
  { id: 'half', label: 'Half share', percent: 50, hint: 'Late gets half of on-time pay' },
  { id: 'none', label: 'No pay if late', percent: 0, hint: 'Only on-time crew split the pool' },
])

export function latePaySharePercent(rules = {}) {
  const w = Number(normalizeCompensationSettings(rules).attendance_late_weight)
  const pct = Math.round((Number.isFinite(w) ? w : 0.7) * 100)
  return Math.max(0, Math.min(100, pct))
}

export function latePayWeightFromPercent(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  return p / 100
}

/** ponytail: demo only — illustrates splitWashPool weight math for Settings copy. */
export function demoWashPoolSplit({
  poolMinor = 1_000_000,
  onTimeCount = 2,
  lateCount = 1,
  lateWeight = 0.7,
} = {}) {
  const onTime = Math.max(0, Number(onTimeCount) || 0)
  const late = Math.max(0, Number(lateCount) || 0)
  const lw = Number.isFinite(Number(lateWeight)) ? Number(lateWeight) : 0.7
  const weightSum = onTime + late * lw
  if (!weightSum || !poolMinor) {
    return { perOnTimeMinor: 0, perLateMinor: 0, weightSum, poolMinor: poolMinor || 0 }
  }
  const unit = poolMinor / weightSum
  return {
    perOnTimeMinor: Math.round(unit),
    perLateMinor: Math.round(unit * lw),
    weightSum,
    poolMinor,
  }
}

/** Wash pool is bay crew only — not detailers, TL, office, or sales. */
function inWashPoolRoster(row) {
  const role = String(row?.role || 'staff').toLowerCase()
  return !['detailer', 'team_lead', 'admin', 'super_admin', 'investor', 'sales', 'marketing'].includes(role)
}

/** Split an amount across roster by attendance weight. Wash pool excludes non-bay roles. */
export function splitWashPool({
  totalSalesMinor = 0,
  poolPct = 35,
  roster = [],
  rules = {},
  forWashPool = true,
} = {}) {
  const pool = Math.round((Number(totalSalesMinor) || 0) * (Number(poolPct) || 0) / 100)
  const eligible = forWashPool ? (roster || []).filter((row) => inWashPoolRoster(row)) : roster || []
  const weighted = eligible
    .map((row) => ({
      ...row,
      weight: attendanceWeight(row.attendance_status || row.status, rules, row),
    }))
    .filter((row) => row.weight > 0)
  const weightSum = weighted.reduce((sum, row) => sum + row.weight, 0)
  if (!pool || !weightSum) {
    return { pool_minor: pool, rows: weighted.map((row) => ({ ...row, pay_minor: 0 })) }
  }
  let allocated = 0
  const rows = weighted.map((row, i) => {
    const pay =
      i === weighted.length - 1 ? pool - allocated : Math.round((pool * row.weight) / weightSum)
    allocated += pay
    return { ...row, pay_minor: pay }
  })
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
    if (!isCeramicCompensationLine(line)) return sum
    const qty = Number(line.quantity) || 1
    const unit =
      Number(line.line_total_minor) ||
      Number(line.unit_price_minor) * qty ||
      Number(line.price_minor) * qty ||
      0
    return sum + unit
  }, 0)
}

/**
 * Lines that feed detailing crew/detailer drafts (coating / paint maint / tint / detailing).
 * Excludes PPF film packages — those are not detailing split jobs.
 */
export function isCeramicCompensationLine(line = {}) {
  const cat = String(line?.pay_category || line?.services?.pay_category || '').toLowerCase()
  if (cat === 'ppf') return false
  if (cat === 'detailing') return true
  if (String(line?.catalog_kind || '').toLowerCase() === 'detailing') {
    const slug = String(line?.slug || line?.services?.slug || '').toLowerCase()
    const name = String(line?.name || '').toLowerCase()
    if (slug.includes('ppf') || name.includes('ppf')) return false
    return true
  }
  const slug = String(line?.slug || line?.services?.slug || '').toLowerCase()
  if (
    slug.includes('ceramic-coating') ||
    slug.includes('paint-maintenance') ||
    slug.includes('nano-ceramic') ||
    slug.includes('detailing')
  ) {
    return true
  }
  const name = String(line?.name || '').toLowerCase()
  if (
    name.includes('ceramic coating') ||
    name.includes('nano ceramic') ||
    name.includes('paint maintenance') ||
    name.includes('detailing')
  ) {
    return true
  }
  return false
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

/** Canonical expense key for detailing compensation drafts (legacy ceramic: still accepted). */
export function detailingExpenseKey(saleId, kind) {
  return `detailing:${saleId}:${kind}`
}

/** @deprecated use detailingExpenseKey — kept for callers; writes detailing: prefix */
export function ceramicExpenseKey(saleId, kind) {
  return detailingExpenseKey(saleId, kind)
}

export function parseDetailingCompKey(description) {
  const m = /^(?:ceramic|detailing):([^:]+):(crew|detailer)$/i.exec(String(description || '').trim())
  if (!m) return null
  return { saleId: m[1], side: m[2].toLowerCase() }
}

export function isDetailingCompExpenseDescription(description) {
  return /^(?:ceramic|detailing):/i.test(String(description || '').trim())
}

export function buildCeramicCompensationExpenses({
  saleId,
  date,
  branch,
  salesMinor = 0,
  rules,
  toggles = {},
  paymentMethod,
  assignedDetailerId = null,
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
      title: `Detailing crew share · ${branch}${date ? ` · ${date}` : ''}`,
      description: detailingExpenseKey(saleId, 'crew'),
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
      title: `Detailing detailer share · ${branch}${date ? ` · ${date}` : ''}`,
      description: detailingExpenseKey(saleId, 'detailer'),
      total_minor: pay.detailer_minor,
      unit_cost_minor: pay.detailer_minor,
      quantity: 1,
      expense_kind: 'salary_detailer',
      branch,
      status: 'draft',
      staff_id: assignedDetailerId || null,
      assigned_staff_id: assignedDetailerId || null,
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

function lineSalaryPct(line) {
  const raw = line?.salary_pct ?? line?.services?.salary_pct
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

function isWashEligibleLine(line) {
  const cat = String(line?.pay_category || line?.services?.pay_category || '').toLowerCase()
  const kind = String(line?.catalog_kind || '').toLowerCase()
  if (cat === 'detailing' || kind === 'detailing') return false
  if (isCeramicCompensationLine(line)) return false
  return true
}

/**
 * Catalog salary_pct lines contribute directly to preview pool (pct of line total).
 * Null salary_pct → stay in global wash base (washPoolAmountMinor × wash_pool_pct).
 */
export function salaryPctPoolMinor(sale) {
  const lines = sale?.sale_line_items || sale?.lines || []
  return (lines || []).reduce((sum, line) => {
    if (!isWashEligibleLine(line)) return sum
    const pct = lineSalaryPct(line)
    if (pct == null) return sum
    return sum + Math.round((Number(line.line_total_minor) || 0) * pct / 100)
  }, 0)
}

/** Group today's wash/package sales + present roster into per-branch pool drafts for Finance. */
export function washPoolAmountMinor(sale) {
  const lines = sale?.sale_line_items || sale?.lines || []
  if (lines.length) {
    return lines.reduce((sum, line) => {
      if (!isWashEligibleLine(line)) return sum
      // Preview-only: optional catalog % replaces global pool for this SKU.
      if (lineSalaryPct(line) != null) return sum
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
    if (attendanceWeight(status, {}, member) <= 0) continue
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
