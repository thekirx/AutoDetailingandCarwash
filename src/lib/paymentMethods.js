/** Shared POS + floor payment method labels (PH bay checkout). */

import { classifySaleBucket } from './posSellables.js'

const DETAILING_POS_BUCKETS = new Set(['ceramic_coating', 'nano_tint', 'ppf'])

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
 * ponytail: delegates to posSellables so floor board matches POS/Bacoor close.
 */
function saleRowToPosInput(row = {}) {
  const hasBooking = Boolean(row.booking_id)
  const hasProductSignal =
    row.item_type === 'product' ||
    (Array.isArray(row.product_tags) && row.product_tags.length > 0) ||
    Boolean(row.product_category || row.category)

  return {
    serviceSlug: row.services?.slug || row.bookings?.services?.slug,
    payCategory: row.pay_category || row.bookings?.services?.pay_category,
    itemType: row.item_type || (hasProductSignal || !hasBooking ? 'product' : 'service'),
    serviceName: row.service_name || row.bookings?.services?.name || row.services?.name,
    productTags: row.product_tags,
    productCategory: row.product_category || row.category,
    productName: row.product_name || row.name,
  }
}

function posBucketToFloor(bucket) {
  if (bucket === 'car_wash') return 'carwash'
  if (bucket === 'detailing' || DETAILING_POS_BUCKETS.has(bucket)) return 'detailing'
  if (bucket === 'coffee') return 'coffee'
  if (bucket === 'clothing') return 'clothing'
  return 'merch'
}

export function classifyFloorSaleBucket(row = {}) {
  return posBucketToFloor(classifySaleBucket(saleRowToPosInput(row)))
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
