/** End-of-shift close: POS baseline vs BA override + validation. */

import { emptyBacoorDailyReport } from './bacoorDailyReport.js'

/**
 * Money keys (minor units). `square_sales_minor` is legacy storage for Total sales
 * (sum of paid POS sales). UI never says "Square".
 */
export const SHIFT_CLOSE_MONEY_KEYS = Object.freeze([
  'square_sales_minor',
  'downpayments_minor',
  'ca_collected_minor',
  'total_gcash_minor',
  'credit_card_minor',
  'total_expenses_minor',
  'total_cash_left_minor',
  'queue_app_sales_minor',
  'car_wash_sales_minor',
  'ceramic_coating_sales_minor',
  'paint_maintenance_sales_minor',
  'detailing_sales_minor',
  'ppf_sales_minor',
  'ceramic_tint_sales_minor',
  'refreshment_sales_minor',
  'car_accessories_minor',
  'hakum_clothing_minor',
  'carwash_salary_minor',
  'detailer_salary_minor',
  'tinter_salary_minor',
])

/** Friendly labels — never "Square sales". */
export const SHIFT_CLOSE_FIELD_LABELS = Object.freeze({
  square_sales_minor: 'Total sales',
  downpayments_minor: 'Downpayments',
  ca_collected_minor: 'CA repaid to drawer',
  total_gcash_minor: 'GCash',
  credit_card_minor: 'Credit card',
  total_expenses_minor: 'Total expenses',
  total_cash_left_minor: 'Cash left',
  queue_app_sales_minor: 'Queue / wash sales',
  car_wash_sales_minor: 'Car wash sales',
  ceramic_coating_sales_minor: 'Coating sales',
  paint_maintenance_sales_minor: 'Paint maintenance',
  detailing_sales_minor: 'Other detailing',
  ppf_sales_minor: 'PPF',
  ceramic_tint_sales_minor: 'Tint sales',
  refreshment_sales_minor: 'Coffee / refreshments',
  car_accessories_minor: 'Accessories',
  hakum_clothing_minor: 'Hakum clothing',
  carwash_salary_minor: 'Carwash salary',
  detailer_salary_minor: 'Detailer salary',
  tinter_salary_minor: 'Tinter salary',
})

export function shiftCloseFieldLabel(key, fieldConfig = []) {
  const cfg = (fieldConfig || []).find((f) => f.field_key === key)
  if (cfg?.label && !/square/i.test(cfg.label)) return cfg.label
  return SHIFT_CLOSE_FIELD_LABELS[key] || key.replace(/_minor$/, '').replaceAll('_', ' ')
}

export function moneySnapshotFromReport(report) {
  const src = report || emptyBacoorDailyReport()
  const out = {}
  for (const key of SHIFT_CLOSE_MONEY_KEYS) {
    let n = Number(src[key])
    // Alias: total_sales_minor → square_sales_minor (paid POS sum)
    if (key === 'square_sales_minor' && !Number.isFinite(n)) {
      n = Number(src.total_sales_minor ?? 0)
    }
    out[key] = Number.isFinite(n) ? Math.round(n) : 0
  }
  return out
}

/** Parse pesos string/number → minor units; null if invalid. */
export function parsePesosToMinor(raw) {
  if (raw === '' || raw == null) return null
  const s = String(raw).trim().replace(/,/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null
  const pesos = Number(s)
  if (!Number.isFinite(pesos) || pesos < 0) return null
  return Math.round(pesos * 100)
}

export function shiftCloseDiffRows(baseline, submitted, fieldConfig) {
  const base = moneySnapshotFromReport(baseline)
  const sub = moneySnapshotFromReport(submitted)
  const rows = []
  for (const key of SHIFT_CLOSE_MONEY_KEYS) {
    if (base[key] === sub[key]) continue
    rows.push({
      key,
      label: shiftCloseFieldLabel(key, fieldConfig),
      baseline_minor: base[key],
      submitted_minor: sub[key],
      delta_minor: sub[key] - base[key],
    })
  }
  return rows
}

/** Parse datetime-local → ISO string for RPC; null if invalid. */
export function datetimeLocalToIso(local) {
  const s = String(local || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * BA salary draft extras for EoS (stored on shift_close_reports.submitted.salary_draft_extras).
 * Never posts payroll — SA/ASA apply on the floor wizard.
 */
export function normalizeSalaryDraftExtras(raw) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  for (const row of list) {
    const kind = row?.kind === 'deduction' ? 'deduction' : row?.kind === 'extra' ? 'extra' : null
    const amount_minor = Math.round(Number(row?.amount_minor) || 0)
    const staff_name = String(row?.staff_name || '').trim()
    if (!kind || amount_minor <= 0 || !staff_name) continue
    const staff_id = String(row?.staff_id || '').trim() || null
    const note = String(row?.note || '').trim()
    out.push({ staff_id, staff_name, amount_minor, note, kind })
  }
  return out
}
