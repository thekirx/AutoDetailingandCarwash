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
    assert.equal(/#[0-9a-f]{6}/i.test(panel), false)
  })
})
