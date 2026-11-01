/** Promo voucher codes — SA board, Team Lead apply, POS consume. */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const PROMO_APPLIES_TO = Object.freeze(['any', 'wash', 'detailing', 'service'])
export const PROMO_DISCOUNT_KINDS = Object.freeze(['percent', 'fixed', 'free'])

export function mintPromoCode(random = Math.random) {
  let code = 'VK'
  for (let i = 0; i < 4; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}

export function normalizePromoCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
}

export function promoCodeShapeError(value) {
  const code = normalizePromoCode(value)
  if (code.length >= 4 && code.length <= 16) return null
  return 'Type a voucher code of 4 to 16 letters or numbers.'
}

export function promoVoucherRemaining(voucher) {
  const max = Math.max(0, Math.floor(Number(voucher?.max_uses) || 0))
  const used = Math.max(0, Math.floor(Number(voucher?.uses_count) || 0))
  return Math.max(0, max - used)
}

/** Manila calendar YYYY-MM-DD → whether the code is still in its window. */
export function promoVoucherWindowError(voucher, todayKey) {
  if (!voucher || voucher.is_active === false) return 'That voucher is not active.'
  const today = String(todayKey || '').slice(0, 10)
  const start = voucher.starts_on ? String(voucher.starts_on).slice(0, 10) : ''
  const end = voucher.ends_on ? String(voucher.ends_on).slice(0, 10) : ''
  if (start && today && today < start) return 'That voucher is not open yet.'
  if (end && today && today > end) return 'That voucher has expired.'
  if (promoVoucherRemaining(voucher) <= 0) return 'That voucher has no uses left.'
  return null
}

export function promoDiscountedPriceMinor(priceMinor, voucher) {
  const price = Math.max(0, Math.floor(Number(priceMinor) || 0))
  if (!voucher) return price
  if (voucher.discount_kind === 'free') return 0
  if (voucher.discount_kind === 'fixed' || voucher.discount_kind === 'amount') {
    const off = Math.max(
      0,
      Math.floor(
        voucher.discount_amount_minor != null
          ? Number(voucher.discount_amount_minor)
          : (Number(voucher.discount_amount || 0) * 100)
      )
    )
    return Math.max(0, price - off)
  }
  const pct = Math.min(100, Math.max(0, Number(voucher.discount_percent) || 0))
  return Math.max(0, Math.round(price * (1 - pct / 100)))
}

export function promoAppliesToService(voucher, payCategory, serviceKind, serviceId = null, parentServiceId = null) {
  if (!voucher) return true
  const scope = String(voucher?.applies_to || 'any')
  if (scope === 'any' && !voucher.service_id) return true

  if (scope === 'service' || voucher.service_id) {
    if (!voucher.service_id) return true
    const sId = String(serviceId || serviceKind || '')
    const targetId = String(voucher.service_id)
    const pId = parentServiceId ? String(parentServiceId) : ''
    return sId === targetId || pId === targetId || String(serviceKind || '') === targetId
  }

  const kind = String(serviceKind || '')
  const cat = String(payCategory || '')
  if (scope === 'detailing') return kind === 'detailing' || cat === 'detailing'
  if (scope === 'wash') return kind !== 'detailing' && cat !== 'detailing'

  if (scope !== 'any') {
    const sId = String(serviceId || '')
    return scope === kind || scope === sId
  }
  return true
}

export function voucherScopeLabel(voucher, serviceName = '') {
  if (!voucher) return 'all services'
  const scope = String(voucher?.applies_to || 'any')
  if (scope === 'detailing') return 'detailing only'
  if (scope === 'wash') return 'wash and packages only'
  if (scope === 'service' || voucher?.service_id) {
    return serviceName ? `${serviceName} only` : 'a specific service only'
  }
  if (scope !== 'any') return `${scope} only`
  return 'all services'
}

export function customerVoucherRulesLine(voucher) {
  if (!voucher) return ''
  const left = promoVoucherRemaining(voucher)
  let kind = ''
  if (voucher.discount_kind === 'free') {
    kind = 'Free service'
  } else if (voucher.discount_kind === 'fixed' || voucher.discount_kind === 'amount') {
    const amtMinor = voucher.discount_amount_minor != null
      ? Number(voucher.discount_amount_minor)
      : (Number(voucher.discount_amount || 0) * 100)
    const pesos = Math.round(amtMinor / 100)
    kind = `₱${pesos.toLocaleString()} off`
  } else {
    kind = `${Math.round(Number(voucher.discount_percent) || 0)}% off`
  }
  const when = voucher.ends_on ? ` until ${String(voucher.ends_on).slice(0, 10)}` : ''
  return `${kind}. ${left} of ${voucher.max_uses} uses left${when}. Show the code to the Team Lead.`
}
