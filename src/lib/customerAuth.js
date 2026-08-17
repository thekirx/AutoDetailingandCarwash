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

function looksLikePhMobilePlate(plate, raw) {
  const digits = phoneDigits(raw)
  if (digits.length >= 10 && digits.length <= 13 && /^(0?9|63)/.test(digits)) return true
  if (/^(09|63)\d{8,}$/.test(plate)) return true
  return false
}

/**
 * PH vehicle ID for the floor: LTO plate, dealer conduction sticker, or temporary / TOP.
 * Digit-only 5–8 is a conduction serial, not a phone (phones are 10–13 digits).
 */
export function classifyPhPlate(value) {
  const plate = normalizePlate(value)
  if (!plate || plate.length < 3 || plate.length > 10) return null
  if (looksLikePhMobilePlate(plate, value)) return null

  if (/^(TMP|TEMP|TPL|TOP|TP)\d{3,8}$/.test(plate) || /^T\d{4,8}$/.test(plate)) return 'temporary'
  if (/^(CS|COND|CONDUCTION)\d{3,8}$/.test(plate)) return 'conduction'
  if (/^\d{5,8}$/.test(plate)) return 'conduction'
  if (/^[A-Z]{1,4}\d{2,5}$/.test(plate)) return 'lto'
  if (plate.length >= 4 && /[A-Z]/.test(plate) && /\d/.test(plate)) return 'lto'
  return null
}

export function isValidCustomerPlate(value) {
  return classifyPhPlate(value) != null
}

export function plateKindLabel(value) {
  const kind = classifyPhPlate(value)
  if (kind === 'conduction') return 'Conduction sticker'
  if (kind === 'temporary') return 'Temporary / TOP'
  if (kind === 'lto') return 'LTO plate'
  return ''
}

export function plateValidationError(value) {
  const plate = normalizePlate(value)
  if (!plate) return 'Plate, conduction sticker, or temporary / TOP number is required.'
  if (looksLikePhMobilePlate(plate, value)) {
    return 'That looks like a phone number. Enter the vehicle plate or sticker instead.'
  }
  if (plate.length < 3 || /^\d{1,4}$/.test(plate)) {
    return 'Too short. Use the LTO plate, conduction sticker (5–8 digits), or temporary / TOP.'
  }
  if (plate.length > 10) return 'Too long. Check the plate or sticker.'
  if (/^[A-Z]+$/.test(plate)) return 'Add the numbers. Letter-only values are not a plate.'
  if (!isValidCustomerPlate(value)) {
    return 'Enter a PH LTO plate, conduction sticker, or temporary / TOP number.'
  }
  return null
}

export const PLATE_FIELD_HINT = 'LTO plate (ABC 1234), conduction sticker (5–8 digits or CS), or temporary / TOP'

export function safeVehiclePhotoUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
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
  const hasLetter = /[A-Za-z]/.test(value)
  // Phone: mostly digits, 10–13 length (09… or 63…)
  if (!hasLetter && digits.length >= 10 && digits.length <= 13) return 'phone'
  if (classifyPhPlate(value)) return 'plate'
  // Ambiguous short digit-only — incomplete phone unless it is a conduction serial
  if (!hasLetter && digits.length > 0) return 'phone'
  return 'unknown'
}

/** Resolve Auth email for email/phone only (plate needs server lookup). */
export function resolveLoginEmail(raw) {
  const kind = classifyIdentifier(raw)
  if (kind === 'email') return String(raw).trim().toLowerCase()
  if (kind === 'phone') return phoneLoginEmail(raw)
  throw new Error('Use email or phone, or wait for plate lookup.')
}
