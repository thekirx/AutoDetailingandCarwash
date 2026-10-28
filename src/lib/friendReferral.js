/** Friend-code helpers. The live points and discount live in app_settings referral_program. */

export const FRIEND_REFERRAL_POINTS = 50
export const REFERRER_DISCOUNT_RATE = 0.05

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function referrerDiscountMinor(priceMinor, rate = REFERRER_DISCOUNT_RATE) {
  const price = Math.max(0, Math.round(Number(priceMinor) || 0))
  const off = Math.round(price * rate)
  return Math.max(0, price - off)
}

export function mintReferralCode(random = Math.random) {
  let out = 'HK'
  for (let i = 0; i < 6; i += 1) out += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return out
}
