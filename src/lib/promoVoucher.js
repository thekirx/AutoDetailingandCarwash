/** Promo voucher codes — SA board, Team Lead apply, POS consume. */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const PROMO_APPLIES_TO = Object.freeze(['wash', 'detailing', 'any'])
export const PROMO_DISCOUNT_KINDS = Object.freeze(['percent', 'free'])

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
  const pct = Math.min(100, Math.max(0, Number(voucher.discount_percent) || 0))
  return Math.max(0, Math.round(price * (1 - pct / 100)))
}

export function promoAppliesToService(voucher, payCategory, serviceKind) {
  const scope = String(voucher?.applies_to || 'any')
  if (scope === 'any') return true
  const kind = String(serviceKind || '')
  const cat = String(payCategory || '')
  if (scope === 'detailing') return kind === 'detailing' || cat === 'detailing'
  if (scope === 'wash') return kind !== 'detailing' && cat !== 'detailing'
  return true
}

export function customerVoucherRulesLine(voucher) {
  if (!voucher) return ''
  const left = promoVoucherRemaining(voucher)
  const kind =
    voucher.discount_kind === 'free'
      ? 'Free service'
      : `${Math.round(Number(voucher.discount_percent) || 0)}% off`
  const when = voucher.ends_on ? ` until ${String(voucher.ends_on).slice(0, 10)}` : ''
  return `${kind}. ${left} of ${voucher.max_uses} uses left${when}. Show the code to the Team Lead.`
}
