import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BOOKING_STATUS_CONFIG_META,
  DEFAULT_NOTIFICATION_CONFIG,
  isStatusSmsAllowedByConfig,
  isWithinQuietHours,
  normalizeNotificationConfig,
  resolveNotificationConfigRows,
  validateNotificationConfigPatch,
} from '../src/lib/notificationConfig.js'
import { isEligibleStatusSmsBooking } from '../server/notifyBooking.mjs'
import { handleNotificationConfigRequest, loadNotificationConfig } from '../server/notificationConfigApi.mjs'
import { classifyPushPlatform, summarizeSubscriptionsByPlatform } from '../src/lib/pushPlatform.js'
import { diagnoseVapidConfig } from '../server/webPush.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

function fakeRes() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) {
      out.headers[name] = value
    },
    end(chunk = '') {
      out.body = chunk
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(v) {
      out.statusCode = v
    },
  }
}

describe('Notification config normalization, validation & quiet hours', () => {
  it('merges partial config cleanly and honors timestamp arbitration with sms_notifications', () => {
    const resolvedFromLegacy = resolveNotificationConfigRows({
      configRow: {
        value: { ...DEFAULT_NOTIFICATION_CONFIG, sms_enabled: true },
        updated_at: '2026-11-22T01:00:00Z',
      },
      smsRow: {
        value: { enabled: false },
        updated_at: '2026-11-22T02:00:00Z',
      },
    })
    assert.equal(resolvedFromLegacy.sms_enabled, false)

    const resolvedFromUnified = resolveNotificationConfigRows({
      configRow: {
        value: { ...DEFAULT_NOTIFICATION_CONFIG, sms_enabled: true },
        updated_at: '2026-11-22T03:00:00Z',
      },
      smsRow: {
        value: { enabled: false },
        updated_at: '2026-11-22T02:00:00Z',
      },
    })
    assert.equal(resolvedFromUnified.sms_enabled, true)
  })

  it('validates sender IDs and quiet-hours bounds cleanly', () => {
    const badSender = validateNotificationConfigPatch({ sms_sender_id: 'invalid sender!' })
    assert.equal(badSender.ok, false)

    const badClock = validateNotificationConfigPatch({ quiet_hours_start: '25:99' })
    assert.equal(badClock.ok, false)

    const sameClock = validateNotificationConfigPatch({
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '22:00',
    })
    assert.equal(sameClock.ok, false)

    const valid = validateNotificationConfigPatch({
      sms_sender_id: 'hakum_qc',
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      sms_scopes: { detailing: true, service: false, package: true },
    })
    assert.equal(valid.ok, true)
    assert.equal(valid.config.sms_sender_id, 'HAKUM_QC')
    assert.equal(valid.config.sms_scopes.service, false)
  })

  it('evaluates Manila (UTC+8) overnight and daytime quiet windows accurately', () => {
    const overnightCfg = normalizeNotificationConfig({
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    })
    // 23:30 Manila = 15:30 UTC
    assert.equal(isWithinQuietHours(overnightCfg, new Date('2026-11-22T15:30:00Z')), true)
    // 06:15 Manila = 22:15 UTC previous day
    assert.equal(isWithinQuietHours(overnightCfg, new Date('2026-11-21T22:15:00Z')), true)
    // 14:00 Manila = 06:00 UTC
    assert.equal(isWithinQuietHours(overnightCfg, new Date('2026-11-22T06:00:00Z')), false)

    const offCfg = normalizeNotificationConfig({ quiet_hours_enabled: false })
    assert.equal(isWithinQuietHours(offCfg, new Date('2026-11-22T15:30:00Z')), false)
  })
})

describe('Status SMS scopes & per-status enforcement', () => {
  it('allows single-arg compatibility and enforces configured service scopes + stage gates', () => {
    assert.equal(
      isEligibleStatusSmsBooking({
        services: { pay_category: 'detailing', slug: 'ceramic-coating' },
      }),
      true,
    )
    assert.equal(
      isEligibleStatusSmsBooking({
        services: { pay_category: 'merch', slug: 'microfiber-towel' },
      }),
      false,
    )

    const servicesOffCfg = normalizeNotificationConfig({
      sms_enabled: true,
      sms_scopes: { detailing: true, service: false, package: true },
      sms_statuses: { in_progress: false },
    })

    assert.equal(
      isEligibleStatusSmsBooking({ services: { pay_category: 'service', slug: 'basic-wash' } }, servicesOffCfg),
      false,
    )
    assert.equal(
      isEligibleStatusSmsBooking({ services: { pay_category: 'detailing', slug: 'paint-protection-film' } }, servicesOffCfg),
      true,
    )

    assert.equal(isStatusSmsAllowedByConfig(servicesOffCfg, 'in_progress', 'detailing').allowed, false)
    assert.equal(isStatusSmsAllowedByConfig(servicesOffCfg, 'completed', 'package').allowed, true)
    assert.equal(BOOKING_STATUS_CONFIG_META.length, 9)
  })
})

