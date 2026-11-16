import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('PWA cross-device update lifecycle & storage persistence', () => {
  it('blocks auto-reload while user is actively editing or on a dismissed/already-reloaded version', async () => {
    const {
      markVersionReloaded,
      shouldAutoReloadForUpdate,
      wasVersionAlreadyReloaded,
    } = await import('../src/lib/pwaUpdates.js')

    assert.equal(shouldAutoReloadForUpdate({ busyEditing: false, dismissed: false, hasReloadedSameVersion: false }), true)
    assert.equal(shouldAutoReloadForUpdate({ busyEditing: true, dismissed: false, hasReloadedSameVersion: false }), false)
    assert.equal(shouldAutoReloadForUpdate({ busyEditing: false, dismissed: true, hasReloadedSameVersion: false }), false)
    assert.equal(shouldAutoReloadForUpdate({ busyEditing: false, dismissed: false, hasReloadedSameVersion: true }), false)

    const mem = new Map()
    const fakeStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
    assert.equal(wasVersionAlreadyReloaded('v2', fakeStorage), false)
    markVersionReloaded('v2', fakeStorage)
    assert.equal(wasVersionAlreadyReloaded('v2', fakeStorage), true)
    assert.equal(wasVersionAlreadyReloaded('v3', fakeStorage), false)
  })

  it('detects version drift from /version.json cleanly and ignores offline errors', async () => {
    const { detectVersionDrift } = await import('../src/lib/pwaUpdates.js')

    const stale = await detectVersionDrift(
      async () => ({ ok: true, json: async () => ({ version: 'rel-2' }) }),
      'rel-1',
    )
    assert.deepEqual(stale, { stale: true, latest: 'rel-2' })

    const same = await detectVersionDrift(
      async () => ({ ok: true, json: async () => ({ version: 'rel-1' }) }),
      'rel-1',
    )
    assert.deepEqual(same, { stale: false, latest: 'rel-1' })

    const offline = await detectVersionDrift(async () => {
      throw new Error('network error')
    }, 'rel-1')
    assert.deepEqual(offline, { stale: false, latest: 'rel-1' })
  })

  it('uses registerType prompt, emits version.json, and claims SW clients cleanly', () => {
    const vite = read('vite.config.js')
    assert.match(vite, /registerType:\s*['"]prompt['"]/)
    assert.match(vite, /version\.json/)

    const sw = read('public/push-sw.js')
    assert.match(sw, /SKIP_WAITING/)
    assert.match(sw, /clients\.claim/)
  })
})

describe('Omnichannel in-app notification listener & realtime payload fan-out', () => {
  it('dedupes seen IDs and builds safe role-scoped toast payloads', async () => {
    const { buildForegroundToastData, rememberNotificationId } = await import('../src/lib/inAppNotifications.js')

    const seen = new Set()
    assert.equal(rememberNotificationId(seen, 'n1'), true)
    assert.equal(rememberNotificationId(seen, 'n1'), false)

    const opsToast = buildForegroundToastData(
      { id: 'n1', title: 'New booking', body: 'ABC 123', url: '/operations/queue', kind: 'booking_new' },
      'staff',
    )
    assert.equal(opsToast.title, 'New booking')
    assert.equal(opsToast.href, '/operations/queue')
  })

  it('passes realtime payload through subscribeUserNotificationRealtime without breaking zero-arg hooks', async () => {
    const {
      __resetUserNotificationRealtimeForTests,
      subscribeUserNotificationRealtime,
    } = await import('../src/lib/userNotificationsRealtime.js')

    __resetUserNotificationRealtimeForTests()
    let handler
    const client = {
      channel() {
        return {
          on(_type, _filter, cb) {
            handler = cb
            return this
          },
          subscribe() {
            return this
          },
        }
      },
      removeChannel() {},
    }

    const received = []
    subscribeUserNotificationRealtime('u-99', (payload) => received.push(payload), client)
    handler({ eventType: 'INSERT', new: { id: 'notif-1', title: 'Ready' } })
    assert.equal(received[0]?.new?.id, 'notif-1')
    __resetUserNotificationRealtimeForTests()
  })
})
