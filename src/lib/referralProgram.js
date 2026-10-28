/** Saved friend-referral offer. The booking trigger reads the same app_settings row. */

export const DEFAULT_FRIEND_POINTS = 50
export const DEFAULT_DISCOUNT_RATE = 0.05

function presentNumber(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Blank or unreadable input uses the same defaults as referral_program_settings(). Explicit 0 stays 0. */
export function normalizeReferralProgram(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const points = presentNumber(source.friend_points)
  const rate = presentNumber(source.discount_rate)
  const percent = presentNumber(source.discount_percent)
  const discountRate = rate != null ? rate : percent != null ? percent / 100 : DEFAULT_DISCOUNT_RATE
  return {
    friend_points: points == null ? DEFAULT_FRIEND_POINTS : Math.min(100000, Math.max(0, Math.floor(points))),
    discount_rate: Math.min(1, Math.max(0, discountRate)),
  }
}

export function formatDiscountPercent(rate) {
  const pct = Math.round(Number(rate) * 1000) / 10
  if (!Number.isFinite(pct)) return '5%'
  return `${Number.isInteger(pct) ? pct : pct}%`
}

export function referralOfferCopy(program) {
  const offer = normalizeReferralProgram(program)
  return `When a friend uses this code on a detailing booking, you get ${formatDiscountPercent(offer.discount_rate)} off your next detailing booking. They get ${offer.friend_points} points.`
}
