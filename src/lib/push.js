/** Client Web Push helpers — VITE_VAPID_PUBLIC_KEY only. */
import { iosPushBlocked, isIosDevice, isStandaloneDisplay } from './installApp.js'

export { isIosDevice, isStandaloneDisplay, iosPushBlocked }

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported() {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
  if (iosPushBlocked()) return false
  return true
}

export function pushUnsupportedReason() {
  if (typeof window === 'undefined') return 'unavailable'
  if (iosPushBlocked()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return null
}

async function readyRegistrationWithTimeout(timeoutMs = 3500) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration?.()
    if (!existing) return null
    if (existing.active) return existing
  } catch {
    /* ignore */
  }
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
}

export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await readyRegistrationWithTimeout()
  if (!reg?.pushManager) return 'idle'
  try {
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'subscribed' : 'idle'
  } catch {
    return 'idle'
  }
}

/** Ensure a push-capable service worker is registered and active (also works in vite dev without Workbox SW). */
export async function ensurePushServiceWorker(sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null, timeoutMs = 8000) {
  if (!sw) throw new Error('Push service worker unavailable in this browser.')
  let reg = await sw.getRegistration?.().catch(() => null)
  if ((!reg || (!reg.active && !reg.installing && !reg.waiting)) && typeof sw.register === 'function') {
    reg = await sw.register('/push-sw.js', { scope: '/' })
  }
  if (reg?.active) return reg

  const swTarget = reg?.installing || reg?.waiting
  if (swTarget && typeof swTarget.addEventListener === 'function') {
    await new Promise((resolve) => {
      const done = () => {
        swTarget.removeEventListener('statechange', onChange)
        resolve()
      }
      const onChange = () => {
        if (swTarget.state === 'activated' || swTarget.state === 'redundant') done()
      }
      swTarget.addEventListener('statechange', onChange)
      globalThis.setTimeout(done, Math.min(timeoutMs, 4000))
    })
    if (reg?.active) return reg
  }

  return Promise.race([
    sw.ready,
    new Promise((_, reject) => {
      globalThis.setTimeout(
        () => reject(new Error('Service worker did not start. Refresh and try again.')),
        timeoutMs,
      )
    }),
  ])
}

async function waitForServiceWorker() {
  return ensurePushServiceWorker()
}

async function subscribeWithKey(reg, publicKey) {
  const key = urlBase64ToUint8Array(publicKey)
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    // Stale VAPID after key rotate — Chrome keeps the old subscription until unsubscribed
    try {
      const existing = sub.options?.applicationServerKey
      if (existing) {
        const a = new Uint8Array(existing)
        if (a.length !== key.length || a.some((b, i) => b !== key[i])) {
          await sub.unsubscribe()
          sub = null
        }
      }
    } catch {
      /* options may be missing — keep and re-save */
    }
  }
  const subscribeTimed = () =>
    Promise.race([
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }),
      new Promise((_, reject) => {
        globalThis.setTimeout(
          () => reject(new Error('Push registration timed out. Check your connection and try again.')),
          12000,
        )
      }),
    ])

  if (!sub) {
    try {
      sub = await subscribeTimed()
    } catch (err) {
      // Chrome: previous subscription can block a new one after SW update
      const stale = await reg.pushManager.getSubscription()
      if (stale) {
        await stale.unsubscribe()
        sub = await subscribeTimed()
      } else {
        throw err
      }
    }
  }
  return sub
}

/** @param {string | (() => Promise<string>)} tokenOrGetter — pass a getter from click handlers so the prompt is asked first. */
export async function enablePush(tokenOrGetter) {
  if (!pushSupported()) {
    const reason = pushUnsupportedReason()
    if (reason === 'ios-install') {
      throw new Error('On iPhone/iPad: Share → Add to Home Screen, open Hakum from the icon, then enable alerts.')
    }
    throw new Error('Push not supported on this device.')
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('VAPID public key missing.')
  if (!tokenOrGetter) throw new Error('Sign in required.')

  // Firefox and Safari drop the prompt unless it is requested inside the click — no await may come before this.
  const permissionAsked = Notification.requestPermission()
  const accessToken = typeof tokenOrGetter === 'function' ? await tokenOrGetter() : tokenOrGetter
  if (!accessToken) throw new Error('Sign in required.')
  const permission = await permissionAsked
  if (permission !== 'granted') throw new Error('Notification permission blocked.')

  const reg = await waitForServiceWorker()
  const sub = await subscribeWithKey(reg, publicKey)

  const json = sub.toJSON()
  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    signal: globalThis.AbortSignal?.timeout ? AbortSignal.timeout(10000) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Session expired — sign in again, then enable alerts.')
  if (!res.ok) throw new Error(body.error || 'Unable to save subscription.')
  return 'subscribed'
}

/** Re-subscribe / re-save when Chrome kept permission but dropped or orphaned the PushManager sub. */
export async function healPushSubscription(accessToken) {
  if (!accessToken || !pushSupported()) return null
  if (Notification.permission !== 'granted') return null
  try {
    return await enablePush(accessToken)
  } catch {
    return null
  }
}

export async function disablePush(accessToken) {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    if (accessToken) {
      await fetch('/api/push-subscribe', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint }),
      })
    }
  }
  return 'idle'
}
