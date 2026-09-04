import { getAccessTokenFresh } from './authToken'

/** GET /api/customer-portal — profile, branches, bookings (active), history, vehicles, loyalty, birthday. */
export async function fetchPortal() {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/customer-portal', { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Session expired. Sign in again.')
  if (!res.ok) throw new Error(body.error || 'Unable to load account.')
  return body
}

/** POST /api/customer-portal — add-vehicle | update-vehicle | archive-vehicle | sync-email | update-phone | update-birthday | submit-review */
export async function portalAction(action, payload = {}) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in again.')
  const res = await fetch('/api/customer-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed')
  return body
}

export function branchLabel(branches = [], slug) {
  if (!slug) return ''
  const row = branches.find((b) => b.slug === slug)
  return row?.name?.replace(/^Hakum Auto Care\s*/i, '') || row?.name || slug
}

export function initials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