describe('notification-config API auth boundary & UI wiring', () => {
  it('rejects unauthenticated callers with 401 and safely loads defaults from mock DBs', async () => {
    const res = fakeRes()
    await handleNotificationConfigRequest({ method: 'GET', url: '/api/notification-config', headers: {} }, res)
    assert.equal(res.out.statusCode, 401)

    const fallback = await loadNotificationConfig({})
    assert.deepEqual(fallback, normalizeNotificationConfig(DEFAULT_NOTIFICATION_CONFIG))
  })

  it('wires NotificationSettingsPanel cleanly without hardcoded raw hexes', () => {
    const page = read('src/pages/NotificationsPage.jsx')
    const panel = read('src/pages/notifications/NotificationSettingsPanel.jsx')
    assert.match(page, /NotificationSettingsPanel/)
    assert.match(panel, /\/api\/notification-config/)
    assert.match(panel, /send_status_sms_test/)
    assert.match(panel, /test_vapid_push/)
    assert.match(panel, /test_in_app/)
    assert.match(panel, /Test Web Browser/)
    assert.match(panel, /Test Mobile Android/)
    assert.match(panel, /Test Mobile iOS/)
    assert.equal(/#[0-9a-f]{6}/i.test(panel), false)
    assert.match(panel, /automation-sweep/)
    assert.match(panel, /rotate_automation_token/)
    assert.match(panel, /booking_reminder_days/)
    assert.match(panel, /points_shop_expiry_enabled/)
  })

  it('validates extended automation runner modes, lead days, and review delay bounds', () => {
    const badMode = validateNotificationConfigPatch({ automation_mode: 'unknown_mode' })
    assert.equal(badMode.ok, false)

    const emptyDays = validateNotificationConfigPatch({ booking_reminder_days: [] })
    assert.equal(emptyDays.ok, false)

    const badMaintLead = validateNotificationConfigPatch({ maintenance_lead_days: 90 })
    assert.equal(badMaintLead.ok, false)

    const badDelay = validateNotificationConfigPatch({ rate_visit_delay_minutes: 1 })
    assert.equal(badDelay.ok, false)

    const okCfg = validateNotificationConfigPatch({
      automation_mode: 'hybrid',
      booking_reminder_days: [1, 14, 3, 3],
      maintenance_lead_days: 45,
      maintenance_interval_days: 60,
      rate_visit_delay_minutes: 30,
      rate_visit_window_hours: 12,
      points_shop_expiry_enabled: false,
      points_shop_expiry_notice_days: 4,
      daily_automation_hour_manila: 9,
      birthday_include_customers: true,
      birthday_include_staff: false,
    })
    assert.equal(okCfg.ok, true)
    assert.deepEqual(okCfg.config.booking_reminder_days, [14, 3, 1])
    assert.equal(okCfg.config.maintenance_lead_days, 45)
    assert.equal(okCfg.config.rate_visit_delay_minutes, 30)
    assert.equal(okCfg.config.points_shop_expiry_enabled, false)
    assert.equal(okCfg.config.birthday_include_staff, false)
  })

  it('classifies Web, Android, and iOS APNs push subscriptions and diagnoses VAPID keys accurately', () => {
    const subs = [
      { endpoint: 'https://web.push.apple.com/QH...', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7)' },
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', user_agent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' },
      { endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    ]
    assert.equal(classifyPushPlatform(subs[0]), 'ios')
    assert.equal(classifyPushPlatform(subs[1]), 'android')
    assert.equal(classifyPushPlatform(subs[2]), 'web')
    assert.deepEqual(summarizeSubscriptionsByPlatform(subs), {
      total: 3,
      counts: { web: 1, android: 1, ios: 1 },
    })

    const missing = diagnoseVapidConfig({})
    assert.equal(missing.configured, false)
    assert.equal(missing.valid, false)

    const mismatch = diagnoseVapidConfig({
      VAPID_PUBLIC_KEY: 'AAA',
      VITE_VAPID_PUBLIC_KEY: 'BBB',
      VAPID_PRIVATE_KEY: 'CCC',
    })
    assert.equal(mismatch.publicKeyMatch, false)
  })

  it('writes user_notifications inbox rows for role-based targets in pushApi.mjs', () => {
    const pushApi = read('server/pushApi.mjs')
    assert.match(pushApi, /inboxIds = body\.inbox === false \? \[\] : \[\.\.\.new Set\(\[\.\.\.explicitIds, \.\.\.userIds\]\)\]/)
  })
})
