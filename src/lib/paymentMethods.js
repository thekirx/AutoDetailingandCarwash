/** Shared POS + floor payment method labels (PH bay checkout). */

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Credit / Debit' },
]

/** @deprecated alias — prefer PAYMENT_METHODS */
export const PAYMENT_OPTIONS = PAYMENT_METHODS

/** Normalize stored sale.payment_method into cash | gcash | card. */
export function normalizePaymentMethod(raw) {
  const key = String(raw || 'cash').trim().toLowerCase()
  if (key === 'gcash' || key === 'g-cash') return 'gcash'
  if (key === 'card' || key === 'credit' || key === 'debit' || key === 'credit_debit' || key === 'credit/debit') {
    return 'card'
  }
  // Legacy "online" bank transfer → credit/debit bucket for floor financials
  if (key === 'online' || key === 'bank' || key === 'transfer') return 'card'
  if (key === 'cash') return 'cash'
  return 'cash'
}

export function paymentMethodLabel(raw) {
  const key = normalizePaymentMethod(raw)
  return PAYMENT_METHODS.find((m) => m.value === key)?.label || 'Cash'
}

/**
 * Aggregate paid sales rows for Super Admin floor financials.
 * Queue app = sale linked to a booking; POS walk-in = no booking (merch/coffee/counter).
 */
export function aggregateSalesFinancials(rows = []) {
  const out = {
    total_sales_minor: 0,
    queue_sales_minor: 0,
    pos_sales_minor: 0,
    cash_sales_minor: 0,
    gcash_sales_minor: 0,
    card_sales_minor: 0,
    paid_count: 0,
  }
  for (const row of rows) {
    if (String(row.status || 'paid') !== 'paid') continue
    const amount = Number(row.total_minor || 0)
    if (!Number.isFinite(amount) || amount < 0) continue
    out.total_sales_minor += amount
    out.paid_count += 1
    if (row.booking_id) out.queue_sales_minor += amount
    else out.pos_sales_minor += amount
    const method = normalizePaymentMethod(row.payment_method)
    if (method === 'gcash') out.gcash_sales_minor += amount
    else if (method === 'card') out.card_sales_minor += amount
    else out.cash_sales_minor += amount
  }
  return out
}
