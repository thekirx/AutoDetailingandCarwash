/**
 * POS customer capture rules. Team Leads no longer take a name or contact, so the Branch Admin
 * records them at the counter. Phone and email are the unique identifiers: a match is filled
 * in, anything else becomes one new account — never a duplicate. (API calls: posTicketCustomerApi.js)
 */
import { canonicalPhMobile } from './customerAuth.js'
import { splitCustomerName } from './phVehicles.js'
import { isWalkInCustomerName } from './queueCustomerName.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const hasValidPhone = (value) => canonicalPhMobile(value).length >= 10
export const hasValidEmail = (value) => EMAIL_RE.test(String(value || '').trim())

/** A ticket still needs its customer when none is linked, or only a walk-in placeholder is. */
export function ticketNeedsCustomer(booking) {
  if (!booking) return false
  return !booking.customer_id || isWalkInCustomerName(booking.customer_name)
}

/** Form values for a customer row; falls back to splitting the full name. */
export function customerFormValues(row) {
  if (!row) return { first: '', last: '', phone: '', email: '' }
  const split = splitCustomerName(row.full_name)
  return {
    first: row.first_name || split.first,
    last: row.first_name ? row.last_name || '' : split.last,
    phone: row.phone || '',
    email: row.email || '',
  }
}

/**
 * Prefill for a queue ticket: legacy tickets still carry the phone/email the Team Lead typed;
 * a real name is kept, a walk-in placeholder is not.
 */
export function ticketFormValues(booking) {
  const named = booking && !isWalkInCustomerName(booking.customer_name)
  const split = splitCustomerName(named ? booking.customer_name : '')
  return {
    first: split.first,
    last: split.last,
    phone: String(booking?.customer_phone || '').trim(),
    email: String(booking?.customer_email || '').trim(),
  }
}

export function hasCustomerInput({ first, last, phone, email } = {}) {
  return Boolean(`${first || ''}${last || ''}${phone || ''}${email || ''}`.trim())
}

/** Blocking message for the capture form, or '' when it can be saved (or is blank = guest). */
export function customerFormError({ first, phone, email, matched } = {}) {
  const p = String(phone || '').trim()
  const e = String(email || '').trim()
  if (p && !hasValidPhone(p)) return 'Enter a valid mobile number, like 0917 123 4567.'
  if (e && !hasValidEmail(e)) return 'Enter a valid email address.'
  if (matched) return ''
  if (e && !p) return 'Add a mobile number so we can create the account.'
  if (p && !String(first || '').trim()) return 'Add a first name to create the account.'
  return ''
}
