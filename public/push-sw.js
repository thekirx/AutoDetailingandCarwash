/* global clients, self */
/* Hakum Auto Care — push handlers (imported by vite-plugin-pwa workbox). No secrets. */
self.addEventListener('push', (event) => {
  let data = { title: 'Hakum Auto Care', body: 'You have an update.', url: '/', tag: 'hakum' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* ignore */
  }
  event.waitUntil(
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
      for (const client of all) {
        if (!client.url.startsWith(self.location.origin)) continue
        try {
          if (typeof client.navigate === 'function') {
            await client.navigate(path)
            await client.focus()
            return
          }
        } catch {
          /* fall through to postMessage / next client */
        }
        try {
          client.postMessage({ type: 'HAKUM_NAV', url: path })
          await client.focus()
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
