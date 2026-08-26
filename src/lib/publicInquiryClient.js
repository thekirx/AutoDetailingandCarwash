/** Browser client for server-validated public inquiry forms. */

export async function postPublicInquiry(operation, payload, guard) {
  const res = await fetch(`/api/public-inquiry?operation=${encodeURIComponent(operation)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      form_opened_at: guard?.openedAt ?? 0,
      company_website: guard?.honeypot ?? '',
    }),
  })
  let body = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (!res.ok) {
    throw new Error(body.error || 'Unable to submit right now.')
  }
  return body
}
