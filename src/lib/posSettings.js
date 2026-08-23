/** POS settings singleton defaults — payment methods + expense kinds for BA counter. */

import { PAYMENT_METHODS } from './paymentMethods.js'

export const DEFAULT_POS_EXPENSE_KINDS = Object.freeze([
  { value: 'daily', label: 'Daily expense' },
  { value: 'salary_carwash', label: 'Carwash salary' },
  { value: 'salary_detailer', label: 'Detailer salary' },
  { value: 'salary_tinter', label: 'Tinter salary' },
  { value: 'ca_repayment', label: 'CA repayment (crew paid back)' },
  { value: 'monthly', label: 'Monthly expense' },
  { value: 'other_branch', label: 'Other branch expense' },
  { value: 'other', label: 'Other' },
])

export function normalizePosSettings(row = {}) {
  const methods = Array.isArray(row.payment_methods) && row.payment_methods.length
    ? row.payment_methods
        .map((m) => {
          if (typeof m === 'string') {
            const hit = PAYMENT_METHODS.find((p) => p.value === m)
            return hit || { value: m, label: m }
          }
          if (m && typeof m === 'object' && m.value) {
            return { value: String(m.value), label: String(m.label || m.value) }
          }
          return null
        })
        .filter(Boolean)
    : PAYMENT_METHODS.map((m) => ({ ...m }))

  const kinds = Array.isArray(row.expense_kinds) && row.expense_kinds.length
    ? row.expense_kinds
        .map((k) => {
          if (typeof k === 'string') return { value: k, label: k }
          if (k && typeof k === 'object' && k.value) {
            return { value: String(k.value), label: String(k.label || k.value) }
          }
          return null
        })
        .filter(Boolean)
    : DEFAULT_POS_EXPENSE_KINDS.map((k) => ({ ...k }))

  return {
    id: 1,
    payment_methods: methods,
    expense_kinds: kinds,
  }
}

export function toPosSettingsRow(settings) {
  const n = normalizePosSettings(settings)
  return {
    id: 1,
    payment_methods: n.payment_methods,
    expense_kinds: n.expense_kinds,
    updated_at: new Date().toISOString(),
  }
}
