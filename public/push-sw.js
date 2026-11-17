/* global clients, self */
/* Hakum Auto Care — push & lifecycle handlers (imported by vite-plugin-pwa workbox). No secrets. */
self.addEventListener('activate', (event) => {
  if (clients && typeof clients.claim === 'function') {
    event.waitUntil(clients.claim())
  }
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING' && typeof self.skipWaiting === 'function') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  let data = { title: 'Hakum Auto Care', body: 'You have an update.', url: '/', tag: 'hakum' }
  try {
    if (event.data) {
      const parsed = event.data.json()
      if (parsed && typeof parsed === 'object') data = { ...data, ...parsed }
    }
  } catch {
    try {
      const txt = event.data?.text?.()
      if (txt) data.body = txt
    } catch {
      /* ignore */
    }
  }
  const badgeNum = Number(data.badgeCount)
  const badgeTask =
    self.navigator && typeof self.navigator.setAppBadge === 'function'
      ? self.navigator.setAppBadge(Number.isFinite(badgeNum) && badgeNum > 0 ? badgeNum : 1).catch(() => {})
      : Promise.resolve()

  event.waitUntil(
    Promise.all([
      badgeTask,
      self.registration.showNotification(data.title || 'Hakum Auto Care', {
        body: data.body,
        icon: data.icon || '/apple-touch-icon.png',
        badge: '/push-badge.png',
        tag: data.tag || 'hakum',
        renotify: true,
        // Chrome: must be user-visible; requireInteraction keeps important alerts on screen
        requireInteraction: Boolean(data.requireInteraction),
        data: { url: data.url || '/' },
      }),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification?.data?.url || '/'
  // The url on a push payload is chosen by whoever sent it, and
  // /api/notification-broadcast takes that field as free text from a Marketing,
  // Assistant Super Admin or Super Admin account. Navigating to it verbatim would
  // let one broadcast walk every enrolled device onto any site on the internet
  // wearing an official Hakum notification. Resolve it, and take it only when it
  // lands back on our own origin.
  let path = `${self.location.origin}/`
  try {
    const resolved = new URL(raw, self.location.origin)
    if (resolved.origin === self.location.origin) path = resolved.href
  } catch {
    /* unparseable -- keep the root */
  }
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      const ordered = [...all].sort(
        (a, b) =>
          Number(Boolean(b.focused || b.visibilityState === 'visible')) -
          Number(Boolean(a.focused || a.visibilityState === 'visible')),
      )
      for (const client of ordered) {
        if (!client.url.startsWith(self.location.origin)) continue
        try {
          if (typeof client.navigate === 'function') {
            await client.navigate(path)
            if (typeof client.focus === 'function') await client.focus().catch(() => {})
            return
          }
        } catch {
          /* fall through to postMessage / next client */
        }
        try {
          client.postMessage({ type: 'HAKUM_NAV', url: path })
          if (typeof client.focus === 'function') await client.focus().catch(() => {})
          return
        } catch {
          /* try next client */
        }
      }
      // Never focus-only — Chrome would leave the user on the wrong route
      if (clients.openWindow) return clients.openWindow(path)
    })(),
  )
})
