/**
 * Client wrapper for `/api/finance?operation=owner-ops`.
 * Sends the active Supabase session JWT so Owner (`BossMich`) and authorized Finance writers
 * can execute atomic payslip overrides/deletes, Daily Sheet & sheet-bill overrides,
 * expense category CRUD with automatic FK reassignment, and cash-advance hub management.
 */
import { getAccessTokenFresh } from './authToken.js'

export async function callFinanceOwnerOps(payload) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Your session expired. Please sign in again.')

  const res = await fetch('/api/finance?operation=owner-ops', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}
