const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizePartnershipInquiry(input = {}) {
  return {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    contactNumber: String(input.contactNumber || '').trim(),
    city: String(input.city || '').trim(),
    message: String(input.message || '').trim(),
  }
}

export function validatePartnershipInquiry(input = {}) {
  const inquiry = normalizePartnershipInquiry(input)
  const errors = {}

  if (!inquiry.name) errors.name = 'Name is required.'
  if (!inquiry.email) errors.email = 'Email is required.'
  else if (!EMAIL_PATTERN.test(inquiry.email)) errors.email = 'Enter a valid email address.'
  if (!inquiry.contactNumber) errors.contactNumber = 'Contact number is required.'
  if (!inquiry.city) errors.city = 'City is required.'
  if (!inquiry.message) errors.message = 'Message is required.'

  return errors
}

export async function submitPartnershipInquiry() {
  return {
    ok: false,
    code: 'unavailable',
    message: 'Online partnership inquiries are not available yet. Please contact Hakum Auto Care directly for now.',
  }
}
