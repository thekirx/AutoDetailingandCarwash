/**
 * Refer a friend — detailing and up only, never carwash (Kirk, 2026-10-17).
 *
 * Every number and reward word lives in the referral_program_settings row and
 * reaches the UI through the API. REFERRAL_DEFAULTS is only the fallback used
 * before the row exists (and the mirror the tests pin), so a client change is a
 * settings edit, not a code change. Which services count is the per-service
 * flag services.referral_eligible; isReferralEligibleService is the same rule
 * for rows that predate the flag and for tests.
 */

export const REFERRAL_DEFAULTS = Object.freeze({
  enabled: false,
  reward_label: 'Detailing reward',
  reward_kind: 'amount_off',
  reward_value: 0,
  validity_days: 3,
  yearly_cap: 5,
  eligible_services: Object.freeze([
    'Interior Detailing',
    'Full Exterior Detailing',
    'Glass Detailing',
    'Full Care Package',
    'Hakum Custom Package',
    'Paint Maintenance',
    'Ceramic Coating',
    'Nano Ceramic Tint',
    'Paint Protection Film (PPF)',
  ]),
  excluded_services: Object.freeze(['Carwash', 'Express Wash Package', 'Engine Wash']),
})

/** Same slugs the migration backfills to referral_eligible = true. */
export const REFERRAL_ELIGIBLE_SLUGS = Object.freeze([
  'interior-detailing',
  'full-exterior-detailing',
  'mobile-detailing',
  'glass-detailing',
  'full-care-package',
  'hakum-custom-package',
])

/** The flag wins when the row has it; otherwise the backfill rule. */
export function isReferralEligibleService(service = {}) {
  if (typeof service?.referral_eligible === 'boolean') return service.referral_eligible
  const slug = String(service?.slug || '').toLowerCase()
  const cat = String(service?.pay_category || '').toLowerCase()
  if (cat === 'detailing') return true
  if (slug.startsWith('ppf')) return true
  return REFERRAL_ELIGIBLE_SLUGS.includes(slug)
}

/** Settings from the API merged over the defaults; unknown keys dropped, numbers sane. */
export function normalizeReferralSettings(raw = {}) {
  const r = raw || {}
  const num = (v, fallback, min = 0) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback
  }
  const list = (v, fallback) => (Array.isArray(v) && v.length ? v.map(String) : fallback)
  return {
    enabled: r.enabled === true,
    reward_label: String(r.reward_label || '').trim() || REFERRAL_DEFAULTS.reward_label,
    reward_kind: r.reward_kind === 'percent_off' ? 'percent_off' : 'amount_off',
    reward_value: num(r.reward_value, REFERRAL_DEFAULTS.reward_value),
    validity_days: num(r.validity_days, REFERRAL_DEFAULTS.validity_days, 1),
    yearly_cap: num(r.yearly_cap, REFERRAL_DEFAULTS.yearly_cap, 1),
    eligible_services: list(r.eligible_services, [...REFERRAL_DEFAULTS.eligible_services]),
    excluded_services: list(r.excluded_services, [...REFERRAL_DEFAULTS.excluded_services]),
  }
}

export function validityPhrase(days) {
  const n = Number(days) || REFERRAL_DEFAULTS.validity_days
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** Codes look like ANA-7Q2: first name (letters only, max 8) + 3 unambiguous characters. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
  return /^[A-Z]{1,8}-[A-HJ-NP-Z2-9]{3}$/.test(code) ? code : ''
}

export function makeReferralCode(firstName, random = Math.random) {
  const stem = String(firstName || '')
    .trim()
    .split(/\s+/)[0]
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'HAKUM'
  let tail = ''
  for (let i = 0; i < 3; i++) tail += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length]
  return `${stem}-${tail}`
}

export const REFERRAL_SITE = 'https://hakumautocare.com'

export function referralLink(code, origin = REFERRAL_SITE) {
  const c = normalizeReferralCode(code)
  return c ? `${String(origin).replace(/\/$/, '')}/r/${c}` : ''
}

/** sessionStorage key carrying a code from /r/:code into sign-up. */
export const REFERRAL_CODE_STORAGE_KEY = 'hakum-referral-code'

export function rememberReferralCode(code, storage = globalThis.sessionStorage) {
  const c = normalizeReferralCode(code)
  if (!c) return ''
  try {
    storage?.setItem(REFERRAL_CODE_STORAGE_KEY, c)
  } catch {
    /* private mode: sign-up just goes ahead without the code */
  }
  return c
}

export function readReferralCode(storage = globalThis.sessionStorage) {
  try {
    return normalizeReferralCode(storage?.getItem(REFERRAL_CODE_STORAGE_KEY))
  } catch {
    return ''
  }
}

export function forgetReferralCode(storage = globalThis.sessionStorage) {
  try {
    storage?.removeItem(REFERRAL_CODE_STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}

/** Customer-facing status line for one referred friend. */
export function referralStatusLine(row = {}) {
  if (row.status === 'qualified') return 'Your reward is in Rewards'
  if (row.status === 'void') return 'This referral no longer counts'
  if (row.waiting_reason === 'carwash_only') return 'Carwash doesn’t count — still waiting for detailing'
  return 'Reward unlocks after their first detailing service'
}
