/** Client Web Push helpers — VITE_VAPID_PUBLIC_KEY only. */
import { iosPushBlocked, isIosDevice, isStandaloneDisplay } from '@/lib/installApp'

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

export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'idle'
}

async function waitForServiceWorker() {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('Service worker did not start. Refresh and try again.')), 8000)
    }),
  ])
  // Chrome: subscribe against the active worker after a deploy/update
  if (reg.installing || reg.waiting) {
    await new Promise((resolve) => {
      const sw = reg.installing || reg.waiting
      if (!sw) return resolve()
      const onChange = () => {
        if (sw.state === 'activated' || sw.state === 'redundant') {
          sw.removeEventListener('statechange', onChange)
          resolve()
        }
      }
      sw.addEventListener('statechange', onChange)
      window.setTimeout(resolve, 4000)
    })
  }
  return navigator.serviceWorker.ready
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
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
    } catch (err) {
      // Chrome: previous subscription can block a new one after SW update
      const stale = await reg.pushManager.getSubscription()
      if (stale) {
        await stale.unsubscribe()
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        })
      } else {
        throw err
      }
    }
  }
  return sub
}

export async function enablePush(accessToken) {
  if (!pushSupported()) {
    const reason = pushUnsupportedReason()
    if (reason === 'ios-install') {
      throw new Error('On iPhone/iPad: Share → Add to Home Screen, open Hakum from the icon, then enable alerts.')
    }
    throw new Error('Push not supported on this device.')
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('VAPID public key missing.')
  if (!accessToken) throw new Error('Sign in required.')

  // Chrome only shows the permission prompt from a user gesture; if already granted, no prompt.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission blocked.')

  const reg = await waitForServiceWorker()
  const sub = await subscribeWithKey(reg, publicKey)

  const json = sub.toJSON()
  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    credentials: 'same-origin',
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
