import { submitPublicInquiry } from './publicInquiryApi'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const SITE_TYPES = [
  { value: 'commercial_lot', label: 'Commercial lot' },
  { value: 'mall_retail', label: 'Mall or retail' },
  { value: 'fuel_station', label: 'Fuel station' },
  { value: 'village_condo', label: 'Village or condo' },
]

const SITE_TYPE_VALUES = SITE_TYPES.map((type) => type.value)

export const SITE_TYPE_LABELS = Object.fromEntries(SITE_TYPES.map((type) => [type.value, type.label]))

export const PARTNERSHIP_STATUSES = ['new', 'reviewing', 'contacted', 'archived']
export const CONTACT_STATUSES = ['new', 'reviewing', 'contacted', 'archived']

export function normalizePartnershipInquiry(input = {}) {
  const siteType = String(input.siteType || '').trim()
  return {
    siteType: SITE_TYPE_VALUES.includes(siteType) ? siteType : SITE_TYPE_VALUES[0],
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
  if (!inquiry.city) errors.city = 'Site location is required.'
  if (!inquiry.message) errors.message = 'Message is required.'

  return errors
}

export async function submitPartnershipInquiry(inquiry, guard) {
  const payload = normalizePartnershipInquiry(inquiry)
  const result = await submitPublicInquiry('partnership', payload, guard)

  if (!result.ok) {
    return {
      ok: false,
      code: 'failed',
      message: 'We could not send that just now. Please try again, or',
    }
  }

  return {
    ok: true,
    code: 'submitted',
    message: 'Thank you — your inquiry is with our team. We reply within two business days.',
  }
}
