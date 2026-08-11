/** Customer auth helpers shared by login UI and tests. */

export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '')
}

/** Canonical PH mobile: 09XXXXXXXXX when the number is +63 / 63 / 9XXXXXXXXX. */
export function canonicalPhMobile(phone) {
  const digits = phoneDigits(phone)
  if (digits.startsWith('63') && digits.length >= 12) return `0${digits.slice(2)}`
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`
  return digits
}

export function phoneLoginEmail(phone) {
  const digits = canonicalPhMobile(phone)
  if (digits.length < 10) throw new Error('Enter a valid phone number.')
  return `c${digits}@customers.hakumautocare.com`
}

/** Historical + typed forms so older TL-provisioned Auth emails still match. */
export function phoneLoginEmailAliases(phone) {
  const raw = phoneDigits(phone)
  const canon = canonicalPhMobile(phone)
  const emails = new Set()
  if (canon.length >= 10) emails.add(`c${canon}@customers.hakumautocare.com`)
  if (raw.length >= 10) emails.add(`c${raw}@customers.hakumautocare.com`)
  if (canon.startsWith('0') && canon.length >= 11) {
    emails.add(`c63${canon.slice(1)}@customers.hakumautocare.com`)
  }
  return [...emails]
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
