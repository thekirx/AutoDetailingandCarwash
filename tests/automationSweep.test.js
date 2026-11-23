import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDefaultNotificationConfig } from '../src/lib/notificationConfig.js'
import {
  AUTOMATION_STATE_KEY,
  hashWebhookToken,
  sanitizeAutomationState,
  webhookTokenMatches,
} from '../server/automationState.mjs'
import { executeAutomationSweep, isJobDueForSweep } from '../server/automationSweepApi.mjs'
import { runRateVisitReminders } from '../server/rateVisitReminders.mjs'

describe('Automation webhook tokens & sanitization', () => {
  it('matches hashed webhook token cleanly and strips hashes from sanitized diagnostics', async () => {
    const raw = 'hkcron_test_token_123456'
    const stored = {
      webhook_token_hash: hashWebhookToken(raw),
      webhook_token_hint: '3456',
      webhook_rotated_at: '2026-11-23T01:00:00Z',
      last_sweep_at: null,
      jobs: {},
    }
    const db = {
      from(table) {
        assert.equal(table, 'app_settings')
        return {
          select() { return this },
          eq(col, key) {
            assert.equal(col, 'key')
            assert.equal(key, AUTOMATION_STATE_KEY)
            return this
          },
          async maybeSingle() {
            return { data: { value: stored }, error: null }
          },
        }
      },
    }

    assert.equal(await webhookTokenMatches({ headers: { authorization: `Bearer ${raw}` } }, db), true)
    assert.equal(await webhookTokenMatches({ headers: { authorization: 'Bearer wrong' } }, db), false)
    assert.equal(await webhookTokenMatches({ headers: { authorization: 'Bearer a.b.c' } }, db), false)

    const clean = sanitizeAutomationState(stored, { CRON_SECRET: '' })
    assert.equal(clean.webhook_configured, true)
    assert.equal(clean.webhook_token_hint, '3456')
    assert.equal(clean.cron_secret_configured, false)
    assert.equal('webhook_token_hash' in clean, false)
  })
})

describe('Automation sweep scheduling rules', () => {
  it('runs rate_visit on 15-min cadence and daily jobs once per Manila day after target hour', () => {
    const cfg = createDefaultNotificationConfig()
    cfg.daily_automation_hour_manila = 8

    // 07:30 Manila = 23:30 UTC previous day -> daily jobs wait until 08:00 Manila; rate_visit due when never run
    const earlyManila = new Date('2026-11-22T23:30:00Z')
    assert.equal(isJobDueForSweep('rate_visit', { last_run_at: null }, cfg, earlyManila), true)
    assert.equal(isJobDueForSweep('booking_reminders', { last_run_at: null }, cfg, earlyManila), false)

    // 09:00 Manila = 01:00 UTC -> daily jobs become eligible once per Manila day
    const morningManila = new Date('2026-11-23T01:00:00Z')
    assert.equal(isJobDueForSweep('booking_reminders', { last_run_at: null }, cfg, morningManila), true)
    assert.equal(
      isJobDueForSweep('booking_reminders', { last_run_at: '2026-11-23T00:15:00Z' }, cfg, morningManila),
      false,
    )

    // rate_visit throttled inside 15 minutes
    const recent = new Date('2026-11-23T00:50:00Z').toISOString()
    assert.equal(isJobDueForSweep('rate_visit', { last_run_at: recent }, cfg, morningManila), false)
  })

  it('skips coded_sweep when automation_mode is cron_only', async () => {
    const cfg = createDefaultNotificationConfig()
    cfg.automation_mode = 'cron_only'
    const db = {
      from(_table) {
        return {
          select() { return this },
          in() {
            return Promise.resolve({
              data: [{ key: 'notification_config', value: cfg, updated_at: '2026-11-23T00:00:00Z' }],
              error: null,
            })
          },
          eq() { return this },
          async maybeSingle() { return { data: null, error: null } },
        }
      },
    }
    const res = await executeAutomationSweep(db, { trigger: 'coded_sweep' })
    assert.equal(res.skipped, true)
    assert.equal(res.reason, 'cron_only_mode')
  })
})

describe('runRateVisitReminders Inbox + Push delivery', () => {
  it('delivers rate-visit nudge into user_notifications with configurable delay and window', async () => {
    const nowMs = Date.parse('2026-11-23T04:00:00Z')
    const inserted = []
    const cfg = {
      ...createDefaultNotificationConfig(),
      rate_visit_delay_minutes: 10,
      rate_visit_window_hours: 4,
      push_notifications_enabled: false,
    }
    const bookings = [
      {
        id: 'b-rate-1',
        customer_id: 'cust-1',
        customer_name: 'Ana Cruz',
        vehicle_plate: 'HAK123',
        status: 'completed',
        completed_at: new Date(nowMs - 20 * 60_000).toISOString(),
        for_payment_at: new Date(nowMs - 20 * 60_000).toISOString(),
        customers: { full_name: 'Ana Cruz' },
      },
      {
        id: 'b-too-fresh',
        customer_id: 'cust-2',
        customer_name: 'Ben',
        vehicle_plate: 'HAK999',
        status: 'completed',
        completed_at: new Date(nowMs - 5 * 60_000).toISOString(),
        for_payment_at: new Date(nowMs - 5 * 60_000).toISOString(),
        customers: { full_name: 'Ben' },
      },
    ]

    const db = {
      from(table) {
        if (table === 'app_settings') {
          return {
            select() { return this },
            in() {
              return Promise.resolve({
                data: [{ key: 'notification_config', value: cfg, updated_at: '2026-11-23T00:00:00Z' }],
                error: null,
              })
            },
          }
        }
        if (table === 'bookings') {
          return {
            select() { return this },
            eq() { return this },
            not() { return this },
            gte() { return this },
            order() { return this },
            limit() { return Promise.resolve({ data: bookings, error: null }) },
          }
        }
        if (table === 'notification_templates') {
          return {
            select() { return Promise.resolve({ data: [], error: null }) },
          }
        }
        if (table === 'user_notifications') {
          return {
            select() { return this },
            in() { return Promise.resolve({ data: [], error: null }) },
            async insert(row) {
              if (Array.isArray(row)) inserted.push(...row)
              else inserted.push(row)
              return { error: null }
            },
          }
        }
        if (table === 'customers') {
          return {
            select() { return this },
            in() { return Promise.resolve({ data: [], error: null }) },
          }
        }
        return { select() { return Promise.resolve({ data: [], error: null }) } }
      },
    }

    const res = await runRateVisitReminders(db, { nowMs })
    assert.equal(res.eligible, 1)
    assert.equal(res.sent, 1)
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].user_id, 'cust-1')
    assert.equal(inserted[0].kind, 'rate_visit')
    assert.equal(inserted[0].tag, 'rate-visit:b-rate-1')
  })
})
