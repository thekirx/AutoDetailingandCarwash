/** Client Web Push helpers — VITE_VAPID_PUBLIC_KEY only. */
import { isIosDevice, isStandaloneDisplay } from '@/lib/installApp'

export { isIosDevice, isStandaloneDisplay }

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
  // iOS browser tab: PushManager may exist in newer versions but delivery needs PWA
  if (isIosDevice() && !isStandaloneDisplay()) return false
  return true
}

export function pushUnsupportedReason() {
  if (typeof window === 'undefined') return 'unavailable'
  if (isIosDevice() && !isStandaloneDisplay()) return 'ios-install'
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

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission blocked.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = sub.toJSON()
  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
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
  if (!res.ok) throw new Error(body.error || 'Unable to save subscription.')
  return 'subscribed'
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
