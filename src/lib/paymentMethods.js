/** Shared POS + floor payment method labels (PH bay checkout). */

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Credit Cards' },
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
 * Classify a paid sale into floor counter buckets.
 * Queue app = carwash booking only; detailing bookings + walk-in products → counter.
 */
export function classifyFloorSaleBucket(row = {}) {
  const payCat = String(row.pay_category || row.bookings?.services?.pay_category || '').toLowerCase()
  const serviceName = String(
    row.service_name || row.bookings?.services?.name || row.services?.name || '',
  ).toLowerCase()
  const tags = Array.isArray(row.product_tags) ? row.product_tags.map((t) => String(t).toLowerCase()) : []
  const category = String(row.product_category || row.category || '').toLowerCase()

  if (tags.some((t) => t.includes('cloth') || t === 'hakum' || t === 'apparel')) return 'clothing'
  if (category.includes('cloth') || serviceName.includes('clothing')) return 'clothing'
  if (tags.some((t) => t === 'coffee' || t === 'free_coffee') || category === 'coffee') return 'coffee'
  if (serviceName.includes('coffee') || serviceName.includes('refresh')) return 'coffee'
  if (
    tags.some((t) => ['accessories', 'scents', 'merch', 'sellable'].includes(t)) ||
    category === 'accessories' ||
    category === 'merch'
  ) {
    return 'merch'
  }
  if (payCat === 'detailing' || payCat === 'ppf' || serviceName.includes('ceramic') || serviceName.includes('ppf') || serviceName.includes('tint')) {
    return 'detailing'
  }
  if (row.booking_id && (payCat === 'wash' || payCat === 'package' || payCat === 'general' || payCat === 'addon' || !payCat)) {
    return 'carwash'
  }
  if (row.booking_id) return 'detailing'
  return 'merch'
}

/**
 * Aggregate paid sales rows for Super Admin floor financials.
 * Queue app = carwash only; Counter = detailing + coffee + merch + clothing.
 */
export function aggregateSalesFinancials(rows = []) {
  const out = {
    total_sales_minor: 0,
    queue_sales_minor: 0,
    pos_sales_minor: 0,
    detailing_sales_minor: 0,
    coffee_sales_minor: 0,
    merch_sales_minor: 0,
    clothing_sales_minor: 0,
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
    const bucket = classifyFloorSaleBucket(row)
    if (bucket === 'carwash') out.queue_sales_minor += amount
    else {
      out.pos_sales_minor += amount
      if (bucket === 'detailing') out.detailing_sales_minor += amount
      else if (bucket === 'coffee') out.coffee_sales_minor += amount
      else if (bucket === 'clothing') out.clothing_sales_minor += amount
      else out.merch_sales_minor += amount
    }
    const method = normalizePaymentMethod(row.payment_method)
    if (method === 'gcash') out.gcash_sales_minor += amount
    else if (method === 'card') out.card_sales_minor += amount
    else out.cash_sales_minor += amount
  }
  return out
}
