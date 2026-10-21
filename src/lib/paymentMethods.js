/** Shared POS + floor payment method labels (PH bay checkout). */

import { classifySaleBucket } from './posSellables.js'

const DETAILING_POS_BUCKETS = new Set(['ceramic_coating', 'nano_tint', 'ppf'])

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Credit Cards' },
  { value: 'debit', label: 'Debit card' },
  { value: 'bank', label: 'Bank transfer' },
]

/** @deprecated alias — prefer PAYMENT_METHODS */
export const PAYMENT_OPTIONS = PAYMENT_METHODS

/**
 * Canonical payment buckets. One vocabulary for the whole app.
 *
 * BUG-081: this file, dailySheet.js and salesSummary.js each carried a private
 * map, and they disagreed — 'bank' was card here, bank there, other in the
 * third. The Daily Sheet's was the one that cost money: its fallback was cash,
 * and cash feeds the drawer reconciliation.
 *
 * `other` exists so an unrecognised method has somewhere to go that is NOT
 * cash. Cash is the only bucket that implies a note in the drawer, so a
 * fallback into it invents money the shop never took.
 *
 * A MISSING method still resolves to cash: posSale.js defaults it, the shop is
 * cash-first, and some money demonstrably came in. That is a different
 * question from a method that was recorded and is not recognised.
 */
export const PAYMENT_BUCKETS = Object.freeze(['cash', 'gcash', 'card', 'debit', 'bank', 'other'])

const ALIASES = Object.freeze({
  cash: 'cash',
  gcash: 'gcash',
  'g-cash': 'gcash',
  card: 'card',
  credit: 'card',
  credit_card: 'card',
  debit: 'debit',
  debit_card: 'debit',
  credit_debit: 'card',
  'credit/debit': 'card',
  // Legacy bank transfer / "online" settlement. Not a drawer method and not a
  // card terminal — it clears to an account.
  online: 'bank',
  bank: 'bank',
  transfer: 'bank',
})

/**
 * Classify a stored sale.payment_method. Pure: absent, blank and unrecognised
 * are all "we do not know", which is `other`.
 *
 * The drawer deliberately does NOT use this directly — see drawerPaymentBucket.
 */
export function paymentBucket(raw) {
  if (raw == null || String(raw).trim() === '') return 'other'
  return ALIASES[String(raw).trim().toLowerCase()] || 'other'
}

/**
 * The drawer's question is "is there a note in the till?", which is not the
 * same as "which bucket does this belong in on a report".
 *
 * A sale with NO recorded method still took money, posSale.js defaults it to
 * cash, and this shop is cash-first — so an absent method is treated as cash
 * here. An unrecognised-but-present method ('wallet', 'cheque') is NOT: it
 * resolves through paymentBucket to `other` and never inflates the drawer.
 */
export function drawerPaymentBucket(raw) {
  if (raw == null || String(raw).trim() === '') return 'cash'
  return paymentBucket(raw)
}

/**
 * How one paid ticket lands in the payment rows.
 * A split ticket is cash + GCash only. The ticket total is still one sale;
 * each portion is what that channel took. Any other method takes the whole ticket.
 */
export function saleTenderPortions(sale = {}) {
  const total = Math.round(Number(sale.total_minor) || 0)
  const safe = Number.isFinite(total) ? total : 0
  const method = String(sale.payment_method || '').trim().toLowerCase()
  const empty = { cash: 0, gcash: 0, card: 0, debit: 0, bank: 0, other: 0 }
  if (method === 'split') {
    const cash = Math.max(0, Math.round(Number(sale.cash_minor) || 0))
    const gcash = Math.max(0, Math.round(Number(sale.gcash_minor) || 0))
    empty.cash = cash
    empty.gcash = gcash
    empty.other = Math.max(0, safe - cash - gcash)
    return empty
  }
  empty[drawerPaymentBucket(sale.payment_method)] = safe
  return empty
}

/**
 * Normalize stored sale.payment_method into cash | gcash | card.
 *
 * Historical 3-bucket projection, kept because floor financials report exactly
 * these three. `bank` and `other` are both "settled somewhere that is not the
 * drawer" and project to `card` here; neither may ever project to cash.
 * An absent method projects to cash, matching the POS default.
 */
export function normalizePaymentMethod(raw) {
  if (raw == null || String(raw).trim() === '') return 'cash'
  const bucket = paymentBucket(raw)
  if (bucket === 'cash') return 'cash'
  if (bucket === 'gcash') return 'gcash'
  // Debit stays off the drawer; the 3-bucket floor report still groups it with card.
  return 'card'
}

export function paymentMethodLabel(raw) {
  const bucket = paymentBucket(raw)
  if (bucket === 'cash') return 'Cash'
  if (bucket === 'gcash') return 'GCash'
  if (bucket === 'card') return 'Credit card'
  if (bucket === 'debit') return 'Debit card'
  if (bucket === 'bank') return 'Bank transfer'
  return 'Other'
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
    debit_sales_minor: 0,
    bank_sales_minor: 0,
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
    const portions = saleTenderPortions(row)
    out.cash_sales_minor += portions.cash
    out.gcash_sales_minor += portions.gcash
    out.card_sales_minor += portions.card
    out.debit_sales_minor += portions.debit
    out.bank_sales_minor += portions.bank
  }
  return out
}
