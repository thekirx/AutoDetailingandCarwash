/** Customer auth helpers shared by login UI and tests. */

export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export function phoneLoginEmail(phone) {
  const digits = phoneDigits(phone)
  if (digits.length < 10) throw new Error('Enter a valid phone number.')
  return `c${digits}@customers.hakumautocare.com`
}

export function normalizePlate(value = '') {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Classify sign-in identifier: email, PH-ish phone, or plate.
 * Plates win when input has letters + digits and is not an email.
 */
export function classifyIdentifier(raw) {
  const value = String(raw || '').trim()
  if (!value) return 'empty'
  if (value.includes('@')) return 'email'
  const digits = phoneDigits(value)
  const plate = normalizePlate(value)
  const hasLetter = /[A-Za-z]/.test(value)
  // Phone: mostly digits, 10–13 length (09… or 63…)
  if (!hasLetter && digits.length >= 10 && digits.length <= 13) return 'phone'
  // Plate: alphanumeric after normalize, at least 3 chars
  if (plate.length >= 3 && /[A-Z]/.test(plate) && /\d/.test(plate)) return 'plate'
  // Ambiguous short digit-only — treat as incomplete phone
  if (!hasLetter && digits.length > 0) return 'phone'
  if (plate.length >= 3) return 'plate'
  return 'unknown'
}

/** Resolve Auth email for email/phone only (plate needs server lookup). */
export function resolveLoginEmail(raw) {
  const kind = classifyIdentifier(raw)
  if (kind === 'email') return String(raw).trim().toLowerCase()
  if (kind === 'phone') return phoneLoginEmail(raw)
  throw new Error('Use email or phone, or wait for plate lookup.')
}
