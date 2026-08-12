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
