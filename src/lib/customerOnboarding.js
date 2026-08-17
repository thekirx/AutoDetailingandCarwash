/**
 * First-account wizard: steps, field validation, Team Lead prefill merge.
 * Interface is the test surface — signup UI and /api/customer-signup both call this.
 */
import { canonicalPhMobile, phoneDigits, plateValidationError } from './customerAuth.js'
import { parseDateOnly } from './birthdayPerk.js'

export const ONBOARDING_STEPS = [
  { id: 'phone', label: 'Phone', hint: 'We use this to sign you in' },
  { id: 'profile', label: 'You & car', hint: 'Name and plate' },
  { id: 'birthday', label: 'Birthday', hint: 'Free carwash on your day' },
  { id: 'security', label: 'Password', hint: 'Lock the account' },
]

export const SYNTHETIC_EMAIL_HOST = '@customers.hakumautocare.com'

export function emptyOnboardingDraft() {
  return {
    phone: '',
    full_name: '',
    plate: '',
    date_of_birth: '',
    email: '',
    password: '',
    confirm: '',
    accepted_terms: false,
    source: 'new',
  }
}

export function isSyntheticCustomerEmail(email) {
  return String(email || '').toLowerCase().endsWith(SYNTHETIC_EMAIL_HOST)
}

export function looksLikeEmail(value) {
  const email = String(value || '').trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.includes(' ')
}

export function normalizeOnboardingPhone(phone) {
  return canonicalPhMobile(phone)
}

function todayYmd(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Field-level errors. Empty string = valid. */
export function validateOnboardingField(key, value, draft = {}) {
  const raw = value == null ? '' : value
  switch (key) {
    case 'phone': {
      const digits = phoneDigits(raw)
      if (!digits) return 'Enter your mobile number.'
      if (digits.length < 10 || digits.length > 13) return 'Use a PH mobile like 09XXXXXXXXX.'
      return ''
    }
    case 'full_name': {
      const name = String(raw).trim().replace(/\s+/g, ' ')
      if (name.length < 2) return 'Enter your full name.'
      if (!/[A-Za-zÀ-ÿ]/.test(name)) return 'Name needs letters.'
      return ''
    }
    case 'plate': {
      return plateValidationError(raw) || ''
    }
    case 'date_of_birth': {
      const parsed = parseDateOnly(raw)
      if (!parsed) return 'Pick your birthday.'
      const iso = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`
      if (iso > todayYmd()) return 'Birthday cannot be in the future.'
      if (parsed.year < 1920) return 'Check the birthday year.'
      const age = new Date().getFullYear() - parsed.year
      if (age > 120) return 'Check the birthday year.'
      return ''
    }
    case 'email': {
      const email = String(raw).trim()
      if (!email) return ''
      if (!looksLikeEmail(email)) return 'That email does not look right.'
      if (isSyntheticCustomerEmail(email)) return 'Use your own email, or leave this blank.'
      return ''
    }
    case 'password': {
      if (String(raw).length < 8) return 'Use at least 8 characters.'
      return ''
    }
    case 'confirm': {
      if (!String(raw)) return 'Confirm your password.'
      if (String(raw) !== String(draft.password || '')) return 'Passwords do not match.'
      return ''
    }
    case 'accepted_terms':
      return raw === true ? '' : 'Accept the Terms and Privacy Policy to continue.'
    default:
      return ''
  }
}

const STEP_FIELDS = {
  phone: ['phone'],
  profile: ['full_name', 'plate'],
  birthday: ['date_of_birth'],
  security: ['password', 'confirm', 'email', 'accepted_terms'],
}

export function validateOnboardingStep(stepId, draft) {
  const fields = STEP_FIELDS[stepId] || []
  const errors = {}
  for (const key of fields) {
    const message = validateOnboardingField(key, draft[key], draft)
    if (message) errors[key] = message
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export function validateOnboardingDraft(draft) {
  const errors = {}
  for (const key of ['phone', 'full_name', 'plate', 'date_of_birth', 'email', 'password', 'confirm', 'accepted_terms']) {
    const message = validateOnboardingField(key, draft?.[key], draft)
    if (message) errors[key] = message
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * Merge Team Lead / queue fields into the wizard.
 * Never overwrite a value the customer already typed.
 */
export function mergeTeamLeadPrefill(draft, prefill) {
  const next = { ...draft, source: 'team_lead' }
  const take = (key, value) => {
    if (String(draft[key] || '').trim()) return
    if (value == null || String(value).trim() === '') return
    next[key] = String(value).trim()
  }
  take('full_name', prefill?.full_name)
  take('plate', prefill?.plate)
  take('phone', prefill?.phone)
  take('date_of_birth', prefill?.date_of_birth)
  const email = String(prefill?.email || '').trim()
  if (email && !isSyntheticCustomerEmail(email)) take('email', email)
  return next
}

export function publicOnboardingPrefill(prefill) {
  if (!prefill) return null
  const email = String(prefill.email || '').trim()
  return {
    full_name: String(prefill.full_name || '').trim(),
    plate: String(prefill.plate || '').trim(),
    phone: String(prefill.phone || '').trim(),
    date_of_birth: String(prefill.date_of_birth || '').slice(0, 10),
    email: email && !isSyntheticCustomerEmail(email) ? email : '',
  }
}
