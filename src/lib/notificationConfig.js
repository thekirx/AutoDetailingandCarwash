/**
 * Global Notification & Channel Configuration (deep module shared by client & server).
 * Controls Super Admin SMS master switch, Detailing/Services/Packages SMS scope gates,
 * per-status SMS toggles, Web Push & scheduled automation gates, and Manila quiet hours.
 */

export const NOTIFICATION_CONFIG_KEY = 'notification_config'

export const STATUS_SMS_SCOPES = Object.freeze([
  {
    id: 'detailing',
    label: 'Detailing & PPF',
    description: 'Ceramic coating, nano-ceramic tint, paint protection film, and detailing appointments.',
  },
  {
    id: 'service',
    label: 'Services',
    description: 'Carwash, express bay services, underwash, and floor queue service tickets.',
  },
  {
    id: 'package',
    label: 'Packages',
    description: 'Bundled wash & detailing packages processed at branch bays or online booking.',
  },
])

export const BOOKING_STATUS_CONFIG_META = Object.freeze([
  {
    status: 'pending',
    label: 'Booking received',
    stage: 'Online & Scheduled',
    description: 'Sent right after a customer submits a booking request.',
  },
  {
    status: 'confirmed',
    label: 'Booking confirmed',
    stage: 'Online & Scheduled',
    description: 'Sent when branch staff approve a booking date or bay slot.',
  },
  {
    status: 'waiting',
    label: 'Checked in / In queue',
    stage: 'Live Floor Queue',
    description: 'Sent when a walk-in or scheduled car checks in to the branch queue.',
  },
  {
    status: 'in_progress',
    label: 'Service in progress',
    stage: 'Live Floor Queue',
    description: 'Sent when detailers or washers begin working on the vehicle.',
  },
  {
    status: 'final_checking',
    label: 'Final QC inspection',
    stage: 'Live Floor Queue',
    description: 'Sent when Team Lead moves the vehicle into quality inspection.',
  },
  {
    status: 'for_payment',
    label: 'Ready for payment',
    stage: 'Live Floor Queue',
    description: 'Sent when work passes QC and the customer can settle at the counter.',
  },
  {
    status: 'completed',
    label: 'Service complete',
    stage: 'Completion',
    description: 'Sent when payment is settled and the vehicle is released.',
  },
  {
    status: 'cancelled',
    label: 'Booking cancelled',
    stage: 'Exceptions',
    description: 'Sent if a reservation or queue visit is cancelled by staff or customer.',
  },
  {
    status: 'photos_ready',
    label: 'Progress photos ready',
    stage: 'Media Update',
    description: 'Sent when fresh before/during/after vehicle photos are uploaded.',
  },
])

export const DEFAULT_NOTIFICATION_CONFIG = Object.freeze({
  sms_enabled: true,
  sms_sender_id: 'HAKUM',
  sms_scopes: Object.freeze({
    detailing: true,
    service: true,
    package: true,
  }),
  sms_statuses: Object.freeze({
    pending: true,
    confirmed: true,
    waiting: true,
    in_progress: true,
    final_checking: true,
    for_payment: true,
    completed: true,
    cancelled: true,
    photos_ready: true,
  }),
  push_notifications_enabled: true,
  booking_reminders_enabled: true,
  maintenance_reminders_enabled: true,
  birthday_greetings_enabled: true,
  rate_visit_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
})

export function createDefaultNotificationConfig() {
  return {
    ...DEFAULT_NOTIFICATION_CONFIG,
    sms_scopes: { ...DEFAULT_NOTIFICATION_CONFIG.sms_scopes },
    sms_statuses: { ...DEFAULT_NOTIFICATION_CONFIG.sms_statuses },
  }
}

export function normalizeClockHHMM(value, fallback) {
  const s = String(value || '').trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return fallback
  return s
}

export function normalizeSenderId(value, fallback = 'HAKUM') {
  const cleaned = String(value || '').trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,11}$/.test(cleaned)) return fallback
  return cleaned
}

function coerceBoolMap(source, defaults) {
  const out = {}
  for (const key of Object.keys(defaults)) {
    const val = source?.[key]
    out[key] = typeof val === 'boolean' ? val : defaults[key]
  }
  return out
}

