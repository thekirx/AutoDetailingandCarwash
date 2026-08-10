import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BUSYBEE_SMS_SINGLE_MAX,
  busybeeSmsSegments,
  clampNotificationCopy,
  messageMaxForChannel,
  notificationScopeLabel,
  renderNotificationMessage,
  resolveNotificationScope,
} from '../src/lib/notificationCopy.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('BusyBee character limits', () => {
  it('uses 160 for single SMS and segments after that', () => {
    assert.equal(BUSYBEE_SMS_SINGLE_MAX, 160)
    assert.equal(busybeeSmsSegments('x'.repeat(160)), 1)
    assert.equal(busybeeSmsSegments('x'.repeat(161)), 2)
    assert.equal(messageMaxForChannel('sms'), 160)
    assert.equal(messageMaxForChannel('both'), 160)
    assert.equal(messageMaxForChannel('push'), 200)
  })

  it('clamps title/message to channel limits', () => {
    const copy = clampNotificationCopy({
      channel: 'sms',
      title: 'T'.repeat(200),
      message: 'M'.repeat(200),
    })
    assert.equal(copy.title.length, 160)
    assert.equal(copy.message.length, 160)
  })
})

describe('notification scope resolver', () => {
  it('maps whole / per_branch / per_service / per_service_branch', () => {
    assert.deepEqual(resolveNotificationScope({ scope: 'whole' }), {
      ok: true,
      scope: 'whole',
      service_id: null,
      branch_slug: null,
    })
    assert.equal(resolveNotificationScope({ scope: 'per_branch' }).ok, false)
    assert.equal(
      resolveNotificationScope({ scope: 'per_branch', branch_slug: 'bacoor' }).branch_slug,
      'bacoor',
    )
    assert.equal(
      resolveNotificationScope({ scope: 'per_service', service_id: 'svc-1' }).service_id,
      'svc-1',
    )
    assert.equal(
      resolveNotificationScope({
        scope: 'per_service_branch',
        service_id: 'svc-1',
        branch_slug: 'bacoor',
      }).ok,
      true,
    )
    assert.equal(notificationScopeLabel('per_service'), 'Per service')
  })
})

describe('custom message tokens', () => {
  it('renders {plate} {service} {name} {branch}', () => {
    const out = renderNotificationMessage('Hi {name}, {plate} needs {service} at {branch}.', {
      name: 'Ana',
      plate: 'ABC-123',
      service: 'Ceramic Coating',
      branch: 'bacoor',
    })
    assert.equal(out, 'Hi Ana, ABC-123 needs Ceramic Coating at bacoor.')
  })
})

describe('settings page + migration contract', () => {
  it('UI is detailing-only with scope + BusyBee counter + custom message', async () => {
    const jsx = await readFile(resolve(root, 'src/pages/NotificationSettingsPage.jsx'), 'utf8')
    assert.match(jsx, /filterFloorDetailingServices/)
    assert.match(jsx, /NOTIFICATION_SCOPES/)
    assert.match(jsx, /BUSYBEE_SMS_SINGLE_MAX/)
    assert.match(jsx, /Custom message/)
    assert.match(jsx, /\{plate\}/)
  })

  it('migration adds scope title message + unique scope index', async () => {
    const sql = await readFile(
      resolve(root, 'supabase/migrations/20260810140000_notification_settings_copy_scope.sql'),
      'utf8',
    )
    assert.match(sql, /add column if not exists scope/)
    assert.match(sql, /add column if not exists title/)
    assert.match(sql, /add column if not exists message/)
    assert.match(sql, /notification_settings_scope_uidx/)
    assert.match(sql, /per_service_branch/)
  })

  it('API requires custom message and detailing service', async () => {
    const mjs = await readFile(resolve(root, 'server/notificationSettingsApi.mjs'), 'utf8')
    assert.match(mjs, /Reminders are limited to detailing services/)
    assert.match(mjs, /Write a custom reminder message/)
    assert.match(mjs, /resolveNotificationScope/)
  })
})
