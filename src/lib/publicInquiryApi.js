/**
 * Public form intake. These tables no longer accept anon INSERT (migration
 * public_inquiry_api_geofence) — submissions go through the service-role API,
 * which re-validates and re-checks the spam guard server-side.
 */
export async function submitPublicInquiry(kind, fields, guard) {
  const body = {
    kind,
    ...fields,
    honeypot: guard?.honeypot || '',
    elapsedMs: Date.now() - Number(guard?.openedAt || 0),
  }

  let res
  try {
    res = await fetch('/api/public-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'We could not reach the server. Please check your connection and try again.' }
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok || !payload?.ok) {
    return { ok: false, error: payload?.error || 'We could not send that just now. Please try again.' }
  }
  return { ok: true }
}
