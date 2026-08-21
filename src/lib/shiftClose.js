/** End-of-shift close: POS baseline vs BA override + validation. */

import { emptyBacoorDailyReport } from './bacoorDailyReport.js'

/** Money fields BA may override (minor units). */
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

export const SHIFT_CLOSE_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'accepted',
  'rejected',
  'locked',
])

export function moneySnapshotFromReport(report) {
  const src = report || emptyBacoorDailyReport()
  const out = {}
  for (const key of SHIFT_CLOSE_MONEY_KEYS) {
    const n = Number(src[key] ?? 0)
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
  const labels = new Map((fieldConfig || []).map((r) => [r.field_key, r.label]))
  const rows = []
  for (const key of SHIFT_CLOSE_MONEY_KEYS) {
    if (base[key] === sub[key]) continue
    rows.push({
      key,
      label: labels.get(key) || key,
      baseline_minor: base[key],
      submitted_minor: sub[key],
      delta_minor: sub[key] - base[key],
    })
  }
  return rows
}

export function canSubmitShiftClose(profile) {
  const role = profile?.role
  return role === 'BossMich' || role === 'admin'
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
