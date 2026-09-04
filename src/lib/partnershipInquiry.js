import { submitPublicInquiry } from './publicInquiryApi.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const BRAND_COLLAB_TYPES = [
  { value: 'product_collaboration', legacyValue: 'commercial_lot', label: 'Product collaboration' },
  { value: 'event_sponsorship', legacyValue: 'mall_retail', label: 'Event sponsorship' },
  { value: 'content_campaign', legacyValue: 'fuel_station', label: 'Content campaign' },
  { value: 'distribution_deal', legacyValue: 'village_condo', label: 'Distribution deal' },
]

// Stored values stay compatible with the existing inquiry table while the
// public experience and operations inbox speak in brand-collaboration terms.
export const SITE_TYPES = BRAND_COLLAB_TYPES.map(({ legacyValue: value, label }) => ({ value, label }))
const SITE_TYPE_VALUES = SITE_TYPES.map((type) => type.value)
export const SITE_TYPE_LABELS = Object.fromEntries(SITE_TYPES.map((type) => [type.value, type.label]))

export const PARTNERSHIP_STATUSES = ['new', 'reviewing', 'contacted', 'archived']
export const CONTACT_STATUSES = ['new', 'reviewing', 'contacted', 'archived']

export function normalizeBrandCollaborationInquiry(input = {}) {
  const selected = BRAND_COLLAB_TYPES.find((type) => type.value === String(input.collaborationType || '').trim())
    || BRAND_COLLAB_TYPES[0]
  const website = String(input.website || '').trim()
  const message = String(input.message || '').trim()

  return {
    siteType: selected.legacyValue,
    name: String(input.contactName || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    contactNumber: String(input.contactNumber || '').trim(),
    city: String(input.brandName || '').trim(),
    message: website ? `Website: ${website}\n\n${message}` : message,
  }
}

export function validateBrandCollaborationInquiry(input = {}) {
  const inquiry = normalizeBrandCollaborationInquiry(input)
  const errors = {}

  if (!inquiry.name) errors.contactName = 'Contact name is required.'
  if (!inquiry.city) errors.brandName = 'Brand or company name is required.'
  if (!inquiry.email) errors.email = 'Email is required.'
  else if (!EMAIL_PATTERN.test(inquiry.email)) errors.email = 'Enter a valid email address.'
  if (!inquiry.contactNumber) errors.contactNumber = 'Contact number is required.'
  if (!String(input.message || '').trim()) errors.message = 'Tell us what you have in mind.'

  return errors
}

export async function submitBrandCollaborationInquiry(inquiry, guard) {
  const payload = normalizeBrandCollaborationInquiry(inquiry)
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
    message: 'Thank you — your collaboration idea is with our team. We reply within two business days.',
  }
}

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
