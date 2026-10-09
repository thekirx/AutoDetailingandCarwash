import { getAccessTokenFresh } from '@/lib/authToken'
import { supabase } from '@/lib/supabase'

async function postProvision(body) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in again to save the customer.')
  const response = await fetch('/api/provision-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Could not save the customer.')
  return payload
}

/** Who already owns this phone / email? Resolves { found, match, customer } or { found, conflict }. */
export function lookupCustomerIdentity({ phone, email }) {
  return postProvision({
    lookup_only: true,
    customer_phone: String(phone || '').trim(),
    customer_email: String(email || '').trim(),
  })
}

/**
 * Create-or-link the customer, then move the ticket (and its visit group) onto them.
 * Without a booking (merch-only sale) it only creates / links the account.
 */
export async function saveCustomerForSale({ bookingId = null, form }) {
  const first = String(form.first || '').trim()
  const last = String(form.last || '').trim()
  const saved = await postProvision({
    customer_first_name: first || undefined,
    customer_last_name: last || undefined,
    customer_name: [first, last].filter(Boolean).join(' ') || undefined,
    customer_phone: String(form.phone || '').trim(),
    customer_email: String(form.email || '').trim() || undefined,
    site_origin: window.location.origin,
    allow_walk_in_name: true,
  })
  if (!bookingId) return saved
  const { data, error } = await supabase.rpc('assign_queue_ticket_customer', {
    p_booking_id: bookingId,
    p_customer_id: saved.customer_id,
  })
  if (error) throw new Error(error.message)
  return { ...saved, ticket: data }
}