function toMs(iso) {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/**
 * Reconcile `app_settings.notification_config` with `app_settings.sms_notifications`
 * so legacy CRM kill-switch writes and the unified Settings panel always agree.
 */
export function resolveNotificationConfigRows({ configRow = null, smsRow = null } = {}) {
  const cfgVal = configRow?.value && typeof configRow.value === 'object' ? configRow.value : null
  const smsVal = smsRow?.value && typeof smsRow.value === 'object' ? smsRow.value : null
  const config = normalizeNotificationConfig(cfgVal || {}, smsVal)

  if (smsVal && typeof smsVal.enabled === 'boolean') {
    const cfgTs = toMs(configRow?.updated_at)
    const smsTs = toMs(smsRow?.updated_at)
    if (!cfgVal || smsTs > cfgTs) {
      config.sms_enabled = smsVal.enabled
    } else if (cfgVal.sms_enabled === undefined) {
      config.sms_enabled = smsVal.enabled
    }
  }
  return config
}

export function normalizeNotificationConfig(raw = {}, legacySmsValue = null) {
  const base = createDefaultNotificationConfig()
  const src = raw && typeof raw === 'object' ? raw : {}

  const smsFromLegacy =
    legacySmsValue && typeof legacySmsValue.enabled === 'boolean' ? legacySmsValue.enabled : base.sms_enabled

  return {
    sms_enabled: typeof src.sms_enabled === 'boolean' ? src.sms_enabled : smsFromLegacy,
    sms_sender_id: normalizeSenderId(src.sms_sender_id, base.sms_sender_id),
    sms_scopes: coerceBoolMap(src.sms_scopes, base.sms_scopes),
    sms_statuses: coerceBoolMap(src.sms_statuses, base.sms_statuses),
    push_notifications_enabled:
      typeof src.push_notifications_enabled === 'boolean'
        ? src.push_notifications_enabled
        : base.push_notifications_enabled,
    booking_reminders_enabled:
      typeof src.booking_reminders_enabled === 'boolean'
        ? src.booking_reminders_enabled
        : base.booking_reminders_enabled,
    maintenance_reminders_enabled:
      typeof src.maintenance_reminders_enabled === 'boolean'
        ? src.maintenance_reminders_enabled
        : base.maintenance_reminders_enabled,
    birthday_greetings_enabled:
      typeof src.birthday_greetings_enabled === 'boolean'
        ? src.birthday_greetings_enabled
        : base.birthday_greetings_enabled,
    rate_visit_enabled:
      typeof src.rate_visit_enabled === 'boolean' ? src.rate_visit_enabled : base.rate_visit_enabled,
    quiet_hours_enabled:
      typeof src.quiet_hours_enabled === 'boolean' ? src.quiet_hours_enabled : base.quiet_hours_enabled,
    quiet_hours_start: normalizeClockHHMM(src.quiet_hours_start, base.quiet_hours_start),
    quiet_hours_end: normalizeClockHHMM(src.quiet_hours_end, base.quiet_hours_end),
  }
}

export function validateNotificationConfigPatch(patch, baseConfig = DEFAULT_NOTIFICATION_CONFIG) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'Settings payload must be a JSON object.' }
  }

  const base = normalizeNotificationConfig(baseConfig)
  const merged = {
    ...base,
    ...patch,
    sms_scopes: {
      ...base.sms_scopes,
      ...(patch.sms_scopes && typeof patch.sms_scopes === 'object' ? patch.sms_scopes : {}),
    },
    sms_statuses: {
      ...base.sms_statuses,
      ...(patch.sms_statuses && typeof patch.sms_statuses === 'object' ? patch.sms_statuses : {}),
    },
  }

  if (patch.sms_sender_id !== undefined) {
    const rawSender = String(patch.sms_sender_id || '').trim().toUpperCase()
    if (!/^[A-Z0-9_-]{3,11}$/.test(rawSender)) {
      return {
        ok: false,
        error: 'BusyBee Sender ID must be 3–11 uppercase letters, digits, dashes, or underscores.',
      }
    }
    merged.sms_sender_id = rawSender
  }

  const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/
  if (patch.quiet_hours_start !== undefined && !clockPattern.test(String(patch.quiet_hours_start).trim())) {
    return { ok: false, error: 'Quiet hours start must use 24-hour HH:MM format (e.g. 22:00).' }
  }
  if (patch.quiet_hours_end !== undefined && !clockPattern.test(String(patch.quiet_hours_end).trim())) {
    return { ok: false, error: 'Quiet hours end must use 24-hour HH:MM format (e.g. 07:00).' }
  }

  const config = normalizeNotificationConfig(merged)
  if (config.quiet_hours_enabled && config.quiet_hours_start === config.quiet_hours_end) {
    return { ok: false, error: 'Quiet hours start and end times cannot be identical.' }
  }

  return { ok: true, config }
}

function manilaMinutesOfDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hh * 60 + mm
}

function clockToMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number)
  return (h % 24) * 60 + m
}

/**
 * Evaluate Manila (UTC+8) quiet window for scheduled push jobs (reminders, birthdays, rate-visit).
 * Live floor booking status alerts intentionally bypass quiet hours so customers pick up their car.
 */
export function isWithinQuietHours(config, now = new Date()) {
  if (!config || config.quiet_hours_enabled !== true) return false
  const start = clockToMinutes(normalizeClockHHMM(config.quiet_hours_start, '22:00'))
  const end = clockToMinutes(normalizeClockHHMM(config.quiet_hours_end, '07:00'))
  if (start === end) return false
  const current = manilaMinutesOfDay(now)
  if (start < end) {
    return current >= start && current < end
  }
  // Overnight wrap (e.g. 22:00 -> 07:00)
  return current >= start || current < end
}

export function normalizeSmsScopeForKind(kind) {
  const k = String(kind || '').trim().toLowerCase()
  if (k === 'ppf' || k === 'detailing') return 'detailing'
  if (k === 'package') return 'package'
  if (k === 'service') return 'service'
  return null
}

/**
 * Check whether an automated booking status SMS is allowed by global config.
 */
export function isStatusSmsAllowedByConfig(config, status, bookingKind) {
  const cfg = normalizeNotificationConfig(config)
  if (!cfg.sms_enabled) return { allowed: false, reason: 'sms_master_disabled' }
  if (status && cfg.sms_statuses[status] === false) {
    return { allowed: false, reason: `sms_status_disabled:${status}` }
  }
  if (bookingKind) {
    const scope = normalizeSmsScopeForKind(bookingKind)
    if (!scope) return { allowed: false, reason: 'sms_scope_excluded' }
    if (cfg.sms_scopes[scope] === false) {
      return { allowed: false, reason: `sms_scope_disabled:${scope}` }
    }
  }
  return { allowed: true, reason: null }
}
