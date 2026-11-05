import { getAccessTokenFresh } from './authToken'
export async function pickupAction(action, payload = {}) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/points-shop', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Unable to load pickups.')
  return body
}
