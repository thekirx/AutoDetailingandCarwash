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

/**
 * Submit a smart ops form (/f/:slug or staff fill) through `/api/public-inquiry`
 * so server-side Detailing Booking Placeholder creation & notifications happen in one hop.
 */
export async function submitPublicOpsFormViaApi({
  slug,
  payload,
  calendarAt = null,
  respondentLabel = null,
  source = 'public',
  guard = null,
  accessToken = null,
} = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
  const body = {
    kind: 'ops_form',
    slug,
    payload,
    calendar_at: calendarAt || null,
    respondent_label: respondentLabel || null,
    source,
    ...(guard
      ? {
          honeypot: guard.honeypot || '',
          elapsedMs: Date.now() - Number(guard.openedAt || 0),
        }
      : {}),
  }

  let res
  try {
    res = await fetch('/api/public-inquiry', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'We could not reach the server. Please check your connection and try again.' }
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error || 'Could not send form response. Please try again.' }
  }

  return {
    ok: true,
    id: json.id || null,
    formKind: json.formKind || null,
    booking: json.booking || null,
  }
}
