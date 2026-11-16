/**
 * BusyBee BrandTxT SMS limits (MyBusyBee support):
 * - GSM-7 single SMS: 160 chars
 * - Concatenated GSM: 153 per segment (up to 10 parts / ~1000 chars supported)
 * We keep admin copy to one SMS credit by default.
 */
export const BUSYBEE_SMS_SINGLE_MAX = 160
export const BUSYBEE_SMS_CONCAT_SEGMENT = 153
export const BUSYBEE_SMS_MULTIPART_MAX = 306
export const BUSYBEE_SMS_UNICODE_SINGLE_MAX = 70
export const BUSYBEE_SMS_UNICODE_CONCAT_SEGMENT = 67
export const BUSYBEE_SMS_HARD_MAX = 1000
export const BUSYBEE_PUSH_TITLE_MAX = 65
export const BUSYBEE_PUSH_BODY_MAX = 200

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXTENDED = '^{}\\[~]|€'
const GSM7_BASIC_SET = new Set([...GSM7_BASIC])
const GSM7_EXT_SET = new Set([...GSM7_EXTENDED])

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
 * SMS / both → BusyBee single-SMS 160 (or 306 if allowMultiPart opt-in); push-only → 200.
 */
export function messageMaxForChannel(channel, { allowMultiPart = false } = {}) {
  if (channel === 'push') return BUSYBEE_PUSH_BODY_MAX
  return allowMultiPart ? BUSYBEE_SMS_MULTIPART_MAX : BUSYBEE_SMS_SINGLE_MAX
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
 * Inspect SMS copy against BusyBee BrandTxT encoding & credit limits.
 * Default cap is 160 chars (1 credit); explicit multi-part opt-in allows up to 306 chars (2 credits).
 */
export function analyzeBusybeeSms(text, { allowMultiPart = false } = {}) {
  const src = String(text || '')
  const length = src.length
  const maxChars = allowMultiPart ? BUSYBEE_SMS_MULTIPART_MAX : BUSYBEE_SMS_SINGLE_MAX
  const nonGsm = []
  let gsmSeptets = 0
  for (const ch of src) {
    if (GSM7_BASIC_SET.has(ch)) {
      gsmSeptets += 1
    } else if (GSM7_EXT_SET.has(ch)) {
      gsmSeptets += 2
    } else {
      gsmSeptets += 1
      if (!nonGsm.includes(ch) && nonGsm.length < 5) nonGsm.push(ch)
    }
  }
  const hasUnicode = nonGsm.length > 0
  const encoding = hasUnicode ? 'UCS-2' : 'GSM-7'
  let credits = 0
  if (length > 0) {
    if (hasUnicode) {
      credits =
        length <= BUSYBEE_SMS_UNICODE_SINGLE_MAX
          ? 1
          : Math.ceil(length / BUSYBEE_SMS_UNICODE_CONCAT_SEGMENT)
    } else {
      credits =
        gsmSeptets <= BUSYBEE_SMS_SINGLE_MAX
          ? 1
          : Math.ceil(gsmSeptets / BUSYBEE_SMS_CONCAT_SEGMENT)
    }
  }
  const exceedsSingle = length > BUSYBEE_SMS_SINGLE_MAX
  const exceedsLimit = length > maxChars
  const error = exceedsLimit
    ? `SMS exceeds BusyBee ${allowMultiPart ? `multi-part (${BUSYBEE_SMS_MULTIPART_MAX})` : `single-SMS (${BUSYBEE_SMS_SINGLE_MAX})`} limit (${length}/${maxChars} chars).`
    : null
  const warning =
    !error && hasUnicode
      ? `Contains non-GSM characters (${nonGsm.join(' ')}): carriers bill UCS-2 at 70 chars/SMS (${credits} credit${credits === 1 ? '' : 's'}).`
      : !error && exceedsSingle
      ? `Multi-part SMS enabled: burns ${credits} BusyBee credits per recipient.`
      : null
  return {
    text: src,
    length,
    gsmSeptets,
    maxChars,
    encoding,
    credits,
    hasUnicode,
    nonGsmChars: nonGsm,
    exceedsSingle,
    exceedsLimit,
    allowMultiPart: Boolean(allowMultiPart),
    ok: !error,
    error,
    warning,
  }
}

/**
 * Shared validation for Push + BusyBee SMS payloads (used by both UI and API handlers).
 * Rejects length violations with a clear operator error rather than truncating silently.
 */
export function validateNotificationCopy({
  channel = 'both',
  title = '',
  body = '',
  sms_body = '',
  allowMultiPart = false,
  requireTitle = false,
  requireBody = false,
  requireSms = false,
} = {}) {
  const ch = ['push', 'sms', 'both'].includes(channel) ? channel : 'push'
  const cleanTitle = String(title || '').trim()
  const cleanBody = String(body || '').trim()
  const cleanSms = String(sms_body || '').trim()

  if (requireTitle && !cleanTitle) {
    return { ok: false, error: 'Title is required.' }
  }
  if (requireBody && !cleanBody) {
    return { ok: false, error: 'Message body is required.' }
  }
  if (requireSms && !cleanSms) {
    return { ok: false, error: 'SMS text is required.' }
  }

  const tMax = titleMaxForChannel(ch)
  if (cleanTitle.length > tMax) {
    return {
      ok: false,
      error: `Title must be ${tMax} characters or fewer (${cleanTitle.length}/${tMax}).`,
    }
  }

  if (ch === 'push') {
    if (cleanBody.length > BUSYBEE_PUSH_BODY_MAX) {
      return {
        ok: false,
        error: `Push body must be ${BUSYBEE_PUSH_BODY_MAX} characters or fewer (${cleanBody.length}/${BUSYBEE_PUSH_BODY_MAX}).`,
      }
    }
    return { ok: true, smsAnalysis: null }
  }

  if (cleanBody && ch === 'both' && cleanBody.length > BUSYBEE_PUSH_BODY_MAX) {
    return {
      ok: false,
      error: `Push body must be ${BUSYBEE_PUSH_BODY_MAX} characters or fewer (${cleanBody.length}/${BUSYBEE_PUSH_BODY_MAX}).`,
    }
  }

  const smsSource = cleanSms || (ch === 'sms' || ch === 'both' ? cleanBody : '')
  const smsAnalysis = analyzeBusybeeSms(smsSource, { allowMultiPart })
  if (!smsAnalysis.ok) {
    return { ok: false, error: smsAnalysis.error, smsAnalysis }
  }

  return { ok: true, smsAnalysis }
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

/** Clickable insert tokens for reminder / broadcast / system templates. */
export const MESSAGE_TOKENS = [
  { token: '{name}', label: 'Name', hint: 'Customer first/full name' },
  { token: '{plate}', label: 'Plate', hint: 'Vehicle plate' },
  { token: '{service}', label: 'Service', hint: 'Service name' },
  { token: '{branch}', label: 'Branch', hint: 'Branch name' },
  { token: '{when}', label: 'When', hint: 'Scheduled date and time' },
  { token: '{appUrl}', label: 'App URL', hint: 'Download or book link' },
]

/**
 * Insert a token into a string at a caret index (defaults to end).
 * Returns { value, caret } so the UI can restore selection.
 */
export function insertMessageToken(text, token, caret = null) {
  const src = String(text || '')
  const t = String(token || '')
  if (!t) return { value: src, caret: src.length }
  const at = caret == null || caret < 0 || caret > src.length ? src.length : caret
  const value = `${src.slice(0, at)}${t}${src.slice(at)}`
  return { value, caret: at + t.length }
}

/**
 * Substitute smart tokens in a custom reminder / SMS / system template message.
 * Known tokens: {plate} {service} {name} {branch} {when} {appUrl} {code}
 * plus any custom `{key}` present in `vars`.
 * Missing known vars keep the token when keepMissing is true (broadcast draft preview).
 */
export function renderNotificationMessage(template, vars = {}, { keepMissing = false } = {}) {
  const fallback = `Hakum Auto Care: ${vars.plate || 'your vehicle'} is due for its ${vars.service || 'detailing'} maintenance. Book at hakumautocare.com/book.`
  const raw = String(template || '').trim() || fallback
  const defaults = {
    plate: 'your vehicle',
    service: 'detailing',
    name: 'there',
    branch: 'Hakum',
    when: '',
    appUrl: 'hakumautocare.com',
  }
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const v = vars?.[key]
    if (v != null && String(v).trim() !== '') return String(v)
    if (key in defaults) return keepMissing ? match : defaults[key]
    return keepMissing ? match : match
  })
}

export function clampNotificationCopy({ channel, title, message } = {}) {
  const ch = ['push', 'sms', 'both'].includes(channel) ? channel : 'push'
  const tMax = titleMaxForChannel(ch)
  const mMax = messageMaxForChannel(ch)
  const t = String(title || '').trim().slice(0, tMax)
  const m = String(message || '').trim().slice(0, mMax)
  return { channel: ch, title: t || null, message: m || null }
}
