import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensurePushServiceWorker, getPushStatus } from '../src/lib/push.js'

describe('push service worker bootstrap', () => {
  it('registers /push-sw.js instead of hanging when no service worker is registered (e.g. localhost dev)', async () => {
    const calls = []
    const fakeActiveReg = {
      active: { state: 'activated', scriptURL: 'http://localhost:5173/push-sw.js' },
      pushManager: {},
    }
    const mockSw = {
      async getRegistration() {
        calls.push('getRegistration')
        return undefined
      },
      async register(url, opts) {
        calls.push(['register', url, opts?.scope])
        return fakeActiveReg
      },
      // Simulate navigator.serviceWorker.ready never resolving until registered (exact browser deadlock)
      ready: new Promise(() => {}),
    }

    const reg = await ensurePushServiceWorker(mockSw, 300)
    assert.equal(reg, fakeActiveReg)
    assert.deepEqual(calls, ['getRegistration', ['register', '/push-sw.js', '/']])
  })

  it('resolves getPushStatus immediately to idle when no SW is registered without waiting 3.5s', async () => {
    const prevWindow = globalThis.window
    const prevNav = globalThis.navigator
    const prevNotif = globalThis.Notification
    try {
      globalThis.window = {
        setTimeout: globalThis.setTimeout,
        matchMedia: () => ({ matches: false }),
      }
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
          userAgent: 'Mozilla/5.0',
          serviceWorker: {
            getRegistration: async () => undefined,
            ready: new Promise(() => {}),
          },
        },
      })
      globalThis.Notification = { permission: 'default' }
      globalThis.window.PushManager = function PushManager() {}
      globalThis.window.Notification = globalThis.Notification
      Object.defineProperty(globalThis.window, 'navigator', { configurable: true, value: globalThis.navigator })

      const t0 = Date.now()
      const status = await getPushStatus()
      assert.equal(status, 'idle')
      assert.ok(Date.now() - t0 < 250, `Expected <250ms, took ${Date.now() - t0}ms`)
    } finally {
      globalThis.window = prevWindow
      if (prevNav === undefined) delete globalThis.navigator
      else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prevNav })
      globalThis.Notification = prevNotif
    }
  })
})
