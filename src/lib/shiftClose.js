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
  ca_collected_minor: 'CA collected',
  total_gcash_minor: 'GCash',
  credit_card_minor: 'Credit card',
  total_expenses_minor: 'Total expenses',
  total_cash_left_minor: 'Cash left',
  queue_app_sales_minor: 'Queue / wash sales',
  car_wash_sales_minor: 'Car wash sales',
  ceramic_coating_sales_minor: 'Ceramic coating',
  ppf_sales_minor: 'PPF',
  ceramic_tint_sales_minor: 'Ceramic tint',
  refreshment_sales_minor: 'Coffee / refreshments',
  car_accessories_minor: 'Accessories',
  hakum_clothing_minor: 'Hakum clothing',
  carwash_salary_minor: 'Carwash salary',
  detailer_salary_minor: 'Detailer salary',
  tinter_salary_minor: 'Tinter salary',
})

/** Auto from paid POS / expenses. Still overridable with a reason. */
export const SHIFT_CLOSE_COMPUTED_KEYS = Object.freeze([
  'square_sales_minor',
  'total_gcash_minor',
  'credit_card_minor',
  'total_expenses_minor',
  'total_cash_left_minor',
  'queue_app_sales_minor',
  'car_wash_sales_minor',
  'ceramic_coating_sales_minor',
  'ppf_sales_minor',
  'ceramic_tint_sales_minor',
  'refreshment_sales_minor',
  'car_accessories_minor',
  'hakum_clothing_minor',
  'carwash_salary_minor',
  'detailer_salary_minor',
  'tinter_salary_minor',
])

/** Usually typed by BA (baseline 0). */
export const SHIFT_CLOSE_MANUAL_KEYS = Object.freeze(['downpayments_minor', 'ca_collected_minor'])

export const SHIFT_CLOSE_WIZARD_STEPS = Object.freeze([
  { id: 'when', label: 'When', hint: 'What time did this shift end?' },
  { id: 'money', label: 'Money in', hint: 'Total sales, GCash, card, cash left' },
  { id: 'detail', label: 'Breakdown', hint: 'Services, merch, expenses' },
  { id: 'review', label: 'Review', hint: 'Confirm and submit' },
])

export const SHIFT_CLOSE_STEP_KEYS = Object.freeze({
  money: [
    'square_sales_minor',
    'total_gcash_minor',
    'credit_card_minor',
    'total_cash_left_minor',
    'downpayments_minor',
    'ca_collected_minor',
  ],
  detail: [
    'queue_app_sales_minor',
    'car_wash_sales_minor',
    'ceramic_coating_sales_minor',
    'ppf_sales_minor',
    'ceramic_tint_sales_minor',
    'refreshment_sales_minor',
    'car_accessories_minor',
    'hakum_clothing_minor',
    'total_expenses_minor',
    'carwash_salary_minor',
    'detailer_salary_minor',
    'tinter_salary_minor',
  ],
})

export const SHIFT_CLOSE_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'accepted',
  'rejected',
  'locked',
])

export function shiftCloseFieldLabel(key, fieldConfig = []) {
  const cfg = (fieldConfig || []).find((f) => f.field_key === key)
  if (cfg?.label && !/square/i.test(cfg.label)) return cfg.label
  return SHIFT_CLOSE_FIELD_LABELS[key] || key.replace(/_minor$/, '').replaceAll('_', ' ')
}

export function isShiftCloseComputedKey(key) {
  return SHIFT_CLOSE_COMPUTED_KEYS.includes(key)
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

export function minorToPesosInput(minor) {
  const n = Number(minor) || 0
  return (n / 100).toFixed(2)
}

/**
 * Validate submitted money vs baseline.
 * @returns {{ ok: boolean, errors: Record<string, string>, overrideReasons: Record<string, string> }}
 */
export function validateShiftCloseSubmit({ baseline, submitted, reasons, fieldConfig }) {
  const errors = {}
  const overrideReasons = {}
  const base = moneySnapshotFromReport(baseline)
  const sub = moneySnapshotFromReport(submitted)
  const cfgByKey = new Map((fieldConfig || []).map((r) => [r.field_key, r]))

  for (const key of SHIFT_CLOSE_MONEY_KEYS) {
    const cfg = cfgByKey.get(key)
    if (cfg && cfg.is_active === false) continue
    const allow = cfg ? cfg.allow_override !== false : true
    const b = base[key]
    const s = sub[key]
    if (!Number.isFinite(s) || s < 0) {
      errors[key] = 'Enter a valid amount (0 or more).'
      continue
    }
    if (s !== b) {
      if (!allow) {
        errors[key] = 'This field cannot be overridden.'
        continue
      }
      const reason = String(reasons?.[key] || '').trim()
      if (reason.length < 3) {
        errors[key] = 'Override needs a reason (at least 3 characters).'
        continue
      }
      overrideReasons[key] = reason
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, overrideReasons }
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

export function canSubmitShiftClose(profile) {
  const role = profile?.role
  if (role === 'BossMich' || role === 'admin') return true
  if (role === 'assistant_super_admin') {
    const g = profile?.permission_grants || {}
    if (Object.prototype.hasOwnProperty.call(g, 'pos') || Object.prototype.hasOwnProperty.call(g, 'finance_write')) {
      return Boolean(g.pos || g.finance_write)
    }
    return true
  }
  return false
}

/** datetime-local value from a Date (browser local). */
export function toDatetimeLocalValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return toDatetimeLocalValue(new Date())
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse datetime-local → ISO string for RPC; null if invalid. */
export function datetimeLocalToIso(local) {
  const s = String(local || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function canReviewShiftClose(profile) {
  if (profile?.role === 'BossMich') return true
  if (profile?.role === 'assistant_super_admin') {
    const g = profile?.permission_grants || {}
    if (Object.prototype.hasOwnProperty.call(g, 'finance_view')) return !!g.finance_view
    return true
  }
  return false
}
