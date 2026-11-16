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

    const opsFallback = buildForegroundToastData(
      { id: 'n2', title: 'Ops alert', body: 'Check dashboard', url: '/', kind: 'system' },
      'BossMich',
    )
    assert.equal(opsFallback.href, '/operations')

    const customerFallback = buildForegroundToastData(
      { id: 'n3', title: 'Account alert', body: 'Update', url: '', kind: 'system' },
      'customer',
    )
    assert.equal(customerFallback.href, '/account')

    const bdayToast = buildForegroundToastData(
      { id: 'n4', title: 'Happy birthday', body: 'Code', url: '/account', kind: 'birthday_greeting' },
      'customer',
    )
    assert.equal(bdayToast.href, '/account/vouchers')
  })

  it('blocks iOS non-standalone Safari tabs (including iPadOS desktop UA) and wires mobile push guidance', async () => {
    const { iosPushBlocked } = await import('../src/lib/installApp.js')
    assert.equal(
      iosPushBlocked({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: false, hasChrome: false }),
      true,
    )
    assert.equal(
      iosPushBlocked({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5, standalone: false, hasChrome: false }),
      true,
    )
    assert.equal(
      iosPushBlocked({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: true, hasChrome: false }),
      false,
    )

    const pushLib = read('src/lib/push.js')
    assert.match(pushLib, /readyRegistrationWithTimeout/)
    const opsLayout = read('src/layouts/OperationsLayout.jsx')
    assert.match(opsLayout, /allowUnsupportedInCompact/)
    assert.doesNotMatch(opsLayout, /<PushToggle[^>]*hidden md:inline-flex/)
    const listener = read('src/components/InAppNotificationListener.jsx')
    assert.match(listener, /hakum:sw-navigate/)
  })

  it('deliverUserNotifications normalizes urls, enforces customer push prefs, and inserts inbox rows', async () => {
    const { deliverUserNotifications } = await import('../server/webPush.mjs')
    const inserted = []
    const pushed = []
    const fakeDb = {
      from(table) {
        if (table === 'customers') {
          return {
            select() { return this },
            async in() {
              return {
                data: [
                  { id: 'c1', notify_push: true, is_disabled: false, is_archived: false },
                  { id: 'c2', notify_push: false, is_disabled: false, is_archived: false },
                ],
              }
            },
          }
        }
        if (table === 'user_notifications') {
          return {
            async insert(rows) {
              inserted.push(...rows)
              return { error: null }
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    }
    const res = await deliverUserNotifications(fakeDb, {
      userIds: ['c1', 'c2', 'c1'],
      kind: 'promo',
      title: 'Weekend wash',
      body: 'Book now',
      url: '//evil.test/steal',
      tag: 'promo-1',
      inbox: true,
      checkCustomerPrefs: true,
      sendPush: async (payload) => {
        pushed.push(payload)
        return { sent: 1, failed: 0, pruned: 0, subscriptions: 1 }
      },
    })
    assert.equal(res.targets, 1)
    assert.equal(res.skipped, 1)
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].user_id, 'c1')
    assert.equal(inserted[0].url, '/')
    assert.deepEqual(pushed[0].userIds, ['c1'])
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
