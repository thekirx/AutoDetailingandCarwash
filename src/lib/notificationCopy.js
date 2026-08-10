/**
 * BusyBee BrandTxT SMS limits (MyBusyBee support):
 * - GSM-7 single SMS: 160 chars
 * - Concatenated GSM: 153 per segment (up to 10 parts / ~1000 chars supported)
 * We keep admin copy to one SMS credit by default.
 */
export const BUSYBEE_SMS_SINGLE_MAX = 160
export const BUSYBEE_SMS_CONCAT_SEGMENT = 153
export const BUSYBEE_SMS_HARD_MAX = 1000
export const BUSYBEE_PUSH_TITLE_MAX = 65
export const BUSYBEE_PUSH_BODY_MAX = 200

/** Reminder rule scopes for Super Admin smart notifications. */
export const NOTIFICATION_SCOPES = [
  { id: 'whole', label: 'Whole network', hint: 'All detailing services · all branches' },
  { id: 'per_branch', label: 'Per branch', hint: 'All detailing services · one branch' },
  { id: 'per_service', label: 'Per service', hint: 'One detailing service · all branches' },
  { id: 'per_service_branch', label: 'Per service + branch', hint: 'One detailing service · one branch' },
]

export function notificationScopeLabel(scope) {
  return NOTIFICATION_SCOPES.find((s) => s.id === scope)?.label || scope || 'Whole network'
}

/**
 * Max message length for the chosen channel.
 * SMS / both → BusyBee single-SMS 160; push-only → longer push body.
 */
export function messageMaxForChannel(channel) {
  if (channel === 'push') return BUSYBEE_PUSH_BODY_MAX
  return BUSYBEE_SMS_SINGLE_MAX
}

export function titleMaxForChannel(channel) {
  if (channel === 'sms') return BUSYBEE_SMS_SINGLE_MAX
  return BUSYBEE_PUSH_TITLE_MAX
}

/** How many BusyBee SMS credits a GSM body would burn. */
export function busybeeSmsSegments(text) {
  const len = String(text || '').length
  if (len <= 0) return 0
  if (len <= BUSYBEE_SMS_SINGLE_MAX) return 1
  return Math.ceil(len / BUSYBEE_SMS_CONCAT_SEGMENT)
}

/**
 * Resolve service_id / branch_slug from an explicit scope choice.
 * Returns { ok, error?, service_id, branch_slug, scope }.
 */
export function resolveNotificationScope({ scope, service_id, branch_slug } = {}) {
  const s = String(scope || 'whole').trim()
  const svc = service_id || null
  const br = branch_slug || null
  if (!NOTIFICATION_SCOPES.some((row) => row.id === s)) {
    return { ok: false, error: 'Pick a valid scope: whole, per branch, per service, or both.' }
  }
  if (s === 'whole') return { ok: true, scope: s, service_id: null, branch_slug: null }
  if (s === 'per_branch') {
    if (!br) return { ok: false, error: 'Pick a branch for per-branch reminders.' }
    return { ok: true, scope: s, service_id: null, branch_slug: br }
  }
  if (s === 'per_service') {
    if (!svc) return { ok: false, error: 'Pick a detailing service for per-service reminders.' }
    return { ok: true, scope: s, service_id: svc, branch_slug: null }
  }
  // per_service_branch
  if (!svc || !br) return { ok: false, error: 'Pick both a detailing service and a branch.' }
  return { ok: true, scope: s, service_id: svc, branch_slug: br }
}

/**
 * Substitute smart tokens in a custom reminder message.
 * Tokens: {plate} {service} {name} {branch}
 */
export function renderNotificationMessage(template, vars = {}) {
  const fallback = `Hakum Auto Care: ${vars.plate || 'your vehicle'} is due for its ${vars.service || 'detailing'} maintenance. Book at hakumautocare.com/book.`
  const raw = String(template || '').trim() || fallback
  return raw
    .replaceAll('{plate}', vars.plate || 'your vehicle')
    .replaceAll('{service}', vars.service || 'detailing')
    .replaceAll('{name}', vars.name || 'there')
    .replaceAll('{branch}', vars.branch || 'Hakum')
}

export function clampNotificationCopy({ channel, title, message } = {}) {
  const ch = ['push', 'sms', 'both'].includes(channel) ? channel : 'push'
  const tMax = titleMaxForChannel(ch)
  const mMax = messageMaxForChannel(ch)
  const t = String(title || '').trim().slice(0, tMax)
  const m = String(message || '').trim().slice(0, mMax)
  return { channel: ch, title: t || null, message: m || null }
}
