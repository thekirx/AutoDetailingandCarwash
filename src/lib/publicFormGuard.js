/** Client-side spam friction for public forms (CUST-H9). Not a CAPTCHA — pairs with /api/public-inquiry. */
export function createPublicFormGuard() {
  return { openedAt: Date.now(), honeypot: '' }
}

/** Normalize guard fields from API JSON bodies (server + client). */
export function parsePublicFormGuard(body = {}) {
  return {
    openedAt: Number(body.form_opened_at ?? body.openedAt ?? 0),
    honeypot: String(body.company_website ?? body.honeypot ?? ''),
  }
}

/**
 * @param {{ openedAt: number, honeypot?: string }} guard
 * @param {{ minMs?: number }} [opts]
 * @returns {string | null} error message or null if ok
 */
export function validatePublicFormGuard(guard, opts = {}) {
  const minMs = opts.minMs ?? 2000
  if (String(guard?.honeypot || '').trim()) {
    return 'Unable to submit right now.'
  }
  const opened = Number(guard?.openedAt || 0)
  if (!opened || Date.now() - opened < minMs) {
    return 'Please wait a moment and try again.'
  }
  return null
}
